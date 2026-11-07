import { useEffect, useState } from 'react'
import { PAPER_HIGHLIGHT } from '../lib/color'
import { loadVexFlow } from './musicFont'

const INK = '#1d1916'
/** The gap between staff lines; the music font is drawn four gaps tall, one staff high. */
const SPACE = 7
const STAFF_H = SPACE * 4
const LEFT = 6
/** Room for the clef (and the time signature on the first line) at the start of every line, so the bars line up down the page. */
const LEAD = 44
const BAR_W = 80
const TOP = 30
const ROW_H = 82

// Music-font characters: treble clef, the 4 of a time signature, and a slash for one beat.
const CLEF = ''
const FOUR = ''
const SLASH = ''

export interface ChartSpec {
  /** The chord in each bar, in order; null for the one a question asks about. */
  bars: (string | null)[]
  /** Printed under each bar: I7, IV7, V7. */
  numerals?: (string | null)[]
  /** A bar to ring: the one a question asks about. */
  mark?: number | null
}

/**
 * A chord chart, the way method books and band charts write one: a staff with a treble clef and
 * 4/4, four bars to a line, the chord over the start of each bar and a slash for each beat.
 */
export function ChordChart({ bars, numerals, mark = null }: ChartSpec) {
  // The clef, time signature and slashes come from the sheet-music font, so they wait for it.
  const [font, setFont] = useState(false)
  useEffect(() => {
    let on = true
    void loadVexFlow().then(() => on && setFont(true))
    return () => {
      on = false
    }
  }, [])

  const rows = Math.ceil(bars.length / 4)
  const right = LEFT + LEAD + BAR_W * 4
  const width = right + LEFT
  const height = TOP + (rows - 1) * ROW_H + STAFF_H + (numerals ? 22 : 8)
  const staffTop = (row: number) => TOP + row * ROW_H
  const barX = (i: number) => LEFT + LEAD + (i % 4) * BAR_W
  const glyph = (text: string, x: number, y: number, key: string) => (
    <text key={key} x={x} y={y} fontSize={STAFF_H} fontFamily="Bravura" fill={INK}>
      {text}
    </text>
  )

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      role="img"
      aria-label="Chord chart"
      data-bars={bars.map((b) => b ?? '?').join(',')}
      data-numerals={numerals?.map((n) => n ?? '').join(',') ?? ''}
      data-mark={mark ?? ''}
    >
      {Array.from({ length: rows }, (_, r) => {
        const y = staffTop(r)
        const last = r === rows - 1
        return (
          <g key={`row${r}`}>
            {[0, 1, 2, 3, 4].map((l) => (
              <line key={l} x1={LEFT} x2={right} y1={y + l * SPACE} y2={y + l * SPACE} stroke={INK} strokeWidth={0.8} />
            ))}
            <line x1={LEFT} x2={LEFT} y1={y} y2={y + STAFF_H} stroke={INK} strokeWidth={1} />
            {[1, 2, 3, 4].map((b) => (
              <line key={`b${b}`} x1={LEFT + LEAD + b * BAR_W} x2={LEFT + LEAD + b * BAR_W} y1={y} y2={y + STAFF_H} stroke={INK} strokeWidth={last && b === 4 ? 3 : 1} />
            ))}
            {last && <line x1={right - 5} x2={right - 5} y1={y} y2={y + STAFF_H} stroke={INK} strokeWidth={1} />}
            {font && glyph(CLEF, LEFT + 4, y + 3 * SPACE, 'clef')}
            {font && r === 0 && [glyph(FOUR, LEFT + 28, y + SPACE, 'top'), glyph(FOUR, LEFT + 28, y + 3 * SPACE, 'bottom')]}
          </g>
        )
      })}
      {bars.map((chord, i) => {
        const x = barX(i)
        const y = staffTop(Math.floor(i / 4))
        const marked = i === mark
        return (
          <g key={i}>
            <text x={x + 4} y={y - 20} fontSize={8} className="font-typed" fill={INK} opacity={0.55}>
              {i + 1}
            </text>
            {marked && <rect x={x + 2} y={y - 17} width={BAR_W - 4} height={STAFF_H + 21} rx={5} fill="none" stroke={PAPER_HIGHLIGHT} strokeWidth={2} />}
            <text x={x + 8} y={y - 6} fontSize={13} className="font-typed" fill={marked ? PAPER_HIGHLIGHT : INK}>
              {chord ?? '?'}
            </text>
            {font && [0, 1, 2, 3].map((b) => glyph(SLASH, x + 8 + b * 17, y + 2 * SPACE, `s${b}`))}
            {numerals?.[i] && (
              <text x={x + BAR_W / 2} y={y + STAFF_H + 14} fontSize={9} textAnchor="middle" className="font-typed" fill={INK} opacity={0.75}>
                {numerals[i]}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
