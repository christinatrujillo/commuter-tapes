import { useSyncExternalStore } from 'react'
import { MAX_FRET, STRING_LABELS, type Position } from '../music/notes'
import { useProgress } from '../store/progress'

export type MarkerTone = 'target' | 'correct' | 'wrong' | 'alt' | 'root' | 'note' | 'accidental' | 'heat'

export interface Marker {
  pos: Position
  tone: MarkerTone
  label?: string
  /** Fill color for 'heat' markers. */
  fill?: string
}

interface Props {
  minFret?: number
  maxFret?: number
  /** Strings that can be tapped; the others are dimmed. Defaults to all. */
  activeStrings?: number[]
  markers?: Marker[]
  onTap?: (pos: Position) => void
  orientation?: 'auto' | 'vertical' | 'horizontal'
  /** 'contain' fills the parent box; 'width' fills the width and grows to its natural height. */
  fit?: 'contain' | 'width'
}

const TONE_FILL: Record<Exclude<MarkerTone, 'heat'>, string> = {
  target: '#ffb547',
  correct: '#63d68b',
  wrong: '#e5483a',
  alt: '#3f9d63',
  root: '#5fc3c9',
  note: '#efe5cf',
  // Sharps and flats: dark dots ringed in cream, like the black keys of a piano.
  accidental: '#1b1512',
}
/** Lit markers glow like indicator lamps. */
const GLOWS = new Set<MarkerTone>(['target', 'correct', 'wrong', 'root'])

const STRING_WIDTH = [3.4, 2.8, 2.2, 1.8, 1.4, 1.1]
const STRING_COLOR = ['#c9a86a', '#c9a86a', '#c9a86a', '#c9a86a', '#dcdad6', '#dcdad6']
const SINGLE_INLAYS = new Set([3, 5, 7, 9, 15, 17, 19, 21])

