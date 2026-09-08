import type { CalculationResult, DiagramPoint, HangerResult, TrussModel } from './types'

export const GRAVITY = 9.80665
const POSITION_EPSILON = 1e-10

interface BeamSolution {
  reactions: Map<string, number>
}

export function calculateTruss(model: TrussModel): CalculationResult {
  const distributedLoad = model.massPerMeter * GRAVITY
  const pointForces = model.loads.map((load) => ({ position: load.position, forceN: load.massKg * GRAVITY }))
  const totalMassKg = model.massPerMeter * model.length + model.loads.reduce((sum, load) => sum + load.massKg, 0)
  const totalForceN = totalMassKg * GRAVITY
  const centerOfMass = totalMassKg > 0
    ? (model.massPerMeter * model.length * model.length / 2
      + model.loads.reduce((sum, load) => sum + load.massKg * load.position, 0)) / totalMassKg
    : null

  let active = [...model.hangers]
  const slackIds = new Set<string>()
  let solution: BeamSolution | null = null
  let warning: string | null = null

  for (let iteration = 0; iteration <= model.hangers.length; iteration += 1) {
    if (active.length < 2) {
      warning = 'The tension-only hanger layout is unstable: fewer than two hangers remain active.'
      solution = null
      break
    }
    solution = solveBeam(model, active)
    const tolerance = Math.max(1e-7, totalForceN * 1e-9)
    const negative = active
      .map((hanger) => ({ hanger, reaction: solution?.reactions.get(hanger.id) ?? 0 }))
      .filter(({ reaction }) => reaction < -tolerance)
      .sort((a, b) => a.reaction - b.reaction)[0]
    if (!negative) break
    slackIds.add(negative.hanger.id)
    active = active.filter((hanger) => hanger.id !== negative.hanger.id)
  }

  const hangerResults: HangerResult[] = model.hangers.map((hanger) => ({
    id: hanger.id,
    position: hanger.position,
    reactionN: slackIds.has(hanger.id) || !solution ? 0 : cleanZero(solution.reactions.get(hanger.id) ?? 0),
    slack: slackIds.has(hanger.id),
  }))
  const reactions = hangerResults.filter((hanger) => !hanger.slack).map((hanger) => ({ position: hanger.position, forceN: hanger.reactionN }))
  const momentAt = (x: number) => internalMoment(x, reactions, pointForces, distributedLoad)
  const events = uniqueSorted([0, model.length, ...model.loads.map((load) => load.position), ...model.hangers.map((hanger) => hanger.position)])
  const candidates = [...events]

  if (solution) {
    for (let index = 0; index < events.length - 1; index += 1) {
      const left = events[index]
      const right = events[index + 1]
      if (distributedLoad <= 0 || right - left <= POSITION_EPSILON) continue
      const upwardLeft = reactions.filter((reaction) => reaction.position <= left + POSITION_EPSILON).reduce((sum, reaction) => sum + reaction.forceN, 0)
      const downwardLeft = pointForces.filter((load) => load.position <= left + POSITION_EPSILON).reduce((sum, load) => sum + load.forceN, 0)
      const root = (upwardLeft - downwardLeft) / distributedLoad
      if (root > left + POSITION_EPSILON && root < right - POSITION_EPSILON) candidates.push(root)
    }
  }

  const maximum = candidates
    .map((x) => ({ x, moment: solution ? momentAt(x) : 0 }))
    .reduce((best, item) => Math.abs(item.moment) > Math.abs(best.moment) ? item : best, { x: 0, moment: 0 })
  const diagramXs = uniqueSorted([
    ...events.flatMap((left, index) => {
      const right = events[index + 1]
      if (right === undefined) return [left]
      return Array.from({ length: 9 }, (_, step) => left + (right - left) * step / 8)
    }),
    maximum.x,
  ])
  const momentDiagram: DiagramPoint[] = diagramXs.map((x) => ({ x, momentNm: solution ? cleanZero(momentAt(x)) : 0 }))

  return {
    totalMassKg,
    totalForceN,
    centerOfMass,
    hangers: hangerResults,
    maxMomentNm: cleanZero(maximum.moment),
    maxMomentPosition: maximum.x,
    momentDiagram,
    warning,
  }
}

