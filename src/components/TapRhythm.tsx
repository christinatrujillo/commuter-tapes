import { useEffect, useRef, useState } from 'react'
import { canVibrate, countIn, effectiveMode, playRhythm, type Clock } from '../audio/metronome'
import type { TapResult } from '../game/present'
import { METER_PULSE, METER_QUARTERS, onsets, playedIndexes, type Measure } from '../music/rhythm'
import { useProgress } from '../store/progress'
import { Notation } from './Notation'
import { Button, LedButtons } from './ui'

type Phase = 'ready' | 'countin' | 'playing' | 'done'

/** Scores taps against the notes: each note can be matched by one tap within the timing window. */
export function scoreTaps(measure: Measure, bpm: number, taps: number[], start: number): TapResult {
  const beatMs = 60000 / bpm
  // Note positions are in quarter notes; the tempo counts the beat (a half note in cut time).
  const quarterMs = beatMs / METER_PULSE[measure.meter].quarters
  const window = Math.min(250, Math.max(120, beatMs * 0.25))
  const starts = onsets(measure)
  const played = playedIndexes(measure)
  const offsets: (number | null)[] = measure.events.map(() => null)
  const used = new Set<number>()
  for (const i of played) {
    const expected = start + starts[i] * quarterMs
    let best = -1
    for (let t = 0; t < taps.length; t++) {
      if (used.has(t) || Math.abs(taps[t] - expected) > window) continue
      if (best === -1 || Math.abs(taps[t] - expected) < Math.abs(taps[best] - expected)) best = t
    }
    if (best !== -1) {
      used.add(best)
      offsets[i] = taps[best] - expected
    }
  }
  const matched = offsets.filter((o): o is number => o !== null)
  return {
    hits: matched.length,
    total: played.length,
    extra: taps.length - matched.length,
    offsets,
    tapBeats: taps.map((t) => (t - start) / quarterMs),
    meanOffset: matched.length ? matched.reduce((a, b) => a + b, 0) / matched.length : 0,
  }
}

interface Props {
  measure: Measure
  bpm: number
  /** Set once the answer is in, to show how it went. */
  result: TapResult | null
  onDone: (result: TapResult) => void
  /** Rehearsals let you hear the rhythm first; takes test reading it cold. */
  allowListen?: boolean
}

/**
 * Read a measure, hear (or feel) a one-measure count-in, then tap the rhythm.
 * Space or Enter also taps, for practicing on a laptop.
 */
