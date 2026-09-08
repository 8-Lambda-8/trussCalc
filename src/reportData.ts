import { GRAVITY } from './solver'
import type { CalculationResult, TrussModel } from './types'

export interface PdfReportData {
  title: string
  filename: string
  generatedAt: string
  sourceUrl: string
  notes: string
  totalTrussMassKg: number
  totalReactionN: number
  equilibriumResidualN: number
  loads: Array<[string, string, string, string]>
  hangers: Array<[string, string, string, string, string]>
  calculations: string[]
}

export interface PdfReportOptions {
  sourceUrl: string
  generatedAt: Date
}

export function buildPdfReportData(model: TrussModel, result: CalculationResult, options: PdfReportOptions): PdfReportData {
  const title = model.reportTitle.trim() || 'Truss Load Report'
  const totalTrussMassKg = model.length * model.massPerMeter
  const totalReactionN = result.hangers.reduce((sum, hanger) => sum + hanger.reactionN, 0)
  const equilibriumResidualN = totalReactionN - result.totalForceN
  const date = options.generatedAt.toISOString().slice(0, 10)

  return {
    title,
    filename: `${slugify(title) || 'truss-load-report'}-${date}.pdf`,
    generatedAt: options.generatedAt.toLocaleString(),
    sourceUrl: options.sourceUrl,
    notes: model.reportNotes.trim(),
    totalTrussMassKg,
    totalReactionN,
    equilibriumResidualN,
    loads: model.loads.map((load, index) => [
      String(index + 1),
      load.name,
      format(load.position, 3),
      format(load.massKg, 2),
    ]),
    hangers: model.hangers.map((hanger, index) => {
      const reaction = result.hangers.find((item) => item.id === hanger.id)
      return [
        `H${index + 1}`,
        format(hanger.position, 3),
        reaction?.slack ? 'Slack' : 'Active',
        format((reaction?.reactionN ?? 0) / 1000, 3),
        format((reaction?.reactionN ?? 0) / GRAVITY, 1),
      ]
    }),
    calculations: [
      `Standard gravity: g = ${GRAVITY} m/s²`,
      `Truss self-mass: m_t = L × μ = ${format(model.length, 3)} m × ${format(model.massPerMeter, 3)} kg/m = ${format(totalTrussMassKg, 3)} kg`,
      `Total mass: m = m_t + Σm_i = ${format(result.totalMassKg, 3)} kg`,
      `Total downward force: W = m × g = ${format(result.totalForceN / 1000, 4)} kN`,
      result.centerOfMass == null
        ? 'Center of mass: undefined because total mass is zero.'
        : `Center of mass: x̄ = (m_t × L/2 + Σm_i x_i) / m = ${format(result.centerOfMass, 4)} m`,
      'Hanger reactions: uniform Euler–Bernoulli beam finite elements, equal support elevation, normalized constant EI, with negative reactions removed by the tension-only active set.',
      `Vertical equilibrium: ΣR = ${format(totalReactionN / 1000, 4)} kN; W = ${format(result.totalForceN / 1000, 4)} kN; residual ΣR − W = ${format(equilibriumResidualN, 5)} N`,
      'Moment field: M(x) = ΣR_i(x−s_i)H(x−s_i) − ΣP_j(x−x_j)H(x−x_j) − wx²/2',
      `Maximum absolute bending moment: |M|max = ${format(Math.abs(result.maxMomentNm) / 1000, 4)} kN·m at x = ${format(result.maxMomentPosition, 4)} m`,
    ],
  }
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function format(value: number, digits: number): string {
  return value.toFixed(digits)
}
