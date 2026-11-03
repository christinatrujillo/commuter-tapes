interface Props {
  title: string
  number: number
  color: string
  recorded: number
  total: number
  sealed?: boolean
  /** Spin the reels, for the tape that's in the deck. */
  playing?: boolean
}

/** A cassette with a handwritten label. The tape in the window winds over as tracks get recorded. */
export function Cassette({ title, number, color, recorded, total, sealed = false, playing = false }: Props) {
  const p = total ? recorded / total : 0
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

      {/* Window with reels */}
      <rect x={56} y={56} width={88} height={24} rx={12} fill="#120e0c" stroke="#000" />
      {reel(78, 6 + 5 * (1 - p))}
      {reel(122, 6 + 5 * p)}
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
