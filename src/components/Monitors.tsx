import { goBack } from '../lib/router'
import { listeningOff, useProgress } from '../store/progress'
import { Button } from './ui'

/** A pair of studio headphones, drawn in the current text color. */
export function HeadphonesIcon({ off = false, className = 'h-5 w-5' }: { off?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="2.5" y="14" width="5" height="7" rx="1.6" fill="currentColor" fillOpacity={0.25} />
      <rect x="16.5" y="14" width="5" height="7" rx="1.6" fill="currentColor" fillOpacity={0.25} />
      {off && <path d="M3 3l18 18" strokeWidth={2.2} />}
    </svg>
  )
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

/**
 * The MONITORS switch: whether listening (ear-training) questions are on. Switching it off is the
 * same as "Can't listen now": they come back on by themselves 15 minutes later.
 */
export function MonitorsSwitch() {
  const off = useProgress((s) => listeningOff(s))
  const until = useProgress((s) => s.listeningPausedUntil)
  const pause = useProgress((s) => s.pauseListening)
  const resume = useProgress((s) => s.resumeListening)
  const on = off === null
  const note = off === 'settings' ? 'Ear training is off in Settings' : off === 'paused' && until ? `Back on at ${clock(until)}` : 'Listening questions on'
  return (
    <div className="flex items-center gap-3 rounded-md border border-black bg-[linear-gradient(#2a221d,#1d1714)] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <span className={`led !h-2.5 !w-2.5 ${on ? 'led-green' : ''}`} />
      <span className="min-w-0 flex-1">
        {/* Engraved into the panel, like the lettering on a mixing desk. */}
        <span className="label-text block text-xs text-[#8d8073] [text-shadow:0_1px_0_rgba(255,255,255,0.07),0_-1px_0_rgba(0,0,0,0.8)]">Monitors</span>
        <span className="block truncate text-xs text-muted">{note}</span>
      </span>
      <button
        role="switch"
        aria-checked={on}
        aria-label="Monitors"
        disabled={off === 'settings'}
        onClick={() => (on ? pause() : resume())}
        className="relative h-7 w-12 shrink-0 rounded-full border border-black bg-[#120e0c] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] transition disabled:opacity-40 aria-checked:bg-[#2f6b45]"
      >
        <span
          className={`absolute top-[3px] left-[3px] h-5 w-5 rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffffff,#a9a39b_60%,#6d665f)] shadow transition ${on ? 'translate-x-5' : ''}`}
        />
      </button>
    </div>
  )
}

/** The key on a listening question for when you can't use sound: listening questions pause for 15 minutes. */
export function CantListenButton({ onPress }: { onPress: () => void }) {
  return (
    <button onClick={onPress} className="hw-btn hw-dark flex items-center gap-2 px-3 py-1.5 text-xs">
      <HeadphonesIcon off className="h-4 w-4" />
      Can’t listen now
    </button>
  )
}

/** In place of an ear-training track while listening is off: why, and the switch to turn it back on. */
export function MonitorsOffScreen() {
  const off = useProgress((s) => listeningOff(s))
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6 px-8 text-center">
      <HeadphonesIcon off className="h-14 w-14 text-muted" />
      <div>
        <h1 className="label-text text-2xl text-cream">Monitors off</h1>
        <p className="mt-2 max-w-xs text-muted">
          {off === 'settings'
            ? 'This track is ear training, which is turned off in Settings.'
            : 'This track is ear training, so it needs sound. Put your headphones on and switch the monitors back on, or come back later.'}
        </p>
      </div>
      <div className="w-full max-w-xs">
        <MonitorsSwitch />
      </div>
      <Button variant="dark" className="max-w-xs" onClick={() => goBack()}>
        ◂◂ Back
      </Button>
    </div>
  )
}
