import { GRAVITY } from './solver'
import type { CalculationResult, TrussModel } from './types'

interface Props { model: TrussModel; result: CalculationResult }

const WIDTH = 1100
const LEFT = 62
const RIGHT = 1038
const TRUSS_Y = 230

export function TrussDiagram({ model, result }: Props) {
  const scaleX = (position: number) => LEFT + position / model.length * (RIGHT - LEFT)
  const maxLoad = Math.max(1, ...model.loads.map((load) => load.massKg))
  const maxReaction = Math.max(1, ...result.hangers.map((hanger) => hanger.reactionN))
  const maxMoment = Math.max(1, ...result.momentDiagram.map((point) => Math.abs(point.momentNm)))
  const momentPath = result.momentDiagram.map((point, index) => `${index ? 'L' : 'M'} ${scaleX(point.x)} ${440 + point.momentNm / maxMoment * 62}`).join(' ')
  const ticks = Array.from({ length: 6 }, (_, index) => model.length * index / 5)

  return (
    <svg className="truss-diagram" viewBox="0 0 1100 565" role="img" aria-labelledby="diagram-title diagram-description">
      <title id="diagram-title">Truss load distribution</title>
      <desc id="diagram-description">A scaled side view showing point loads, active and slack hanging points, center of mass, maximum bending moment, and the bending moment diagram.</desc>
      <defs>
        <marker id="arrow-down" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#ff765f" /></marker>
        <marker id="arrow-up" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#2dd4aa" /></marker>
        <pattern id="truss-pattern" width="48" height="34" patternUnits="userSpaceOnUse"><path d="M0 32 L24 2 L48 32 M0 2 L24 32 L48 2" fill="none" stroke="#8da7a0" strokeWidth="1.5" /></pattern>
      </defs>

      <text x={LEFT} y="28" className="svg-kicker">HANGER REACTIONS</text>
      <line x1={LEFT} x2={RIGHT} y1={TRUSS_Y + 24} y2={TRUSS_Y + 24} className="distribution-line" />
      {Array.from({ length: 24 }, (_, index) => {
        const x = LEFT + (RIGHT - LEFT) * index / 23
        return <line key={index} x1={x} x2={x} y1={TRUSS_Y + 26} y2={TRUSS_Y + 48} className="distribution-tick" markerEnd="url(#arrow-down)" />
      })}
      <text x={RIGHT} y={TRUSS_Y + 67} textAnchor="end" className="svg-label">SELF-WEIGHT · {model.massPerMeter} kg/m</text>

      {model.loads.map((load, index) => {
        const x = scaleX(load.position)
        const height = 48 + load.massKg / maxLoad * 50
        return <g key={load.id}>
          <line x1={x} x2={x} y1={TRUSS_Y + 21} y2={TRUSS_Y + 21 + height} className="load-arrow" markerEnd="url(#arrow-down)" />
          <text x={x} y={TRUSS_Y + 41 + height} textAnchor="middle" className="svg-name">{load.name || `Load ${index + 1}`}</text>
          <text x={x} y={TRUSS_Y + 55 + height} textAnchor="middle" className="svg-value">{round(load.massKg)} kg · {round(load.position)} m</text>
        </g>
      })}

      <rect x={LEFT} y={TRUSS_Y - 16} width={RIGHT - LEFT} height="32" rx="2" fill="url(#truss-pattern)" stroke="#b8cbc6" strokeWidth="2" />
      <line x1={LEFT} x2={RIGHT} y1={TRUSS_Y - 16} y2={TRUSS_Y - 16} className="beam-edge" />
      <line x1={LEFT} x2={RIGHT} y1={TRUSS_Y + 16} y2={TRUSS_Y + 16} className="beam-edge" />

      {result.hangers.map((hanger, index) => {
        const x = scaleX(hanger.position)
        const height = 36 + hanger.reactionN / maxReaction * 32
        return <g key={hanger.id} className={hanger.slack ? 'hanger slack' : 'hanger'}>
          <line x1={x} x2={x} y1={TRUSS_Y - 92} y2={TRUSS_Y - 21} className="hanger-line" />
          {!hanger.slack && <line x1={x} x2={x} y1={TRUSS_Y - 24} y2={TRUSS_Y - 24 - height} className="reaction-arrow" markerEnd="url(#arrow-up)" />}
          <circle cx={x} cy={TRUSS_Y - 17} r="7" />
          <text x={x} y={TRUSS_Y - 110} textAnchor="middle" className="svg-name">H{index + 1}{hanger.slack ? ' · SLACK' : ''}</text>
          <text x={x} y={TRUSS_Y - 96} textAnchor="middle" className="svg-value">{round(hanger.reactionN / 1000)} kN / {round(hanger.reactionN / GRAVITY)} kg</text>
        </g>
      })}

      {result.centerOfMass != null && <g className="com-marker" transform={`translate(${scaleX(result.centerOfMass)} 0)`}>
        <line y1="180" y2="265" />
        <circle cy="184" r="12" /><path d="M-12 184h24M0 172v24" />
        <text y="160" textAnchor="middle">CENTER OF MASS · {round(result.centerOfMass)} m</text>
      </g>}

      <line x1={LEFT} x2={RIGHT} y1="440" y2="440" className="moment-axis" />
      <path d={momentPath} className="moment-area" />
      <line x1={scaleX(result.maxMomentPosition)} x2={scaleX(result.maxMomentPosition)} y1="423" y2="457" className="stress-line" />
      <circle cx={scaleX(result.maxMomentPosition)} cy={440 + result.maxMomentNm / maxMoment * 62} r="5" className="stress-point" />
      <text x={LEFT} y="410" className="svg-kicker">BENDING MOMENT</text>
      <text x={RIGHT} y="410" textAnchor="end" className="svg-label">MAX |M| {round(Math.abs(result.maxMomentNm) / 1000)} kN·m AT {round(result.maxMomentPosition)} m</text>

      {ticks.map((position) => <g key={position}><line x1={scaleX(position)} x2={scaleX(position)} y1="532" y2="540" className="scale-tick" /><text x={scaleX(position)} y="558" textAnchor="middle" className="svg-value">{round(position)} m</text></g>)}
      <line x1={LEFT} x2={RIGHT} y1="532" y2="532" className="scale-line" />
    </svg>
  )
}

function round(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
}
