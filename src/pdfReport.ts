import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { buildPdfReportData, type PdfReportOptions } from './reportData'
import { GRAVITY } from './solver'
import type { CalculationResult, TrussModel } from './types'

const PAGE_WIDTH = 297
const PAGE_HEIGHT = 210
const MARGIN = 14
const GREEN: [number, number, number] = [18, 112, 88]
const DARK: [number, number, number] = [29, 43, 39]
const MUTED: [number, number, number] = [102, 119, 114]
const ORANGE: [number, number, number] = [218, 91, 70]
const PALE: [number, number, number] = [238, 244, 242]

type PdfWithTable = jsPDF & { lastAutoTable?: { finalY: number } }

export async function generatePdfReport(
  model: TrussModel,
  result: CalculationResult,
  options: PdfReportOptions,
): Promise<{ blob: Blob; filename: string }> {
  const data = buildPdfReportData(model, result, options)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true }) as PdfWithTable
  doc.setProperties({
    title: data.title,
    subject: 'Truss load distribution calculation',
    author: 'Truss Load Calculator',
    creator: 'Truss Load Calculator',
  })

  drawTitle(doc, data.title, data.generatedAt)
  let y = 34
  if (result.warning) y = drawWarning(doc, result.warning, y)

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'plain',
    head: [['Total mass', 'Downward force', 'Center of mass', 'Max. |moment|']],
    body: [[
      `${result.totalMassKg.toFixed(1)} kg`,
      `${(result.totalForceN / 1000).toFixed(3)} kN`,
      result.centerOfMass == null ? 'Unavailable' : `${result.centerOfMass.toFixed(3)} m`,
      `${(Math.abs(result.maxMomentNm) / 1000).toFixed(3)} kN·m at ${result.maxMomentPosition.toFixed(3)} m`,
    ]],
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, textColor: DARK },
    headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: 'bold' },
    bodyStyles: { fillColor: PALE },
  })
  y = (doc.lastAutoTable?.finalY ?? y + 18) + 7
  drawStructuralDiagram(doc, model, result, y, 82)

  doc.addPage()
  y = 24
  if (data.notes) {
    y = drawSectionHeading(doc, 'Project notes', y)
    y = drawWrappedText(doc, data.notes, y, PAGE_WIDTH - MARGIN * 2, 4.5) + 5
  }

  y = ensureSpace(doc, y, 30)
  y = drawSectionHeading(doc, 'Truss inputs', y)
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    head: [['Length', 'Linear mass', 'Truss self-mass', 'Standard gravity']],
    body: [[`${model.length} m`, `${model.massPerMeter} kg/m`, `${data.totalTrussMassKg.toFixed(3)} kg`, `${GRAVITY} m/s²`]],
    ...tableStyle(),
  })
  y = (doc.lastAutoTable?.finalY ?? y + 16) + 7

  y = ensureSpace(doc, y, 34)
  y = drawSectionHeading(doc, 'Point loads', y)
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    head: [['#', 'Name', 'Position (m)', 'Mass (kg)']],
    body: data.loads.length ? data.loads : [['—', 'No point loads', '—', '—']],
    columnStyles: { 0: { cellWidth: 14 }, 2: { cellWidth: 36 }, 3: { cellWidth: 36 } },
    ...tableStyle(),
  })
  y = (doc.lastAutoTable?.finalY ?? y + 16) + 7

  y = ensureSpace(doc, y, 34)
  y = drawSectionHeading(doc, 'Hanging-point reactions', y)
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    head: [['Point', 'Position (m)', 'Status', 'Reaction (kN)', 'Reaction (kg eq.)']],
    body: data.hangers,
    ...tableStyle(),
  })
  y = (doc.lastAutoTable?.finalY ?? y + 16) + 8

  y = ensureSpace(doc, y, 52)
  y = drawSectionHeading(doc, 'Calculation', y)
  for (const line of data.calculations) {
    const lines = doc.splitTextToSize(normalizePdfText(line), PAGE_WIDTH - MARGIN * 2)
    if (y + lines.length * 4.3 > PAGE_HEIGHT - 18) {
      doc.addPage()
      y = 24
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...DARK)
    doc.text(lines, MARGIN, y)
    y += lines.length * 4.3 + 2
  }

  y = ensureSpace(doc, y + 4, 43)
  y = drawSectionHeading(doc, 'Model assumptions and limitations', y)
  const assumptions = [
    'Straight, horizontal, prismatic truss represented as a uniform Euler–Bernoulli beam.',
    'Static vertical loads only; hangers have equal elevation and provide upward tension only.',
    'The maximum bending moment is a stress proxy. Member stress requires section, material, and truss geometry.',
    'Dynamic effects, load factors, lateral forces, torsion, connections, hoist capacity, and code compliance are excluded.',
  ]
  assumptions.forEach((line) => {
    doc.setFontSize(8.5)
    doc.text(`•  ${normalizePdfText(line)}`, MARGIN + 1, y)
    y += 5
  })
  doc.setFillColor(255, 244, 229)
  doc.setDrawColor(...ORANGE)
  doc.roundedRect(MARGIN, y + 1, PAGE_WIDTH - MARGIN * 2, 14, 2, 2, 'FD')
  doc.setTextColor(...ORANGE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text('PLANNING ESTIMATE ONLY', MARGIN + 4, y + 6)
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'normal')
  doc.text('Have a qualified professional verify any rigging or structural design.', MARGIN + 4, y + 11)

  addPageFurniture(doc, data.title, data.sourceUrl)
  return { blob: doc.output('blob'), filename: data.filename }
}

