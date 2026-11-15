import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { useRoute } from '../lib/router'
import { useProgress, type TipId } from '../store/progress'
import { LabelTape } from './ui'

type Screen = 'home' | 'tape' | 'rehearse' | 'lesson'

interface Bubble {
  id: string
  screen: Screen
  /** What it points at. */
  target: string
  /** Where it goes: above the target or below it (it flips if there isn't room). */
  place: 'above' | 'below'
  title: string
  text: string
}

/** The tour: the four tabs, then the deck's two keys. It stays on the home screen. */
const TOUR: Bubble[] = [
  { id: 'tapes', screen: 'home', target: '[data-guide="tab-tapes"]', place: 'above', title: 'Tabs', text: 'Tapes are your lessons.' },
  { id: 'jam', screen: 'home', target: '[data-guide="tab-practice"]', place: 'above', title: 'Tabs', text: 'Jam is extra practice.' },
  { id: 'fretboard', screen: 'home', target: '[data-guide="tab-explore"]', place: 'above', title: 'Tabs', text: 'Fretboard is a reference neck.' },
  { id: 'meters', screen: 'home', target: '[data-guide="tab-stats"]', place: 'above', title: 'Tabs', text: 'Meters show your progress.' },
  { id: 'next', screen: 'home', target: '[data-guide="play-next"]', place: 'below', title: 'Your first lesson', text: 'Play next track starts your next lesson straight away.' },
  { id: 'load', screen: 'home', target: '[data-guide="load-tape"]', place: 'below', title: 'The tape', text: 'Load tape opens the tape first: its track list and liner notes.' },
]

/** One-time tips, each the first time you reach its screen yourself. */
const TIPS: (Bubble & { id: TipId })[] = [
  { id: 'play', screen: 'tape', target: '[data-guide="play"]', place: 'above', title: 'Tracks', text: 'A tape holds a few short tracks. Play starts the next one.' },
  {
    id: 'rehearsal',
    screen: 'rehearse',
    target: '[data-step="card"]',
    place: 'below',
    title: 'Rehearsal',
    text: 'A few cards teach what’s new, then a quick check. Mistakes here don’t count.',
  },
  { id: 'take', screen: 'lesson', target: '[data-guide="clips"]', place: 'below', title: 'The take', text: 'About 10 questions. Each mistake lights a CLIP lamp. Three, and you try again.' },
]

const SCREENS: Record<string, Screen> = { '': 'home', tape: 'tape', rehearse: 'rehearse', lesson: 'lesson' }
/** Room around the target inside the spotlight, and between the spotlight and the bubble. */
const PAD = 6
const GAP = 16
/** About how tall a bubble is, to decide whether it fits on the side it asks for. */
const BUBBLE_HEIGHT = 190
/** How long a bubble takes to fade out when the guide closes, or a tip gives way to the tour. */
const OUT_MS = 180

/**
 * The glide from one tour step to the next, as key poses: a sweep that eases in and out and stretches
 * along its path, with the bubble a beat behind the spotlight on a gentle arc (and, if set, a small
 * pull back first and an overshoot to settle from). Kept as plain numbers so the same motion can be
 * rebuilt with native animation tools.
 */
const GLIDE = {
  ms: 520,
  /** The bubble trails the spotlight by this much. */
  lagMs: 40,
  /** When each pose lands, as a share of the move. */
  poses: { windup: 0.15, mid: 0.5, overshoot: 0.82 },
  /**
   * How far it pulls back first and overshoots at the end (px). 0 and 0 make a pure glide; a few px
   * each (3 and 4, say) give it a springier feel.
   */
  windupPx: 0,
  overshootPx: 0,
  /** How high the bubble's arc lifts at most (px); a short move lifts less, and a bubble staying put doesn't bob. */
  liftPx: 8,
  /** How much the spotlight stretches along its path at full speed. */
  stretch: 0.08,
  /** How long the old words take to make way for the new. */
  wordsMs: 320,
}

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const canAnimate = (el: Element) => typeof el.animate === 'function' && !reducedMotion()

