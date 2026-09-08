import type { Hanger, PointLoad, TrussModel } from './types'

let nextId = 1

export function makeId(prefix: string): string {
  return `${prefix}-${nextId++}`
}

export function defaultModel(): TrussModel {
  return {
    length: 10,
    massPerMeter: 7.5,
    loads: [],
    hangers: [
      { id: makeId('hanger'), position: 0 },
      { id: makeId('hanger'), position: 10 },
    ],
  }
}

export function validateModel(model: TrussModel): string[] {
  const errors: string[] = []
  if (!Number.isFinite(model.length) || model.length <= 0) errors.push('Truss length must be greater than zero.')
  if (!Number.isFinite(model.massPerMeter) || model.massPerMeter < 0) errors.push('Truss mass per metre cannot be negative.')

  model.loads.forEach((load, index) => {
    if (!load.name.trim()) errors.push(`Load ${index + 1} needs a name.`)
    if (!Number.isFinite(load.massKg) || load.massKg < 0) errors.push(`${load.name || `Load ${index + 1}`} mass cannot be negative.`)
    if (!inSpan(load.position, model.length)) errors.push(`${load.name || `Load ${index + 1}`} position must be on the truss.`)
  })

  model.hangers.forEach((hanger, index) => {
    if (!inSpan(hanger.position, model.length)) errors.push(`Hanger ${index + 1} position must be on the truss.`)
  })

  if (model.hangers.length < 2) errors.push('At least two hanging points are required.')
  const positions = model.hangers.map((hanger) => hanger.position)
  if (new Set(positions.map((position) => position.toPrecision(12))).size !== positions.length) {
    errors.push('Hanging points must have unique positions.')
  }
  return errors
}

function inSpan(value: number, length: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= length
}

export function newLoad(length: number, count: number): PointLoad {
  return { id: makeId('load'), name: `Load ${count + 1}`, position: length / 2, massKg: 100 }
}

export function newHanger(length: number, count: number): Hanger {
  const position = length * ((count + 1) / (count + 2))
  return { id: makeId('hanger'), position: Number(position.toFixed(3)) }
}