function drawTitle(doc: jsPDF, title: string, generatedAt: string) {
  doc.setFillColor(...DARK)
  doc.rect(0, 0, PAGE_WIDTH, 29, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(21)
  doc.text(normalizePdfText(title), MARGIN, 15)
  doc.setTextColor(173, 213, 202)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`TRUSS LOAD CALCULATION  •  Generated ${normalizePdfText(generatedAt)}`, MARGIN, 22)
}

function drawWarning(doc: jsPDF, warning: string, y: number): number {
  doc.setFillColor(255, 241, 238)
  doc.setDrawColor(...ORANGE)
  doc.roundedRect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, 12, 2, 2, 'FD')
  doc.setTextColor(...ORANGE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(normalizePdfText(warning), MARGIN + 4, y + 7.5)
  return y + 17
}

function drawStructuralDiagram(doc: jsPDF, model: TrussModel, result: CalculationResult, y: number, height: number) {
  const x0 = MARGIN + 7
  const width = PAGE_WIDTH - MARGIN * 2 - 14
  const beamY = y + 27
  const sx = (position: number) => x0 + position / model.length * width

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...GREEN)
  doc.text('LOAD AND REACTION MAP', MARGIN, y)
  doc.setDrawColor(124, 145, 139)
  doc.setLineWidth(1.2)
  doc.line(x0, beamY, x0 + width, beamY)
  doc.setLineWidth(0.25)
  for (let index = 0; index <= 24; index += 1) {
    const x = x0 + width * index / 24
    drawArrow(doc, x, beamY + 1, x, beamY + 7, MUTED)
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...MUTED)
  doc.text(`Self-weight ${model.massPerMeter} kg/m`, x0 + width, beamY + 11, { align: 'right' })

  const maxMass = Math.max(1, ...model.loads.map((load) => load.massKg))
  model.loads.forEach((load) => {
    const x = sx(load.position)
    const arrowLength = 11 + load.massKg / maxMass * 7
    drawArrow(doc, x, beamY + 1, x, beamY + arrowLength, ORANGE)
    doc.setTextColor(...ORANGE)
    doc.setFontSize(6)
    doc.text(`${normalizePdfText(load.name)} · ${load.massKg} kg`, x, beamY + arrowLength + 4, { align: 'center' })
  })

  result.hangers.forEach((hanger, index) => {
    const x = sx(hanger.position)
    if (!hanger.slack) drawArrow(doc, x, beamY - 1, x, beamY - 15, GREEN)
    doc.setFillColor(...(hanger.slack ? ORANGE : GREEN))
    doc.circle(x, beamY, 1.4, 'F')
    doc.setFontSize(6)
    doc.setTextColor(...(hanger.slack ? ORANGE : GREEN))
    doc.text(`H${index + 1} ${hanger.slack ? 'slack' : `${(hanger.reactionN / 1000).toFixed(2)} kN`}`, x, beamY - 18, { align: 'center' })
  })

  if (result.centerOfMass != null) {
    const x = sx(result.centerOfMass)
    doc.setDrawColor(181, 137, 24)
    doc.setLineDashPattern([1, 1], 0)
    doc.line(x, beamY - 4, x, beamY + 22)
    doc.setLineDashPattern([], 0)
    doc.setTextColor(181, 137, 24)
    doc.setFontSize(6)
    doc.text(`COM ${result.centerOfMass.toFixed(2)} m`, x, beamY + 25, { align: 'center' })
  }

  const axisY = y + height - 13
  const maxMoment = Math.max(1, ...result.momentDiagram.map((point) => Math.abs(point.momentNm)))
  doc.setDrawColor(...MUTED)
  doc.line(x0, axisY, x0 + width, axisY)
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(0.65)
  result.momentDiagram.forEach((point, index) => {
    if (!index) return
    const previous = result.momentDiagram[index - 1]
    doc.line(sx(previous.x), axisY + previous.momentNm / maxMoment * 9, sx(point.x), axisY + point.momentNm / maxMoment * 9)
  })
  doc.setFontSize(6.5)
  doc.setTextColor(...MUTED)
  doc.text('Bending moment', x0, axisY - 12)
  doc.text(`Max |M| ${(Math.abs(result.maxMomentNm) / 1000).toFixed(3)} kN·m at ${result.maxMomentPosition.toFixed(3)} m`, x0 + width, axisY - 12, { align: 'right' })
}

