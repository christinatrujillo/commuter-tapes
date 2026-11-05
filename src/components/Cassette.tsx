import { useId, type ReactNode } from 'react'

interface Props {
  title: string
  number: number
  color: string
  recorded: number
  total: number
  sealed?: boolean
  /** Spin the reels, for the tape that's in the deck. */
  playing?: boolean
  /** An ear-training tape: printed with a headphones mark, like the type marks on real cassettes. */
  listening?: boolean
}

/** A cassette with a handwritten label. The tape in the window winds over as tracks get recorded. */
export function Cassette({ title, number, color, recorded, total, sealed = false, playing = false, listening = false }: Props) {
  const p = total ? recorded / total : 0
  const glass = useId()
  const complete = !sealed && recorded >= total
  // The title sits on a strip of label-maker tape sized to fit it.
  const tapeWidth = Math.min(156, title.length * 6.4 + 14)
  const reel = (cx: number, pack: number) => (
    <g>
      <circle cx={cx} cy={68} r={pack} fill="#4a3426" />
      <g className={playing ? 'reel-spin' : undefined}>
        <circle cx={cx} cy={68} r={5.5} fill={sealed ? '#8d857c' : '#e9dcc0'} />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <rect key={a} x={cx - 0.9} y={62.5} width={1.8} height={2.6} fill="#1b1512" transform={`rotate(${a} ${cx} 68)`} />
        ))}
      </g>
    </g>
  )
  return (
    <svg viewBox="0 0 200 128" className="block h-auto w-full drop-shadow-[0_6px_8px_rgba(0,0,0,0.5)]" role="img" aria-label={title}>
      <rect x={2} y={2} width={196} height={124} rx={8} fill={sealed ? '#3b3532' : '#2a2320'} stroke="#000" />
      {[
        [10, 10],
        [190, 10],
        [10, 118],
        [190, 118],
        [100, 118],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r={3} fill="#5d5148" />
          <line x1={x - 2} y1={y} x2={x + 2} y2={y} stroke="#2a2320" strokeWidth={0.8} />
        </g>
      ))}

      {/* Label */}
      <rect x={16} y={9} width={168} height={76} rx={4} fill={sealed ? '#625a53' : '#efe5cf'} />
      {!sealed && <rect x={16} y={24} width={168} height={6} fill={color} />}
      <text x={24} y={20} fontSize={8} className="font-label" fill={sealed ? '#3b3532' : '#6b5f55'} letterSpacing={1.5}>
        SIDE A
      </text>
      <text x={176} y={20} fontSize={8} textAnchor="end" className="font-mono" fill={sealed ? '#3b3532' : '#6b5f55'}>
        No.{String(number).padStart(2, '0')}
      </text>
      {sealed ? (
        <text x={100} y={50} fontSize={11} textAnchor="middle" className="font-label" fill="#3b3532" letterSpacing={3}>
          SEALED
        </text>
      ) : (
        <g>
          <rect x={22} y={36} width={tapeWidth} height={16} rx={1.5} fill="#121212" />
          <line x1={23} y1={37} x2={21 + tapeWidth} y2={37} stroke="#ffffff" strokeOpacity={0.12} />
          <text
            x={29}
            y={47.5}
            fontSize={9.5}
            className="font-label"
            fill="#f2f2f2"
            textLength={tapeWidth - 14}
            lengthAdjust="spacing"
          >
            {title.toUpperCase()}
          </text>
        </g>
      )}

      {listening && <HeadphonesMark ink={sealed ? '#3b3532' : '#6b5f55'} />}

      {/* Window with reels */}
      <rect x={56} y={56} width={88} height={24} rx={12} fill="#120e0c" stroke="#000" />
      {reel(78, 6 + 5 * (1 - p))}
      {reel(122, 6 + 5 * p)}
      {/* Smoked plastic over the window: a light tint, two soft reflections and a lit top rim. */}
      <defs>
        <clipPath id={`${glass}-window`}>
          <rect x={56} y={56} width={88} height={24} rx={12} />
        </clipPath>
        <linearGradient id={`${glass}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.45} />
          <stop offset="0.5" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${glass}-window)`} pointerEvents="none">
        <rect x={56} y={56} width={88} height={24} fill="#3a2818" opacity={0.22} />
        <polygon points="72,56 90,56 74,80 56,80" fill="#fff" opacity={0.14} />
        <polygon points="96,56 101,56 85,80 80,80" fill="#fff" opacity={0.08} />
      </g>
      <rect x={56.4} y={56.4} width={87.2} height={23.2} rx={11.6} fill="none" stroke={`url(#${glass}-rim)`} strokeWidth={0.8} pointerEvents="none" />
      {!sealed && (
        <text x={178} y={80} fontSize={8} textAnchor="end" className="font-mono" fill="#6b5f55">
          {recorded}/{total}
        </text>
      )}

      {/* Tape-head opening */}
      <path d="M 42 126 L 54 96 L 146 96 L 158 126 Z" fill="#211b18" stroke="#000" />
      <circle cx={70} cy={112} r={4} fill="#0d0a09" />
      <circle cx={130} cy={112} r={4} fill="#0d0a09" />
      <rect x={93} y={104} width={14} height={8} rx={1} fill="#0d0a09" />

      {complete && (
        <g transform="translate(176 40) rotate(12)">
          <circle r={11} fill="#d9a441" stroke="#8a5a14" />
          <text y={4} fontSize={12} textAnchor="middle" fill="#2a1a05" fontWeight={700}>
            ✓
          </text>
        </g>
      )}
      {sealed && <path d="M 2 40 L 60 2 L 90 2 L 2 64 Z" fill="#ffffff" opacity={0.05} />}
    </svg>
  )
}

