import { useEffect, useMemo, useState } from 'react'
import { TrussDiagram } from './TrussDiagram'
import { defaultModel, newHanger, newLoad, validateModel } from './model'
import { calculateTruss, GRAVITY } from './solver'
import type { TrussModel } from './types'
import { parseModel, serializeModel } from './urlState'

const initial = parseModel(window.location.search)

export default function App() {
  const [model, setModel] = useState<TrussModel>(initial.model)
  const [linkWarning, setLinkWarning] = useState<string | null>(initial.warning)
  const [copied, setCopied] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const errors = useMemo(() => validateModel(model), [model])
  const result = useMemo(() => errors.length ? null : calculateTruss(model), [model, errors.length])

  useEffect(() => {
    if (errors.length) return
    const query = serializeModel(model)
    window.history.replaceState(null, '', `${window.location.pathname}?${query}${window.location.hash}`)
  }, [model, errors.length])

  const patchModel = (patch: Partial<TrussModel>) => {
    setLinkWarning(null)
    setModel((current) => ({ ...current, ...patch }))
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const reset = () => {
    setLinkWarning(null)
    setModel(defaultModel())
  }

  const exportPdf = async () => {
    if (!result || errors.length || generatingPdf) return
    setGeneratingPdf(true)
    setPdfError(null)
    const reportWindow = window.open('', '_blank')
    if (reportWindow) {
      reportWindow.opener = null
      reportWindow.document.title = 'Generating truss report…'
      reportWindow.document.body.innerHTML = '<p style="font:16px system-ui;padding:24px">Generating truss report…</p>'
    }
    try {
      const { generatePdfReport } = await import('./pdfReport')
      const { blob, filename } = await generatePdfReport(model, result, {
        sourceUrl: window.location.href,
        generatedAt: new Date(),
      })
      const blobUrl = URL.createObjectURL(blob)
      if (reportWindow) {
        reportWindow.location.replace(blobUrl)
      } else {
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
      }
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } catch (error) {
      reportWindow?.close()
      setPdfError(error instanceof Error ? error.message : 'The PDF could not be generated.')
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <main>
      <header className="hero shell">
        <div>
          <p className="eyebrow">Static load planning</p>
          <h1>Truss load calculator</h1>
          <p className="intro">Place the weight. Set the hangers. See how the load travels.</p>
        </div>
        <div className="header-actions">
          <button className="button secondary" onClick={exportPdf} disabled={!result || errors.length > 0 || generatingPdf}>{generatingPdf ? 'Generating…' : 'Export PDF'}</button>
          <button className="button outline" onClick={copyLink} disabled={errors.length > 0}>{copied ? 'Link copied' : 'Copy link'}</button>
          <button className="button ghost" onClick={reset}>Reset</button>
        </div>
      </header>

      <div className="shell workspace">
        {(linkWarning || pdfError || errors.length > 0 || result?.warning) && (
          <div className="alerts" role="alert">
            {linkWarning && <p>{linkWarning}</p>}
            {pdfError && <p>PDF export failed: {pdfError}</p>}
            {errors.map((error) => <p key={error}>{error}</p>)}
            {result?.warning && <p>{result.warning}</p>}
          </div>
        )}

        <section className="panel setup-panel" aria-labelledby="setup-title">
          <div className="section-heading">
            <div>
              <p className="step">01</p>
              <h2 id="setup-title">Truss setup</h2>
            </div>
            <p>Uniform beam properties</p>
          </div>
          <div className="setup-grid">
            <NumberField label="Truss length" value={model.length} unit="m" min={0.001} onChange={(length) => patchModel({ length })} />
            <NumberField label="Linear mass" value={model.massPerMeter} unit="kg/m" min={0} onChange={(massPerMeter) => patchModel({ massPerMeter })} />
            <div className="derived-field">
              <span>Total truss mass</span>
              <strong>{format(model.length * model.massPerMeter, 1)} <small>kg</small></strong>
            </div>
          </div>
          <div className="report-fields">
            <label className="field text-field">
              <span>Report title <small>optional</small></span>
              <input maxLength={100} placeholder="Truss Load Report" value={model.reportTitle} onChange={(event) => patchModel({ reportTitle: event.target.value })} />
            </label>
            <label className="field text-field">
              <span>Report notes <small>optional · {model.reportNotes.length}/2000</small></span>
              <textarea maxLength={2000} placeholder="Project details, assumptions, or review notes…" value={model.reportNotes} onChange={(event) => patchModel({ reportNotes: event.target.value })} />
            </label>
          </div>
        </section>

        <section className="panel" aria-labelledby="loads-title">
          <div className="section-heading">
            <div><p className="step">02</p><h2 id="loads-title">Point loads</h2></div>
            <button className="button add" onClick={() => patchModel({ loads: [...model.loads, newLoad(model.length, model.loads.length)] })}>+ Add load</button>
          </div>
          {model.loads.length === 0 ? (
            <EmptyState title="No point loads yet" detail="The truss self-weight is still included in the calculation." />
          ) : (
            <div className="rows" aria-label="Point loads">
              {model.loads.map((load, index) => (
                <div className="data-row load-row" key={load.id}>
                  <span className="row-index">{String(index + 1).padStart(2, '0')}</span>
                  <label className="field text-field"><span>Name</span><input value={load.name} onChange={(event) => patchModel({ loads: model.loads.map((item) => item.id === load.id ? { ...item, name: event.target.value } : item) })} /></label>
                  <NumberField compact label="Position" value={load.position} unit="m" min={0} max={model.length} onChange={(position) => patchModel({ loads: model.loads.map((item) => item.id === load.id ? { ...item, position } : item) })} />
                  <NumberField compact label="Mass" value={load.massKg} unit="kg" min={0} onChange={(massKg) => patchModel({ loads: model.loads.map((item) => item.id === load.id ? { ...item, massKg } : item) })} />
                  <button className="icon-button" aria-label={`Remove ${load.name}`} onClick={() => patchModel({ loads: model.loads.filter((item) => item.id !== load.id) })}>×</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel" aria-labelledby="hangers-title">
          <div className="section-heading">
            <div><p className="step">03</p><h2 id="hangers-title">Hanging points</h2></div>
            <button className="button add" onClick={() => patchModel({ hangers: [...model.hangers, newHanger(model.length, model.hangers.length)] })}>+ Add hanger</button>
          </div>
          <div className="rows" aria-label="Hanging points">
            {model.hangers.map((hanger, index) => {
              const hangerResult = result?.hangers.find((item) => item.id === hanger.id)
              return (
                <div className="data-row hanger-row" key={hanger.id}>
                  <span className="hanger-dot" aria-hidden="true" />
                  <strong className="hanger-name">Hanger {index + 1}</strong>
                  <NumberField compact label="Position" value={hanger.position} unit="m" min={0} max={model.length} onChange={(position) => patchModel({ hangers: model.hangers.map((item) => item.id === hanger.id ? { ...item, position } : item) })} />
                  <div className={`reaction ${hangerResult?.slack ? 'slack' : ''}`}>
                    <span>{hangerResult?.slack ? 'Slack' : 'Reaction'}</span>
                    <strong>{hangerResult ? format(hangerResult.reactionN / 1000, 2) : '—'} kN</strong>
                    <small>{hangerResult ? `${format(hangerResult.reactionN / GRAVITY, 1)} kg eq.` : 'Awaiting valid setup'}</small>
                  </div>
                  <button className="icon-button" aria-label={`Remove hanger ${index + 1}`} onClick={() => patchModel({ hangers: model.hangers.filter((item) => item.id !== hanger.id) })}>×</button>
                </div>
              )
            })}
          </div>
        </section>

        <section className="results" aria-labelledby="results-title">
          <div className="results-heading"><p className="eyebrow">Live analysis</p><h2 id="results-title">Load distribution</h2></div>
          <div className="metrics">
            <Metric label="Total applied mass" value={result ? format(result.totalMassKg, 1) : '—'} unit="kg" />
            <Metric label="Total downward force" value={result ? format(result.totalForceN / 1000, 2) : '—'} unit="kN" />
            <Metric label="Center of mass" value={result?.centerOfMass != null ? format(result.centerOfMass, 2) : '—'} unit="m" accent />
            <Metric label="Max. |bending moment|" value={result ? format(Math.abs(result.maxMomentNm) / 1000, 2) : '—'} unit="kN·m" accent detail={result ? `at ${format(result.maxMomentPosition, 2)} m` : undefined} />
          </div>
          <div className="diagram-card">
            {result ? <TrussDiagram model={model} result={result} /> : <EmptyState title="Complete a valid setup" detail="The diagram and results will update automatically." />}
          </div>
        </section>

        <aside className="notice">
          <span aria-hidden="true">!</span>
          <p><strong>Planning estimate only.</strong> This model assumes a straight, uniform beam and static vertical loads. It does not check member, connection, hoist, or truss capacities. Have a qualified professional verify any rigging or structural design.</p>
        </aside>
      </div>
      <footer className="shell">Euler–Bernoulli beam model <span>•</span> Standard gravity 9.80665 m/s² <span>•</span> Inputs stored in this URL</footer>
    </main>
  )
}

interface NumberFieldProps { label: string; value: number; unit: string; min?: number; max?: number; compact?: boolean; onChange: (value: number) => void }

function NumberField({ label, value, unit, min, max, compact, onChange }: NumberFieldProps) {
  return (
    <label className={`field number-field ${compact ? 'compact' : ''}`}>
      <span>{label}</span>
      <div><input type="number" step="any" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} /><b>{unit}</b></div>
    </label>
  )
}

function Metric({ label, value, unit, detail, accent }: { label: string; value: string; unit: string; detail?: string; accent?: boolean }) {
  return <article className={`metric ${accent ? 'accent' : ''}`}><span>{label}</span><strong>{value} <small>{unit}</small></strong>{detail && <p>{detail}</p>}</article>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty"><strong>{title}</strong><span>{detail}</span></div>
}

function format(value: number, digits: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
}
