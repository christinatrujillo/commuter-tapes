import type { DiagramSpec } from '../music/chordShapes'
import { PAPER_HIGHLIGHT, PAPER_RUST } from '../lib/color'

const INK = '#1d1916'
const PAPER = '#f6eedc'
const LEFT = 26
const TOP = 26
const STRING_GAP = 16
const FRET_GAP = 22

/**
 * A chord diagram, the way chord books draw them: the neck standing up, low E string on the left,
 * the nut (or the starting fret) at the top, a dot where each finger goes. Ink on cream paper.
 */
export function ChordDiagram({ shape, dots, names, roots = [], mark = null }: DiagramSpec) {
  const fretted = shape.frets.filter((f) => f > 0)
  const highest = Math.max(0, ...fretted)
  // Near the nut, start at fret 1; higher up, start at the shape's lowest fret and say which it is.
  const base = highest <= 4 ? 1 : Math.min(...fretted)
  const rows = Math.max(4, highest - base + 1)
  const width = LEFT + STRING_GAP * 5 + 14
  const height = TOP + FRET_GAP * rows + (names ? 22 : 8)
  const x = (string: number) => LEFT + string * STRING_GAP
  const y = (fret: number) => TOP + (fret - base + 0.5) * FRET_GAP
  // A barre: the first finger pressing two or more strings at the same fret.
  const barreStrings = shape.frets.map((f, s) => (shape.fingers[s] === 1 && f > 0 ? s : -1)).filter((s) => s >= 0)
  const barreFret = barreStrings.length > 1 && barreStrings.every((s) => shape.frets[s] === shape.frets[barreStrings[0]]) ? shape.frets[barreStrings[0]] : null

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      role="img"
      aria-label="Chord diagram"
      data-frets={shape.frets.join(',')}
      data-mark={mark ?? ''}
    >
      {/* Frets across, strings down; a thick nut at the top when the shape starts there. */}
      {Array.from({ length: rows + 1 }, (_, i) => (
        <line key={`f${i}`} x1={x(0)} x2={x(5)} y1={TOP + i * FRET_GAP} y2={TOP + i * FRET_GAP} stroke={INK} strokeWidth={i === 0 && base === 1 ? 4 : 1} />
      ))}
      {Array.from({ length: 6 }, (_, s) => (
        <line key={`s${s}`} x1={x(s)} x2={x(s)} y1={TOP} y2={TOP + rows * FRET_GAP} stroke={INK} strokeWidth={1} />
      ))}
      {base > 1 && (
        <text x={LEFT - 8} y={y(base) + 4} fontSize={10} textAnchor="end" className="font-typed" fill={INK}>
          {base}fr
        </text>
      )}
      {/* Above each string: ○ to play it open, × to leave it out. */}
      {shape.frets.map((f, s) =>
        f <= 0 ? (
          <text key={`o${s}`} x={x(s)} y={TOP - 8} fontSize={11} textAnchor="middle" fill={INK}>
            {f === 0 ? '○' : '×'}
          </text>
        ) : null,
      )}
      {barreFret !== null && (
        <rect
          x={x(barreStrings[0]) - 6}
          y={y(barreFret) - 6}
          width={x(barreStrings[barreStrings.length - 1]) - x(barreStrings[0]) + 12}
          height={12}
          rx={6}
          fill={INK}
        />
      )}
      {shape.frets.map((f, s) => {
        if (f <= 0) return null
        const root = roots.includes(s)
        const label = dots?.[s] ?? shape.fingers[s]?.toString() ?? ''
        return (
          <g key={`d${s}`}>
            <circle cx={x(s)} cy={y(f)} r={6.5} fill={root ? PAPER_HIGHLIGHT : INK} />
            {mark === s && <circle cx={x(s)} cy={y(f)} r={9.5} fill="none" stroke={PAPER_RUST} strokeWidth={1.8} />}
            <text x={x(s)} y={y(f) + 3.5} fontSize={9} textAnchor="middle" fontWeight={700} fill={root ? INK : PAPER}>
              {label}
            </text>
          </g>
        )
      })}
      {names?.map((n, s) =>
        n ? (
          <text key={`n${s}`} x={x(s)} y={TOP + rows * FRET_GAP + 15} fontSize={9} textAnchor="middle" className="font-typed" fill={INK}>
            {n}
          </text>
        ) : null,
      )}
    </svg>
  )
}
