import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { goBack, navigate, useRoute } from '../lib/router'
import { currentStreak, todayNailed, useProgress } from '../store/progress'

type Variant = 'amber' | 'rec' | 'cream' | 'dark'

export function Button({
  variant = 'amber',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...props} className={`hw-btn hw-${variant} w-full px-4 py-3 text-lg ${className}`} />
}

/** Lesson progress as tape winding from the left reel onto the right one. */
export function Reels({ value, counter }: { value: number; counter: number }) {
  const p = Math.max(0, Math.min(1, value))
  const [rMin, rMax] = [9, 21]
  const left = rMin + (rMax - rMin) * (1 - p)
  const right = rMin + (rMax - rMin) * p
  const hub = (cx: number) => (
    <g className="reel-spin">
      <circle cx={cx} cy={26} r={8} fill="#e9dcc0" />
      {[0, 120, 240].map((a) => (
        <rect key={a} x={cx - 1.5} y={18.5} width={3} height={4} fill="#1b1512" transform={`rotate(${a} ${cx} 26)`} />
      ))}
      <circle cx={cx} cy={26} r={3} fill="#1b1512" />
    </g>
  )
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <svg viewBox="0 0 200 52" className="h-11 min-w-0 flex-1" aria-hidden>
        <rect x={1} y={1} width={198} height={50} rx={8} fill="#120e0c" stroke="#3a302a" />
        <path d={`M 40 ${26 + left} L 100 47 L 160 ${26 + right}`} stroke="#4a3426" strokeWidth={2} fill="none" />
        <circle cx={40} cy={26} r={left} fill="#4a3426" />
        <circle cx={160} cy={26} r={right} fill="#4a3426" />
        {hub(40)}
        {hub(160)}
      </svg>
      <span className="lcd px-1.5 py-0.5 text-sm" aria-label={`Question ${counter}`}>
        {String(counter).padStart(3, '0')}
      </span>
    </div>
  )
}

/** Three CLIP lamps: each mistake lights one; three ruins the take. */
export function ClipLeds({ clips, max }: { clips: number; max: number }) {
  return (
    <div className="flex flex-col items-center gap-1" aria-label={`${max - clips} of ${max} chances left`}>
      <div className="flex gap-1.5">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={`led ${i < clips ? 'led-red' : ''}`} />
        ))}
      </div>
      <span className="label-text text-[10px] text-muted">Clip</span>
    </div>
  )
}

/** Lit push-buttons: a row where one or more can be switched on. */
export function LedButtons<T extends string | number>({
  options,
  selected,
  onToggle,
}: {
  options: { value: T; label: ReactNode }[]
  selected: T[]
  onToggle: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.value)
        return (
          <button
            key={String(o.value)}
            onClick={() => onToggle(o.value)}
            aria-pressed={on}
            className="hw-btn hw-dark flex items-center gap-2 px-3 py-1.5 text-sm"
          >
            <span className={`led !h-2 !w-2 ${on ? 'led-amber' : ''}`} />
            <span className={on ? 'text-cream' : 'text-muted'}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** A flip switch with its label. */
export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span>
        <span className="label-text block text-sm text-cream">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        className="relative h-7 w-12 shrink-0 rounded-full border border-black bg-[#120e0c] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] transition peer-checked:bg-amber-dim after:absolute after:top-[3px] after:left-[3px] after:h-5 after:w-5 after:rounded-full after:bg-[radial-gradient(circle_at_35%_30%,#ffffff,#a9a39b_60%,#6d665f)] after:shadow after:transition peer-checked:after:translate-x-5"
        aria-hidden
      />
    </label>
  )
}

/** A strip of label-maker tape, for names stuck onto things (tracks, takes, trouble spots). */
export function LabelTape({ children, size = 'sm', className = '' }: { children: ReactNode; size?: 'sm' | 'lg'; className?: string }) {
  const sizing = size === 'lg' ? 'px-3 py-1 text-xl tracking-[0.18em]' : 'px-2 py-0.5 text-sm tracking-[0.16em]'
  return <span className={`label-tape ${sizing} ${className}`}>{children}</span>
}

/** Header for screens pushed on top of the tabs. */
export function BackHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex items-center gap-3 border-b border-edge bg-tolex px-3 py-2">
      <button onClick={() => goBack()} className="hw-btn hw-dark px-3 py-1.5 text-sm" aria-label="Back">
        ◂◂
      </button>
      <div className="min-w-0">
        {subtitle && <div className="label-text text-[11px] text-muted">{subtitle}</div>}
        <h1 className="label-text truncate text-lg leading-tight text-cream">{title}</h1>
      </div>
    </header>
  )
}

/** A VU meter whose needle shows today's progress toward the daily goal. */
export function VuMeter({ value, goal }: { value: number; goal: number }) {
  const p = Math.min(1.08, value / goal)
  const angle = -50 + p * 92
  const ticks = Array.from({ length: 11 }, (_, i) => -50 + i * 9.2)
  return (
    <svg viewBox="0 0 100 58" className="h-11 w-[76px]" role="img" aria-label={`Today: ${value} of ${goal} notes`}>
      <rect x={1} y={1} width={98} height={56} rx={5} fill="#efe5cf" stroke="#000" strokeOpacity={0.6} />
      {/* Scale arc and the red "goal reached" zone, both centered on the needle pivot (50, 52). */}
      <path d="M 22.4 28.9 A 36 36 0 0 1 74.1 25.3" fill="none" stroke="#1d1916" strokeWidth={1} />
      <path d="M 69.6 21.8 A 36 36 0 0 1 77.6 28.9" fill="none" stroke="#e5483a" strokeWidth={3.5} />
      {ticks.map((t) => (
        <line key={t} x1={50} y1={10} x2={50} y2={15} stroke="#1d1916" strokeWidth={1} transform={`rotate(${t} 50 52)`} />
      ))}
      <text x={50} y={36} textAnchor="middle" fontSize={9} className="font-label" fill="#1d1916" letterSpacing={1}>
        VU
      </text>
      <line
        x1={50}
        y1={52}
        x2={50}
        y2={12}
        stroke="#1d1916"
        strokeWidth={1.4}
        style={{ transform: `rotate(${angle}deg)`, transformOrigin: '50px 52px', transition: 'transform 600ms cubic-bezier(.3,1.6,.5,1)' }}
      />
      <circle cx={50} cy={52} r={4} fill="#1d1916" />
    </svg>
  )
}

