import { describe, expect, it } from 'vitest'
import { defaultModel, makeId } from './model'
import { generatePdfReport } from './pdfReport'
import { calculateTruss } from './solver'

describe('PDF report generation', () => {
  it('creates a multi-page A4 report blob', async () => {
    const model = defaultModel()
    model.reportTitle = 'Touring truss calculation'
    model.reportNotes = 'Review all hanging points before installation.'
    model.loads = [
      { id: makeId('load'), name: 'LED wall', position: 2.5, massKg: 240 },
      { id: makeId('load'), name: 'Audio cluster', position: 7.5, massKg: 180 },
    ]
    const generated = await generatePdfReport(model, calculateTruss(model), {
      sourceUrl: 'https://example.test/truss/?v=1',
      generatedAt: new Date('2026-09-08T10:00:00.000Z'),
    })
    const bytes = new Uint8Array(await generated.blob.arrayBuffer())
    const signature = String.fromCharCode(...bytes.slice(0, 5))

    expect(generated.filename).toBe('touring-truss-calculation-2026-09-08.pdf')
    expect(generated.blob.type).toBe('application/pdf')
    expect(signature).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(5_000)
  })

  it('paginates a long input report without failing', async () => {
    const model = defaultModel()
    model.reportNotes = 'Detailed planning note. '.repeat(80)
    model.loads = Array.from({ length: 45 }, (_, index) => ({
      id: makeId('load'),
      name: `Fixture ${index + 1}`,
      position: index / 44 * model.length,
      massKg: 10 + index,
    }))
    const generated = await generatePdfReport(model, calculateTruss(model), {
      sourceUrl: 'https://example.test/truss/?v=1',
      generatedAt: new Date('2026-09-08T10:00:00.000Z'),
    })
    expect(generated.blob.size).toBeGreaterThan(10_000)
  })
})