export function TapRhythm({ measure, bpm, result, onDone, allowListen = false }: Props) {
  const setting = useProgress((s) => s.settings.metronome)
  const updateSettings = useProgress((s) => s.updateSettings)
  const mode = effectiveMode(setting)
  const [phase, setPhase] = useState<Phase>(result ? 'done' : 'ready')
  /** Which beat we're on (0-based) in the count-in or the measure being tapped. */
  const [beat, setBeat] = useState(0)
  const taps = useRef<number[]>([])
  const clock = useRef<Clock | null>(null)
  const playhead = useRef<((beat: number | null) => void) | null>(null)
  const frame = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const beatMs = 60000 / bpm
  const beats = METER_PULSE[measure.meter].beats
  const quarterMs = beatMs / METER_PULSE[measure.meter].quarters

  useEffect(
    () => () => {
      clock.current?.stop()
      cancelAnimationFrame(frame.current)
      timers.current.forEach(clearTimeout)
    },
    [],
  )

  /** Moves the playback line across the measure until `until`. */
  function animate(start: number, until: number) {
    const step = () => {
      const now = Date.now()
      playhead.current?.(now >= start ? (now - start) / quarterMs : null)
      if (now < until) frame.current = requestAnimationFrame(step)
      else playhead.current?.(null)
    }
    if (typeof requestAnimationFrame === 'function') frame.current = requestAnimationFrame(step)
  }

  function begin() {
    taps.current = []
    setPhase('countin')
    setBeat(-1)
    countIn(measure, bpm, mode, (c) => {
      clock.current = c
      // Sound reaches your ears late by the speaker's latency (big on Android, worse over Bluetooth).
      // Draw the count and the playback line that late too, so the screen and the clicks agree.
      const heardStart = c.start + c.latencyMs
      const end = heardStart + beats * beatMs
      // Show every beat on screen, so the count-in is clear even if the clicks or buzzes don't come through.
      for (let i = 0; i < beats * 2; i++) {
        timers.current.push(setTimeout(() => setBeat(i % beats), heardStart - (beats - i) * beatMs - Date.now()))
      }
      // Taps are accepted from a little before beat 1 (an early first note still counts).
      timers.current.push(setTimeout(() => setPhase('playing'), Math.max(0, heardStart - Date.now() - beatMs * 0.25)))
      timers.current.push(
        setTimeout(
          () => {
            setPhase('done')
            onDone(scoreTaps(measure, bpm, taps.current, heardStart))
          },
          end - Date.now() + beatMs * 0.5,
        ),
      )
      animate(heardStart, end)
    })
  }

  function listen() {
    const c = playRhythm(measure, bpm)
    animate(c.start, c.start + beats * beatMs)
  }

  /** When the finger actually landed: the event's own timestamp, so a busy moment on a slow phone doesn't make taps late. */
  function tapTime(e?: { timeStamp: number }): number {
    const now = Date.now()
    if (!e || typeof performance === 'undefined') return now
    const ago = performance.now() - e.timeStamp
    return ago >= 0 && ago < 1000 ? now - ago : now
  }

  function tap(e?: { timeStamp: number }) {
    if (phase === 'playing') taps.current.push(tapTime(e))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        tap(e)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const colors = result
    ? measure.events.map((e, i) => (e.rest || (i > 0 && measure.events[i - 1].tie) ? undefined : result.offsets[i] !== null ? '#2f8f4e' : '#c0392b'))
    : undefined
  const marks = result?.tapBeats
    .filter((b) => b > -1 && b < METER_QUARTERS[measure.meter] + 0.5)
    .map((beat) => ({ beat, color: '#a8742a' }))
  const starts = onsets(measure)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        className="paper min-h-[120px] flex-1 px-3 py-1"
        data-onsets={playedIndexes(measure)
          .map((i) => starts[i] * quarterMs)
          .join(',')}
        data-countin-ms={beats * beatMs}
        data-beats={beats}
      >
        <Notation measure={measure} colors={colors} marks={marks} playhead={playhead} />
      </div>
      {phase === 'ready' && (
        <div className="flex flex-col gap-3">
          {canVibrate() && (
            <div className="flex items-center justify-between gap-3">
              <span className="label-text text-[11px] text-muted">Metronome</span>
              <LedButtons
                options={[
                  { value: 'click', label: 'Click' },
                  { value: 'vibrate', label: 'Vibrate' },
                ]}
                selected={[setting]}
                onToggle={(metronome) => updateSettings({ metronome })}
              />
            </div>
          )}
          {mode === 'vibrate' && (
            <p className="text-xs text-muted">No buzz? Your phone's vibration may be turned off. Switch to Click, or follow the count on screen.</p>
          )}
          <div className="flex gap-3">
            {allowListen && (
              <Button variant="dark" className="!w-auto shrink-0" onClick={listen}>
                ▶ Hear it
              </Button>
            )}
            <Button onClick={begin}>Count me in</Button>
          </div>
        </div>
      )}
      {(phase === 'countin' || phase === 'playing') && (
        <button
          onPointerDown={(e) => tap(e)}
          className={`hw-btn ${phase === 'playing' ? 'hw-amber' : 'hw-cream'} flex h-32 w-full flex-col items-center justify-center gap-2`}
          aria-label="Tap"
          data-phase={phase}
        >
          {phase === 'countin' ? (
            <>
              <span className="text-xs opacity-60">Get ready…</span>
              {beat >= 0 && (
                <span key={beat} className="text-5xl leading-none" style={{ animation: 'pop 0.2s ease-out' }} data-testid="countdown">
                  {beats - beat}
                </span>
              )}
            </>
          ) : (
            <span className="text-3xl leading-none">Tap!</span>
          )}
          <span className="flex gap-2" aria-hidden>
            {Array.from({ length: beats }, (_, i) => (
              <span key={i} className={`h-2 w-2 rounded-full ${i <= beat ? 'bg-current' : 'bg-current opacity-20'}`} />
            ))}
          </span>
        </button>
      )}
    </div>
  )
}