function ConsoleStrip() {
  const streak = useProgress((s) => currentStreak(s.streak))
  const nailed = useProgress((s) => s.nailed)
  const today = useProgress((s) => todayNailed(s.daily))
  const goal = useProgress((s) => s.settings.dailyGoal)
  return (
    <header className="flex items-center gap-3 border-b border-edge bg-tolex px-3 py-2">
      <VuMeter value={today} goal={goal} />
      <div className="flex flex-col">
        <span className="label-text text-[10px] text-muted">Daily goal</span>
        <span className="font-mono text-sm text-cream">
          {today}/{goal}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Readout label="Days" value={String(streak).padStart(2, '0')} />
        <Readout label="Notes" value={String(nailed).padStart(4, '0')} />
        <button onClick={() => navigate('/settings')} className="ml-1 rounded-full p-0.5" aria-label="Settings">
          <Knob />
        </button>
      </div>
    </header>
  )
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="lcd px-1.5 text-sm leading-6">{value}</span>
      <span className="label-text mt-0.5 text-[9px] text-muted">{label}</span>
    </div>
  )
}

/** An amp knob, used as the settings button. */
function Knob() {
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1={20} y1={2} x2={20} y2={5} stroke="#9c8f80" strokeWidth={1.2} transform={`rotate(${-120 + i * 30} 20 20)`} />
      ))}
      <circle cx={20} cy={20} r={13} fill="url(#knob)" stroke="#000" />
      <line x1={20} y1={20} x2={20} y2={9} stroke="#efe5cf" strokeWidth={2.2} strokeLinecap="round" transform="rotate(35 20 20)" />
      <defs>
        <radialGradient id="knob" cx="35%" cy="30%">
          <stop offset="0" stopColor="#5a4f47" />
          <stop offset="1" stopColor="#1b1512" />
        </radialGradient>
      </defs>
    </svg>
  )
}

const TABS: { path: string; label: string; icon: ReactNode }[] = [
  {
    path: '',
    label: 'Tapes',
    icon: (
      <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden>
        <rect x={1} y={1} width={22} height={14} rx={2} fill="none" stroke="currentColor" strokeWidth={1.6} />
        <circle cx={8} cy={8} r={2.4} fill="currentColor" />
        <circle cx={16} cy={8} r={2.4} fill="currentColor" />
      </svg>
    ),
  },
  {
    path: 'practice',
    label: 'Jam',
    icon: (
      <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden>
        <path d="M8 2 L18 8 L8 14 Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    path: 'explore',
    label: 'Fretboard',
    icon: (
      <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden>
        {[3, 8, 13].map((y) => (
          <line key={y} x1={1} y1={y} x2={23} y2={y} stroke="currentColor" strokeWidth={1.4} />
        ))}
        {[6, 12, 18].map((x) => (
          <line key={x} x1={x} y1={1} x2={x} y2={15} stroke="currentColor" strokeWidth={1} opacity={0.6} />
        ))}
      </svg>
    ),
  },
  {
    path: 'stats',
    label: 'Meters',
    icon: (
      <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden>
        <path d="M3 14 A 9 9 0 0 1 21 14" fill="none" stroke="currentColor" strokeWidth={1.6} />
        <line x1={12} y1={14} x2={17} y2={6} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      </svg>
    ),
  },
]

/** Tabs as the row of keys on a cassette deck; the active one is pressed in with its lamp lit. */
function DeckKeys() {
  const current = useRoute().parts[0] ?? ''
  const go = (path: string) => {
    if (path === current) return
    // Android back from any tab should land on Tapes, then leave the app.
    if (path === '') goBack('/')
    else navigate(`/${path}`, { replace: current !== '' })
  }
  return (
    <nav className="grid grid-cols-4 gap-1.5 border-t border-edge bg-tolex px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {TABS.map((t) => {
        const on = t.path === current
        return (
          <button
            key={t.label}
            onClick={() => go(t.path)}
            aria-current={on ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 rounded-b-md border border-black px-1 pt-1.5 pb-2 transition ${
              on
                ? 'translate-y-[2px] bg-[linear-gradient(#cfc4ae,#b3a78f)] text-ink shadow-[0_1px_0_#000]'
                : 'bg-[linear-gradient(#e9dfc9,#cdbfa3)] text-ink/70 shadow-[0_3px_0_#5e5444]'
            }`}
          >
            <span className={`led !h-1.5 !w-1.5 ${on ? 'led-amber' : ''}`} />
            {t.icon}
            <span className="label-text text-[10px] font-semibold">{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

/** Layout for the four main tabs: console strip on top, scrolling content, deck keys at the bottom. */
export function TabShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <ConsoleStrip />
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      <DeckKeys />
    </div>
  )
}