const landscapeQuery = '(orientation: landscape)'
function subscribeOrientation(onChange: () => void) {
  const mq = window.matchMedia(landscapeQuery)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
export const useLandscape = () =>
  useSyncExternalStore(subscribeOrientation, () => window.matchMedia(landscapeQuery).matches)

export function Fretboard({
  minFret = 0,
  maxFret = MAX_FRET,
  activeStrings,
  markers = [],
  onTap,
  orientation = 'auto',
  fit = 'contain',
}: Props) {
  const landscape = useLandscape()
  const { leftHanded, highEOnTop } = useProgress((s) => s.settings)
  const vertical = orientation === 'vertical' || (orientation === 'auto' && !landscape)

  // Layout in two abstract axes: "along" the neck and "across" the strings.
  const slots = maxFret - minFret + 1
  const SLOT = vertical ? 46 : 62
  const GAP = vertical ? 54 : 40
  const alongStart = 24 // room for string names before the first slot
  const alongEnd = 6
  const acrossStart = vertical ? 30 : 6 // vertical: fret numbers on the left
  const acrossEnd = vertical ? 6 : 26 // horizontal: fret numbers underneath
  const L = alongStart + slots * SLOT + alongEnd
  const W = acrossStart + 6 * GAP + acrossEnd
  const [vbW, vbH] = vertical ? [W, L] : [L, W]

  // Vertical reads like a chord chart (low E on the left); horizontal like tab or looking down at the guitar.
  const col = (s: number) => (vertical ? (leftHanded ? 5 - s : s) : highEOnTop ? 5 - s : s)
  const flipAlong = !vertical && leftHanded
  const pt = (along: number, across: number): [number, number] => {
    const a = flipAlong ? L - along : along
    return vertical ? [across, a] : [a, across]
  }
  const boundary = (b: number) => alongStart + b * SLOT
  const slotMid = (k: number) => alongStart + (k + 0.5) * SLOT
  const stringAcross = (s: number) => acrossStart + (col(s) + 0.5) * GAP
  const boardTop = acrossStart
  const boardBottom = acrossStart + 6 * GAP

  const rect = (a1: number, a2: number, c1: number, c2: number) => {
    const [x1, y1] = pt(a1, c1)
    const [x2, y2] = pt(a2, c2)
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }
  }
  const line = (a1: number, c1: number, a2: number, c2: number) => {
    const [x1, y1] = pt(a1, c1)
    const [x2, y2] = pt(a2, c2)
    return { x1, y1, x2, y2 }
  }

  const hasOpen = minFret === 0
  const woodStart = boundary(hasOpen ? 1 : 0)
  const active = new Set(activeStrings ?? [0, 1, 2, 3, 4, 5])
  const r = Math.min(SLOT, GAP) * 0.37
  const numberAcross = vertical ? acrossStart / 2 : W - acrossEnd / 2 + 2

  const frets = Array.from({ length: slots }, (_, k) => minFret + k)

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className={fit === 'contain' ? 'block h-full w-full' : 'block h-auto w-full'}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Guitar fretboard"
    >
      {/* Rosewood board with cream binding along both edges */}
      <rect {...rect(woodStart, boundary(slots), boardTop, boardBottom)} rx={3} fill="#3f2518" />
      {[boardTop, boardBottom].map((c) => (
        <line key={c} {...line(woodStart, c, boundary(slots), c)} stroke="#e6d8b8" strokeWidth={3} />
      ))}

      {/* Inlay dots */}
      {frets.map((f, k) => {
        if (f === 12 || f === 24) {
          return [2, 4].map((c) => {
            const [cx, cy] = pt(slotMid(k), acrossStart + c * GAP)
            return <circle key={`${f}-${c}`} cx={cx} cy={cy} r={6} fill="#e8e2d6" opacity={0.8} />
          })
        }
        if (!SINGLE_INLAYS.has(f)) return null
        const [cx, cy] = pt(slotMid(k), acrossStart + 3 * GAP)
        return <circle key={f} cx={cx} cy={cy} r={6} fill="#e8e2d6" opacity={0.8} />
      })}

      {/* Frets (and the nut) */}
      {Array.from({ length: slots + 1 }, (_, b) => {
        if (hasOpen && b === 0) return null
        const isNut = hasOpen && b === 1
        return (
          <line
            key={b}
            {...line(boundary(b), boardTop, boundary(b), boardBottom)}
            stroke={isNut ? '#efe6d2' : '#b9bcc0'}
            strokeWidth={isNut ? 7 : 3}
            strokeLinecap="round"
          />
        )
      })}

      {/* Strings */}
      {[0, 1, 2, 3, 4, 5].map((s) => (
        <line
          key={s}
          {...line(boundary(0), stringAcross(s), boundary(slots), stringAcross(s))}
          stroke={STRING_COLOR[s]}
          strokeWidth={STRING_WIDTH[s]}
          opacity={active.has(s) ? 1 : 0.3}
        />
      ))}

      {/* String names at the nut end */}
      {[0, 1, 2, 3, 4, 5].map((s) => {
        const [x, y] = pt(alongStart / 2, stringAcross(s))
        return (
          <text
            key={s}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={15}
            fontWeight={800}
            className="font-label"
            fill={active.has(s) ? '#efe5cf' : '#5d5148'}
          >
            {STRING_LABELS[s]}
          </text>
        )
      })}

      {/* Fret numbers */}
      {frets.map((f, k) => {
        if (f === 0) return null
        const [x, y] = pt(slotMid(k), numberAcross)
        const landmark = SINGLE_INLAYS.has(f) || f === 12
        return (
          <text
            key={f}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={landmark ? 14 : 12}
            fontWeight={landmark ? 800 : 600}
            className="font-mono"
            fill={landmark ? '#c9bda3' : '#6b5f55'}
          >
            {f}
          </text>
        )
      })}

      {/* Tap targets */}
      {onTap &&
        [0, 1, 2, 3, 4, 5]
          .filter((s) => active.has(s))
          .flatMap((s) =>
            frets.map((f, k) => (
              <rect
                key={`${s}:${f}`}
                className="fret-hit"
                data-pos={`${s}:${f}`}
                {...rect(boundary(k), boundary(k + 1), stringAcross(s) - GAP / 2, stringAcross(s) + GAP / 2)}
                onClick={() => onTap({ string: s, fret: f })}
              />
            )),
          )}

      {/* Markers */}
      {markers
        .filter((m) => m.pos.fret >= minFret && m.pos.fret <= maxFret)
        .map((m) => {
          const [cx, cy] = pt(slotMid(m.pos.fret - minFret), stringAcross(m.pos.string))
          const fill = m.tone === 'heat' ? (m.fill ?? '#efe5cf') : TONE_FILL[m.tone]
          const plain = m.tone === 'note' || m.tone === 'accidental'
          const label = m.label ?? ''
          return (
            <g
              key={`${m.pos.string}:${m.pos.fret}:${m.tone}`}
              className="marker-pop"
              pointerEvents="none"
              data-pos={`${m.pos.string}:${m.pos.fret}`}
              data-tone={m.tone}
            >
              {m.tone === 'target' && <circle cx={cx} cy={cy} r={r} fill={fill} className="marker-pulse" />}
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={fill}
                stroke={m.tone === 'accidental' ? '#efe5cf' : '#15110f'}
                strokeWidth={m.tone === 'accidental' ? 1.5 : plain ? 1 : 2}
                style={GLOWS.has(m.tone) ? { filter: `drop-shadow(0 0 5px ${fill})` } : undefined}
              />
              {label && (
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={label.length > 2 ? r * 0.62 : label.length > 1 ? r * 0.82 : r * 0.95}
                  fontWeight={700}
                  className="font-label"
                  fill={m.tone === 'wrong' ? '#fff6ee' : m.tone === 'accidental' ? '#efe5cf' : '#15110f'}
                >
                  {label}
                </text>
              )}
            </g>
          )
        })}
    </svg>
  )
}
