import type { KeyId } from '../music/score'

// Twelve slots, C at the top, a fifth apart going clockwise. The three at the bottom have two names.
const MAJORS = [['C'], ['G'], ['D'], ['A'], ['E'], ['B', 'C♭'], ['F♯', 'G♭'], ['C♯', 'D♭'], ['A♭'], ['E♭'], ['B♭'], ['F']]
const MINORS = [['Am'], ['Em'], ['Bm'], ['F♯m'], ['C♯m'], ['G♯m'], ['D♯m', 'E♭m'], ['B♭m'], ['Fm'], ['Cm'], ['Gm'], ['Dm']]
const SLOT: Record<KeyId, number> = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, Cb: 5, 'F#': 6, Gb: 6, 'C#': 7, Db: 7, Ab: 8, Eb: 9, Bb: 10, F: 11 }

const INK = '#1d1916'
const LIT = '#d9a441'

function Label({ names, x, y, size }: { names: string[]; x: number; y: number; size: number }) {
  const small = names.length > 1 ? size * 0.72 : size
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="font-label" fontSize={small} fill={INK}>
      {names.map((n, i) => (
        <tspan key={n} x={x} dy={i === 0 ? (names.length > 1 ? -small * 0.55 : 0) : small * 1.1}>
          {n}
        </tspan>
      ))}
    </text>
  )
}

/** The circle of fifths: major keys around the outside, their relative minors inside, with some keys lit. */
export function CircleOfFifths({ majors, minors = [] }: { majors: KeyId[]; minors?: KeyId[] }) {
  const litMajor = new Set(majors.map((k) => SLOT[k]))
  const litMinor = new Set(minors.map((k) => SLOT[k]))
  const at = (slot: number, r: number) => {
    const a = ((slot * 30 - 90) * Math.PI) / 180
    return { x: 100 + r * Math.cos(a), y: 100 + r * Math.sin(a) }
  }
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" role="img" aria-label="Circle of fifths">
      <circle cx={100} cy={100} r={97} fill="none" stroke={INK} strokeWidth={1.2} />
      <circle cx={100} cy={100} r={70} fill="none" stroke={INK} strokeWidth={0.8} />
      <circle cx={100} cy={100} r={44} fill="none" stroke={INK} strokeWidth={0.8} />
      {MAJORS.map((names, slot) => {
        const p = at(slot, 84)
        const q = at(slot, 57)
        return (
          <g key={slot}>
            {litMajor.has(slot) && <circle cx={p.x} cy={p.y} r={12} fill={LIT} />}
            {litMinor.has(slot) && <circle cx={q.x} cy={q.y} r={10} fill={LIT} opacity={0.75} />}
            <Label names={names} x={p.x} y={p.y} size={12} />
            <Label names={MINORS[slot]} x={q.x} y={q.y} size={8.5} />
          </g>
        )
      })}
      <text x={100} y={96} textAnchor="middle" className="font-label" fontSize={9} fill={INK} opacity={0.7}>
        ♯ clockwise
      </text>
      <text x={100} y={108} textAnchor="middle" className="font-label" fontSize={9} fill={INK} opacity={0.7}>
        ♭ counterclockwise
      </text>
    </svg>
  )
}