function drawArrow(doc: jsPDF, x1: number, y1: number, x2: number, y2: number, color: [number, number, number]) {
  doc.setDrawColor(...color)
  doc.setFillColor(...color)
  doc.setLineWidth(0.45)
  doc.line(x1, y1, x2, y2)
  const direction = y2 >= y1 ? 1 : -1
  doc.triangle(x2, y2, x2 - 1.3, y2 - direction * 2.4, x2 + 1.3, y2 - direction * 2.4, 'F')
}

function drawSectionHeading(doc: jsPDF, text: string, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...GREEN)
  doc.text(text.toUpperCase(), MARGIN, y)
  doc.setDrawColor(196, 209, 205)
  doc.line(MARGIN, y + 2, PAGE_WIDTH - MARGIN, y + 2)
  return y + 7
}

function drawWrappedText(doc: jsPDF, text: string, y: number, width: number, lineHeight: number): number {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...DARK)
  const lines = doc.splitTextToSize(normalizePdfText(text), width)
  for (const line of lines) {
    if (y > PAGE_HEIGHT - 18) {
      doc.addPage()
      y = 24
    }
    doc.text(line, MARGIN, y)
    y += lineHeight
  }
  return y
}

function ensureSpace(doc: jsPDF, y: number, required: number): number {
  if (y + required <= PAGE_HEIGHT - 15) return y
  doc.addPage()
  return 24
}

function tableStyle() {
  return {
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, textColor: DARK },
    headStyles: { fillColor: GREEN, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const },
    alternateRowStyles: { fillColor: PALE },
  }
}

function addPageFurniture(doc: jsPDF, title: string, sourceUrl: string) {
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    if (page > 1) {
      doc.setTextColor(...DARK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(normalizePdfText(title), MARGIN, 10)
      doc.setTextColor(...MUTED)
      doc.setFont('helvetica', 'normal')
      doc.text('PLANNING ESTIMATE', PAGE_WIDTH - MARGIN, 10, { align: 'right' })
      doc.setDrawColor(210, 220, 217)
      doc.line(MARGIN, 13, PAGE_WIDTH - MARGIN, 13)
    }
    doc.setDrawColor(210, 220, 217)
    doc.line(MARGIN, PAGE_HEIGHT - 10, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10)
    doc.setTextColor(...MUTED)
    doc.setFontSize(6.5)
    doc.textWithLink('Open source configuration', MARGIN, PAGE_HEIGHT - 5.5, { url: sourceUrl })
    doc.text(`Page ${page} of ${pages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 5.5, { align: 'right' })
  }
}

function normalizePdfText(text: string): string {
  return text.replace(/[–—]/g, '-').replace(/×/g, 'x').replace(/Σ/g, 'Sum ').replace(/−/g, '-').replace(/²/g, '^2').replace(/·/g, ' / ')
}