/** The direction from one box's center to another's, as a unit vector (0, 0 if they're the same). */
function heading(from: DOMRect, to: DOMRect) {
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  const length = Math.hypot(dx, dy) || 1
  return { ux: dx / length, uy: dy / length }
}

/** The spotlight's poses between two targets: pull back, sweep (stretching along the way), overshoot, settle. */
function spotPoses(from: DOMRect, to: DOMRect): Keyframe[] {
  const { ux, uy } = heading(from, to)
  const box = (x: number, y: number, w: number, h: number) => ({ left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` })
  const w = ((from.width + to.width) / 2) * (1 + GLIDE.stretch * Math.abs(ux))
  const h = ((from.height + to.height) / 2) * (1 + GLIDE.stretch * Math.abs(uy))
  const cx = (from.left + from.width / 2 + to.left + to.width / 2) / 2
  const cy = (from.top + from.height / 2 + to.top + to.height / 2) / 2
  const { windup, mid, overshoot } = GLIDE.poses
  // Without a pull-back or an overshoot those poses drop out, so the move eases in and out unbroken.
  const poses: Keyframe[] = [{ offset: 0, ...box(from.left, from.top, from.width, from.height), easing: GLIDE.windupPx ? 'ease-out' : 'ease-in' }]
  if (GLIDE.windupPx) poses.push({ offset: windup, ...box(from.left - ux * GLIDE.windupPx, from.top - uy * GLIDE.windupPx, from.width, from.height), easing: 'ease-in' })
  poses.push({ offset: mid, ...box(cx - w / 2, cy - h / 2, w, h), easing: 'ease-out' })
  if (GLIDE.overshootPx) poses.push({ offset: overshoot, ...box(to.left + ux * GLIDE.overshootPx, to.top + uy * GLIDE.overshootPx, to.width, to.height), easing: 'ease-in-out' })
  poses.push({ offset: 1, ...box(to.left, to.top, to.width, to.height) })
  return poses
}

/** The bubble's poses, from where it was to where it's going: the same beats, on an arc that lifts mid-move. */
function bubblePoses(from: DOMRect, to: DOMRect): Keyframe[] {
  const { ux, uy } = heading(from, to)
  const dx = from.left - to.left
  const dy = from.top - to.top
  const at = (x: number, y: number) => ({ transform: `translate(${x}px, ${y}px)` })
  const { windup, mid, overshoot } = GLIDE.poses
  // The arc grows with the distance: nothing to lift for a bubble that isn't going anywhere.
  const lift = Math.min(GLIDE.liftPx, Math.hypot(dx, dy) * 0.06)
  const poses: Keyframe[] = [{ offset: 0, ...at(dx, dy), easing: GLIDE.windupPx ? 'ease-out' : 'ease-in' }]
  if (GLIDE.windupPx) poses.push({ offset: windup, ...at(dx - ux * GLIDE.windupPx, dy - uy * GLIDE.windupPx), easing: 'ease-in' })
  poses.push({ offset: mid, ...at(dx / 2, dy / 2 - lift), easing: 'ease-out' })
  if (GLIDE.overshootPx) poses.push({ offset: overshoot, ...at(ux * GLIDE.overshootPx * 0.75, uy * GLIDE.overshootPx * 0.75), easing: 'ease-in-out' })
  poses.push({ offset: 1, ...at(0, 0) })
  return poses
}

/**
 * The first-run guide. A short tour of the home screen starts by itself for someone new (nothing
 * recorded yet) and ends there; it never opens anything for you. Then a one-time tip explains each
 * new screen the first time you reach it: a tape, a rehearsal, a take. Settings can bring it all back.
 */
export function Guide() {
  const step = useProgress((s) => s.guideStep)
  const guideDone = useProgress((s) => s.guideDone)
  const tipsSeen = useProgress((s) => s.tipsSeen)
  const started = useProgress((s) => Object.keys(s.lessons).length > 0)
  const setStep = useProgress((s) => s.setGuideStep)
  const finish = useProgress((s) => s.finishGuide)
  const seeTip = useProgress((s) => s.seeTip)
  const screen: Screen | undefined = SCREENS[useRoute().parts[0] ?? '']

  // Someone new opens the app: start the tour (once, at launch).
  useEffect(() => {
    if (!guideDone && !started && step === null && screen === 'home') setStep(0)
  }, [])

  // What should be up: the tour's step on the home screen, or else this screen's tip if it's new to you.
  const tour = step !== null && screen === 'home' ? TOUR[step] : null
  const tip = step === null ? (TIPS.find((t) => t.screen === screen && !tipsSeen[t.id]) ?? null) : null
  const wanted: Bubble | null = tour ?? tip

  // The spotlight follows its target as the screen settles (fonts, a tape sliding into the deck).
  const [rect, setRect] = useState<DOMRect | null>(null)
  useLayoutEffect(() => {
    if (!wanted) return
    let missing = 0
    let first = true
    const measure = () => {
      const el = document.querySelector(wanted.target)
      if (!el) {
        // The tour with nothing to point at ends quietly; a tip waits until its target turns up.
        if (++missing > 6 && TOUR.includes(wanted)) finish()
        if (missing === 1) setRect(null)
        return
      }
      missing = 0
      if (first) el.scrollIntoView({ block: 'nearest' })
      first = false
      const r = el.getBoundingClientRect()
      setRect((prev) => (prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height ? prev : r))
    }
    measure()
    const timer = setInterval(measure, 250)
    window.addEventListener('resize', measure)
    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', measure)
    }
  }, [wanted, finish])

  // The bubble on screen. From one tour step to the next it's the same bubble, gliding on, with the
  // old words making way for the new; it fades out only when the guide closes or changes kind.
  const [shown, setShown] = useState<Bubble | null>(wanted)
  const [fading, setFading] = useState<Bubble | null>(null)
  const [leaving, setLeaving] = useState(false)
  useLayoutEffect(() => {
    if (wanted === shown) return
    if (wanted && shown && TOUR.includes(wanted) && TOUR.includes(shown)) {
      if (!reducedMotion()) setFading(shown)
      setShown(wanted)
      return
    }
    if (!shown || reducedMotion()) {
      setShown(wanted)
      return
    }
    setLeaving(true)
    const timer = setTimeout(() => {
      setShown(wanted)
      setLeaving(false)
    }, OUT_MS)
    return () => clearTimeout(timer)
  }, [wanted, shown])
  useEffect(() => {
    if (!fading) return
    const timer = setTimeout(() => setFading(null), GLIDE.wordsMs)
    return () => clearTimeout(timer)
  }, [fading])

  // The glide itself, played once the new step is laid out: from where the spotlight, bubble and
  // words were to where they are now. A tap mid-glide picks up from wherever things are on screen.
  const spotRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const wordsRef = useRef<HTMLDivElement>(null)
  const rest = useRef<{ id: string; spot: DOMRect; bubble: DOMRect; words: number } | null>(null)
  const playing = useRef<Animation[]>([])
  useLayoutEffect(() => {
    const spot = spotRef.current
    const bubble = bubbleRef.current
    const words = wordsRef.current
    if (!shown || !spot || !bubble || !words) {
      rest.current = null
      return
    }
    const measure = () => ({ id: shown.id, spot: spot.getBoundingClientRect(), bubble: bubble.getBoundingClientRect(), words: words.getBoundingClientRect().height })
    const before = rest.current
    const midGlide = playing.current.some((a) => a.playState === 'running')
    // The same step, its target nudged a pixel as the screen settles: never interrupt a glide for that.
    if (before && before.id === shown.id) {
      if (!midGlide) rest.current = measure()
      return
    }
    // A new step. Mid-glide, start from wherever things are on screen right now.
    const from = before && midGlide ? measure() : before
    playing.current.forEach((a) => a.cancel())
    playing.current = []
    const now = measure()
    rest.current = now
    if (!from || !canAnimate(spot)) return
    playing.current = [
      spot.animate(spotPoses(from.spot, now.spot), { duration: GLIDE.ms }),
      bubble.animate(bubblePoses(from.bubble, now.bubble), { duration: GLIDE.ms, delay: GLIDE.lagMs, fill: 'backwards' }),
    ]
    if (Math.abs(from.words - now.words) > 1) {
      playing.current.push(words.animate([{ height: `${from.words}px` }, { height: `${now.words}px` }], { duration: GLIDE.ms - 120, easing: 'ease-in-out' }))
    }
  }, [shown, rect])

  if (!shown || !rect) return null

  const index = TOUR.indexOf(shown)
  const inTour = index >= 0
  const last = index === TOUR.length - 1

  // Next (or Got it on the last step) for the tour; Got it for a tip.
  function next() {
    if (tour) {
      const i = TOUR.indexOf(tour)
      if (i + 1 < TOUR.length) setStep(i + 1)
      else finish()
    } else if (tip) seeTip(tip.id)
  }

  // On the tour, a tap on the lit control counts as Next and a tap anywhere else does nothing; a tip
  // closes wherever you tap.
  function tap(e: MouseEvent) {
    if (tip) return seeTip(tip.id)
    if (!rect) return
    const inside = e.clientX >= rect.left - PAD && e.clientX <= rect.right + PAD && e.clientY >= rect.top - PAD && e.clientY <= rect.bottom + PAD
    if (inside) next()
  }

  const vw = window.innerWidth
  const vh = window.innerHeight
  // Below or above, as asked, unless there isn't room on that side.
  const below = shown.place === 'below' ? rect.bottom + GAP + BUBBLE_HEIGHT < vh : rect.top - GAP - BUBBLE_HEIGHT < 0
  const width = Math.min(vw - 32, 360)
  const center = rect.left + rect.width / 2
  const left = Math.min(Math.max(center - width / 2, 16), vw - 16 - width)
  const arrow = Math.min(Math.max(center - left - 8, 14), width - 30)
  const body = (b: Bubble): ReactNode => (
    <>
      <div className={inTour ? 'pr-12' : ''}>
        <LabelTape>{b.title}</LabelTape>
      </div>
      <p className="mt-2.5 mb-3 font-typed text-[15px] leading-relaxed text-ink">{b.text}</p>
    </>
  )

  return (
    <>
      {wanted && <div className="fixed inset-0 z-50" onClick={tap} aria-hidden data-guide-catcher />}
      <div
        ref={spotRef}
        className={`guide-spot ${wanted ? '' : 'guide-out'}`}
        style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + 2 * PAD, height: rect.height + 2 * PAD }}
      >
        <div key={shown.id} className="guide-ring" />
      </div>
      <div
        ref={bubbleRef}
        key={inTour ? 'tour' : shown.id}
        role="dialog"
        aria-label={`Guide: ${shown.title}`}
        className={`paper guide-bubble ${leaving ? 'guide-out' : 'guide-in'}`}
        style={{ left, width, ...(below ? { top: rect.bottom + PAD + GAP } : { bottom: vh - rect.top + PAD + GAP }) }}
      >
        <div className={`guide-arrow ${below ? 'on-top' : 'on-bottom'}`} style={{ left: arrow }} />
        {inTour && (
          <button onClick={finish} className="guide-skip label-text text-xs text-ink/55">
            Skip
          </button>
        )}
        <div ref={wordsRef} className="relative">
          {fading && (
            <div className="guide-words-out absolute inset-x-0 top-0" aria-hidden>
              {body(fading)}
            </div>
          )}
          <div key={shown.id} className={fading ? 'guide-words-in' : ''}>
            {body(shown)}
          </div>
        </div>
        <div className="relative flex items-center justify-between">
          {inTour ? (
            <span className="flex gap-[7px]" aria-label={`Step ${index + 1} of ${TOUR.length}`}>
              {TOUR.map((s, j) => (
                <span key={`${s.id}-${j === index}`} className={`led !h-2 !w-2 ${j === index ? 'led-amber guide-dot-on' : ''}`} />
              ))}
            </span>
          ) : (
            <span />
          )}
          <button onClick={next} className="hw-btn hw-amber px-4 py-2 text-sm">
            {inTour && !last ? 'Next' : 'Got it'}
          </button>
        </div>
      </div>
    </>
  )
}
