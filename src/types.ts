export interface PointLoad {
  id: string
  name: string
  position: number
  massKg: number
}

export interface Hanger {
  id: string
  position: number
}

export interface TrussModel {
  length: number
  massPerMeter: number
  loads: PointLoad[]
  hangers: Hanger[]
}

export interface HangerResult {
  id: string
  position: number
  reactionN: number
  slack: boolean
}

export interface DiagramPoint {
  x: number
  momentNm: number
}

export interface CalculationResult {
  totalMassKg: number
  totalForceN: number
  centerOfMass: number | null
  hangers: HangerResult[]
  maxMomentNm: number
  maxMomentPosition: number
  momentDiagram: DiagramPoint[]
  warning: string | null
}