/** A small printed badge with a pair of headphones, in the label's corner beside the window. */
function HeadphonesMark({ ink }: { ink: string }) {
  return (
    <g aria-hidden>
      <rect x={21} y={57.5} width={30} height={23} rx={2.5} fill="none" stroke={ink} strokeWidth={0.7} />
      <g transform="translate(27.6 60.4) scale(0.7)" fill="none" stroke={ink} strokeWidth={1.8} strokeLinecap="round">
        <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
        <rect x="2.5" y="14" width="5" height="7" rx="1.6" fill={ink} fillOpacity={0.35} />
        <rect x="16.5" y="14" width="5" height="7" rx="1.6" fill={ink} fillOpacity={0.35} />
      </g>
    </g>
  )
}

/**
 * The deck a loaded tape sits in: a dark, recessed well behind a tinted acrylic door, like a
 * front-loading cassette deck. `band` floats over the top edge ("Now playing").
 */
export function DeckWell({ children, band }: { children: ReactNode; band?: ReactNode }) {
  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-[#0d0a08] p-3 shadow-[inset_0_2px_8px_rgba(0,0,0,0.9)]">
      {band && (
        <div className="absolute top-1 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded border border-edge bg-room px-2 py-0.5 whitespace-nowrap">{band}</div>
      )}
      {children}
      {/* The door: reflections across the acrylic, and a hinge along the bottom. It doesn't catch taps. */}
      <div
        className="pointer-events-none absolute inset-1.5 z-10 rounded-md border border-white/10 bg-[rgba(28,18,12,0.22)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-10px_18px_rgba(0,0,0,0.35)]"
        aria-hidden
      >
        <div className="absolute inset-0 rounded-md bg-[linear-gradient(115deg,transparent_18%,rgba(255,255,255,0.11)_30%,rgba(255,255,255,0.03)_40%,transparent_47%,transparent_62%,rgba(255,255,255,0.06)_68%,transparent_74%)]" />
        <div className="absolute inset-x-3 bottom-0 h-1.5 rounded-t-sm bg-[linear-gradient(#2a221d,#15110e)]" />
      </div>
    </div>
  )
}
