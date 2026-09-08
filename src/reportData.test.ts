import { describe, expect, it } from 'vitest'
import { defaultModel } from './model'
import { buildPdfReportData } from './reportData'
import { calculateTruss } from './solver'

describe('PDF report data', () => {
  it('builds traceable calculations and an equilibrium check', () => {
    const model = defaultModel()
    model.reportTitle = 'Vienna Main Stage'
    model.reportNotes = 'Preliminary layout'
    model.loads = [{ id: 'load', name: 'Video wall', position: 3, massKg: 250 }]
    const result = calculateTruss(model)
    const data = buildPdfReportData(model, result, {
      sourceUrl: 'https://example.test/truss/?v=1',
      generatedAt: new Date('2026-09-08T10:00:00.000Z'),
    })

    expect(data.title).toBe('Vienna Main Stage')
    expect(data.filename).toBe('vienna-main-stage-2026-09-08.pdf')
    expect(data.loads[0]).toEqual(['1', 'Video wall', '3.000', '250.00'])
    expect(data.totalReactionN).toBeCloseTo(result.totalForceN, 7)
    expect(data.equilibriumResidualN).toBeCloseTo(0, 7)
    expect(data.calculations).toEqual(expect.arrayContaining([
      expect.stringMatching(/Center of mass/),
      expect.stringMatching(/Vertical equilibrium/),
      expect.stringMatching(/Maximum absolute bending moment/),
    ]))
  })

  it('uses a safe default report title and filename', () => {
    const model = defaultModel()
    const data = buildPdfReportData(model, calculateTruss(model), {
      sourceUrl: 'https://example.test/truss/',
      generatedAt: new Date('2026-09-08T10:00:00.000Z'),
    })
    expect(data.title).toBe('Truss Load Report')
    expect(data.filename).toBe('truss-load-report-2026-09-08.pdf')
  })
})