function solveBeam(model: TrussModel, activeHangers: TrussModel['hangers']): BeamSolution {
  const nodePositions = uniqueSorted([0, model.length, ...model.loads.map((load) => load.position), ...model.hangers.map((hanger) => hanger.position)])
  const size = nodePositions.length * 2
  const stiffness = Array.from({ length: size }, () => Array<number>(size).fill(0))
  const forces = Array<number>(size).fill(0)
  const downwardPerMeter = model.massPerMeter * GRAVITY

  for (let element = 0; element < nodePositions.length - 1; element += 1) {
    const length = nodePositions[element + 1] - nodePositions[element]
    const l2 = length * length
    const l3 = l2 * length
    const scale = 1 / l3
    const localK = [
      [12, 6 * length, -12, 6 * length],
      [6 * length, 4 * l2, -6 * length, 2 * l2],
      [-12, -6 * length, 12, -6 * length],
      [6 * length, 2 * l2, -6 * length, 4 * l2],
    ]
    const dofs = [element * 2, element * 2 + 1, element * 2 + 2, element * 2 + 3]
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 4; column += 1) stiffness[dofs[row]][dofs[column]] += localK[row][column] * scale
    }
    const consistentLoad = [
      -downwardPerMeter * length / 2,
      -downwardPerMeter * l2 / 12,
      -downwardPerMeter * length / 2,
      downwardPerMeter * l2 / 12,
    ]
    for (let index = 0; index < 4; index += 1) forces[dofs[index]] += consistentLoad[index]
  }

  model.loads.forEach((load) => {
    const node = findPosition(nodePositions, load.position)
    forces[node * 2] -= load.massKg * GRAVITY
  })

  const constrained = new Set(activeHangers.map((hanger) => findPosition(nodePositions, hanger.position) * 2))
  const free = Array.from({ length: size }, (_, index) => index).filter((index) => !constrained.has(index))
  const reducedK = free.map((row) => free.map((column) => stiffness[row][column]))
  const reducedF = free.map((row) => forces[row])
  const reducedD = solveLinearSystem(reducedK, reducedF)
  const displacement = Array<number>(size).fill(0)
  free.forEach((dof, index) => { displacement[dof] = reducedD[index] })

  const reactions = new Map<string, number>()
  activeHangers.forEach((hanger) => {
    const dof = findPosition(nodePositions, hanger.position) * 2
    const reaction = stiffness[dof].reduce((sum, coefficient, index) => sum + coefficient * displacement[index], 0) - forces[dof]
    reactions.set(hanger.id, reaction)
  })
  return { reactions }
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] {
  const n = vector.length
  const augmented = matrix.map((row, index) => [...row, vector[index]])
  for (let pivot = 0; pivot < n; pivot += 1) {
    let best = pivot
    for (let row = pivot + 1; row < n; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[best][pivot])) best = row
    }
    if (Math.abs(augmented[best][pivot]) < 1e-12) throw new Error('The hanger layout produces a singular beam model.')
    ;[augmented[pivot], augmented[best]] = [augmented[best], augmented[pivot]]
    const divisor = augmented[pivot][pivot]
    for (let column = pivot; column <= n; column += 1) augmented[pivot][column] /= divisor
    for (let row = 0; row < n; row += 1) {
      if (row === pivot) continue
      const factor = augmented[row][pivot]
      for (let column = pivot; column <= n; column += 1) augmented[row][column] -= factor * augmented[pivot][column]
    }
  }
  return augmented.map((row) => row[n])
}

function internalMoment(
  x: number,
  reactions: Array<{ position: number; forceN: number }>,
  loads: Array<{ position: number; forceN: number }>,
  distributedLoad: number,
): number {
  const reactionMoment = reactions.filter((item) => item.position <= x + POSITION_EPSILON).reduce((sum, item) => sum + item.forceN * (x - item.position), 0)
  const loadMoment = loads.filter((item) => item.position <= x + POSITION_EPSILON).reduce((sum, item) => sum + item.forceN * (x - item.position), 0)
  return reactionMoment - loadMoment - distributedLoad * x * x / 2
}

function uniqueSorted(values: number[]): number[] {
  return [...values].sort((a, b) => a - b).filter((value, index, all) => index === 0 || Math.abs(value - all[index - 1]) > POSITION_EPSILON)
}

function findPosition(values: number[], target: number): number {
  const index = values.findIndex((value) => Math.abs(value - target) <= POSITION_EPSILON)
  if (index < 0) throw new Error('Beam node was not found.')
  return index
}

function cleanZero(value: number): number {
  return Math.abs(value) < 1e-8 ? 0 : value
}
