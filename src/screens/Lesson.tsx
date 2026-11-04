import { useEffect, useMemo, useRef, useState } from 'react'
import { playNotes, playStrum, playWrong } from '../audio/sound'
import { useLandscape } from '../components/Fretboard'
import { MonitorsOffScreen } from '../components/Monitors'
import { QuestionStage, useQuestionInput } from '../components/QuestionStage'
import { Button, ClipLeds, LabelTape, Reels } from '../components/ui'
import { drillFromQuery } from '../game/drill'
import { answerSound, feedbackDetail, type Answer } from '../game/present'
import { buildJam, recordedOn, THEORY_JAMS } from '../game/jams'
import { buildSession, FLUENT_MS, needsListening, newQuestionId, type Question } from '../game/questions'
import { buildReview, buildTroubleSpots, mixInReview } from '../game/review'
import { today } from '../lib/date'
import { findLesson, isListening } from '../music/curriculum'
import { goBack } from '../lib/router'
import { currentStreak, listeningOff, RATING_NAMES, ratingFor, useProgress, type Rating } from '../store/progress'

/** Clip three times and the take is ruined. */
const MAX_CLIPS = 3
const PRAISE = ['Clean take', 'Nailed it', 'In the pocket', 'Tight', 'Dialed in', 'On the money']

interface Summary {
  nailed: number
  accuracy: number
  /** Correct answers inside the fluency target, out of correct timed answers. */
  onBeat: number
  timed: number
  /** Only lessons get a rating; drills don't. */
  rating: Rating | null
  streakExtended: boolean
}

// ---------------------------------------------------------------------------
// Entry points for each kind of session
// ---------------------------------------------------------------------------

export function LessonScreen({ lessonId }: { lessonId: string }) {
  const found = useMemo(() => findLesson(lessonId), [lessonId])
  const [attempt, setAttempt] = useState(0)
  const listening = useProgress((s) => listeningOff(s) === null)
  // A new attempt deals a fresh set of questions, with any due review from earlier tapes mixed in.
  const questions = useMemo(() => {
    if (!found) return []
    const state = useProgress.getState()
    return mixInReview(buildSession(found.lesson, state.stats), found.lesson, state.stats, today(), Math.random, listeningOff(state) === null)
  }, [found, attempt])
  if (!found) return <Unavailable message="That track doesn’t exist." />
  if (!listening && isListening(found.lesson)) return <MonitorsOffScreen />
  return (
    <LessonRunner key={attempt} questions={questions} lessonId={lessonId} title={found.lesson.title} onRetry={() => setAttempt((a) => a + 1)} />
  )
}

export function DrillScreen({ query }: { query: URLSearchParams }) {
  const search = query.toString()
  const spec = useMemo(() => drillFromQuery(new URLSearchParams(search)), [search])
  const [attempt, setAttempt] = useState(0)
  const questions = useMemo(() => buildSession(spec, useProgress.getState().stats), [spec, attempt])
  if (questions.length === 0) return <Unavailable message="No questions fit those settings. Try more strings or frets." />
  return <LessonRunner key={attempt} questions={questions} title="Jam session" onRetry={() => setAttempt((a) => a + 1)} />
}

export function WeakSpotScreen() {
  const [attempt, setAttempt] = useState(0)
  const questions = useMemo(() => {
    const state = useProgress.getState()
    return buildTroubleSpots(state.stats, Math.random, listeningOff(state) === null)
  }, [attempt])
  if (!questions) return <Unavailable message="Record a few tracks first. Then this will drill the notes you miss most." />
  return <LessonRunner key={attempt} questions={questions} title="Trouble spots" onRetry={() => setAttempt((a) => a + 1)} />
}

/** A theory jam from the Jam room: ten quick questions from the tracks you've recorded on its tapes. */
export function TheoryJamScreen({ jamId }: { jamId: string }) {
  const jam = THEORY_JAMS.find((j) => j.id === jamId)
  const [attempt, setAttempt] = useState(0)
  const listening = useProgress((s) => listeningOff(s) === null)
  const questions = useMemo(() => {
    const { lessons, stats } = useProgress.getState()
    return jam ? buildJam(recordedOn(jam.tapes, lessons), stats, 10) : []
  }, [jam, attempt])
  if (jam?.id === 'ear' && !listening) return <MonitorsOffScreen />
  if (!jam || !questions.length) return <Unavailable message="Record a track on one of its tapes first, then this jam will mix questions from it." />
  return <LessonRunner key={attempt} questions={questions} title={`Theory jam · ${jam.label}`} onRetry={() => setAttempt((a) => a + 1)} />
}

/** The optional review session: up to 12 due notes and ideas from earlier tapes. */
export function ReviewScreen() {
  const [attempt, setAttempt] = useState(0)
  const questions = useMemo(() => {
    const state = useProgress.getState()
    return buildReview(state.stats, today(), REVIEW_SESSION, Math.random, undefined, listeningOff(state) === null)
  }, [attempt])
  if (!questions.length) return <Unavailable message="Nothing’s due for review. Reviews also mix into every take, so you’re not missing anything." />
  return <LessonRunner key={attempt} questions={questions} title="Review" onRetry={() => setAttempt((a) => a + 1)} />
}

export const REVIEW_SESSION = 12

function Unavailable({ message }: { message: string }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6 px-8 text-center">
      <span className="led" />
      <p className="text-lg text-muted">{message}</p>
      <Button variant="dark" className="max-w-xs" onClick={() => goBack()}>
        ◂◂ Back
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The lesson itself
// ---------------------------------------------------------------------------

function LessonRunner({
  questions,
  lessonId,
  title,
  onRetry,
}: {
  questions: Question[]
  lessonId?: string
  title: string
  onRetry: () => void
}) {
  const recordAnswer = useProgress((s) => s.recordAnswer)
  const completeSession = useProgress((s) => s.completeSession)
  const pauseListening = useProgress((s) => s.pauseListening)
  const autoContinue = useProgress((s) => s.settings.autoContinue)
  const landscape = useLandscape()

  const [queue, setQueue] = useState(questions)
  const [index, setIndex] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [onBeat, setOnBeat] = useState(0)
  const [timed, setTimed] = useState(0)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [failed, setFailed] = useState(false)
  const questionStart = useRef(Date.now())

  const q = queue[index]

  function submit(ok: boolean, detail: Omit<Answer, 'ok' | 'ms'> = {}) {
    if (answer) return
    const ms = Date.now() - questionStart.current
    const target = FLUENT_MS[q.kind] ?? null
    recordAnswer(q.facts, ok, ms, target)
    setAnswer({ ok, ms, ...detail })
    if (ok) {
      setCorrect((c) => c + 1)
      if (target) {
        setTimed((t) => t + 1)
        if (ms <= target) setOnBeat((n) => n + 1)
      }
      playNotes(...answerSound(q, detail.tapped))
    } else if (q.review) {
      // Review misses don't clip the take; the schedule just brings that note back sooner.
      playWrong()
    } else {
      playWrong()
      setMistakes((m) => m + 1)
      // Missed questions come back at the end of the lesson.
      setQueue((qs) => [...qs, { ...q, id: newQuestionId() }])
    }
  }

  const input = useQuestionInput(q, answer, submit)

  function next() {
    if (mistakes >= MAX_CLIPS) return setFailed(true)
    if (index + 1 >= queue.length) return finish()
    setIndex((i) => i + 1)
    setAnswer(null)
    questionStart.current = Date.now()
  }

  function finish() {
    const { streakExtended } = completeSession({ lessonId, nailed: correct, mistakes })
    playStrum()
    setSummary({
      nailed: correct,
      accuracy: correct / (correct + mistakes),
      onBeat,
      timed,
      rating: lessonId ? ratingFor(mistakes) : null,
      streakExtended,
    })
  }

  // Correct answers move on by themselves (if enabled); wrong ones wait so you can study the fix.
  useEffect(() => {
    if (!answer?.ok || !autoContinue) return
    const timer = setTimeout(next, 1100)
    return () => clearTimeout(timer)
    // `next` is recreated each render; the answer changing is what matters.
  }, [answer])

  /**
   * "Can't listen now": listening questions still to come (this one too) drop out of the take. An
   * ear-training track is all listening, so it's left unrecorded and swapped for the monitors-off screen.
   */
  function cantListen() {
    pauseListening()
    if (lessonId && queue.every(needsListening)) return
    const rest = queue.slice(index).filter((x) => !needsListening(x))
    if (!rest.length) return finish()
    setQueue([...queue.slice(0, index), ...rest])
    setAnswer(null)
    questionStart.current = Date.now()
  }

  function quit() {
    if ((index === 0 && !answer) || window.confirm('Stop recording? You’ll lose this take.')) goBack()
  }

  if (summary) return <CompleteScreen summary={summary} title={title} />
  if (failed) return <FailedScreen onRetry={onRetry} />

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-edge bg-tolex px-3 py-2">
        <button onClick={quit} aria-label="Stop recording" className="hw-btn hw-dark px-2.5 py-1.5 text-sm">
          ■
        </button>
        <Reels value={(index + (answer ? 1 : 0)) / queue.length} counter={index + 1} />
        <ClipLeds clips={mistakes} max={MAX_CLIPS} />
      </header>
      <QuestionStage
        q={q}
        answer={answer}
        found={input.found}
        onTap={input.tap}
        onPick={input.pick}
        onRhythm={input.rhythm}
        onCantListen={needsListening(q) ? cantListen : undefined}
        label={
          q.review ? (
            <div className="mb-0.5 flex items-center gap-1.5">
              <span className="font-label text-sm leading-none text-amber">↺</span>
              <span className="label-text truncate text-[10px] text-amber">Review · from tape {q.review.tape}</span>
            </div>
          ) : (
            <div className="mb-0.5 flex items-center gap-1.5">
              <span className="led led-red blink !h-2 !w-2" />
              <span className="label-text truncate text-[10px] text-muted">Rec · {title}</span>
            </div>
          )
        }
        feedback={answer && <FeedbackPanel q={q} answer={answer} rounded={landscape} onContinue={next} />}
      />
    </div>
  )
}

function FeedbackPanel({ q, answer, rounded, onContinue }: { q: Question; answer: Answer; rounded: boolean; onContinue: () => void }) {
  const ok = answer.ok
  // A missed review question isn't a clip: it's a nudge that the note needs another look soon.
  const reviewMiss = !ok && !!q.review
  return (
    <div
      className={`slide-up bg-tolex px-5 pt-4 ${rounded ? 'rounded-lg border-2 pb-4' : 'border-t-2 pb-[max(1rem,env(safe-area-inset-bottom))]'} ${
        ok ? 'border-led/60' : reviewMiss ? 'border-amber/60' : 'border-rec/70'
      }`}
      role="status"
      data-result={ok ? 'clean' : reviewMiss ? 'review-miss' : 'clipped'}
    >
      <div className="flex items-center gap-2.5">
        <span className={`led ${ok ? 'led-green' : reviewMiss ? 'led-amber' : 'led-red'}`} />
        <span className={`label-text text-lg ${ok ? 'text-led' : reviewMiss ? 'text-amber' : 'text-rec'}`}>
          {ok ? PRAISE[q.id % PRAISE.length] : reviewMiss ? 'Not yet' : 'Clipped'}
        </span>
        {ok && <Pace kind={q.kind} ms={answer.ms} />}
        {reviewMiss && <span className="ml-auto text-xs text-muted">No clip. It’ll come back soon.</span>}
      </div>
      <p className="mt-1.5 min-h-[2.75rem] text-[15px] leading-snug text-cream">{feedbackDetail(q, answer)}</p>
      <Button variant={ok ? 'amber' : 'cream'} className="mt-3" onClick={onContinue}>
        Next ▸▸
      </Button>
    </div>
  )
}

/** How fast a correct answer was, against the fluency target. */
function Pace({ kind, ms }: { kind: Question['kind']; ms: number }) {
  const target = FLUENT_MS[kind]
  if (!target) return null
  const fast = ms <= target
  return (
    <span className={`ml-auto font-mono text-xs ${fast ? 'text-led' : 'text-amber'}`}>
      {(ms / 1000).toFixed(1)}s · {fast ? 'on the beat' : `dragging, aim for ${target / 1000}s`}
    </span>
  )
}

// ---------------------------------------------------------------------------
// End screens
// ---------------------------------------------------------------------------

function EndReadout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="lcd w-full py-2 text-center text-xl">{value}</span>
      <span className="label-text text-[10px] text-muted">{label}</span>
    </div>
  )
}

function CompleteScreen({ summary, title }: { summary: Summary; title: string }) {
  const streak = useProgress((s) => currentStreak(s.streak))
  const date = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return (
    <div className="flex h-dvh flex-col px-6 py-8">
      <div className="flex flex-1 flex-col items-center justify-center gap-7">
        <div className="flex items-center gap-2">
          <span className="led led-green" />
          <span className="label-text text-sm text-cream">Take recorded</span>
        </div>
        {/* The finished take, labeled like a cassette, with its rating stamped on. */}
        <div className="paper relative w-full max-w-sm px-5 pt-3 pb-7">
          <div className="flex justify-between font-typed text-xs text-ink/70">
            <span>Side A</span>
            <span>{date}</span>
          </div>
          <div className="mt-1 h-1.5 bg-amber-dim" />
          <h1 className="mt-4 -rotate-1">
            <LabelTape size="lg">{title}</LabelTape>
          </h1>
          {summary.rating && (
            <div className="stamp label-text absolute right-4 bottom-2.5 rounded border-2 border-[#b5473a] px-2 py-0.5 text-sm text-[#b5473a]">
              {RATING_NAMES[summary.rating]}
            </div>
          )}
        </div>
        <div className="grid w-full max-w-sm grid-cols-3 gap-3">
          <EndReadout label="Notes" value={`+${summary.nailed}`} />
          <EndReadout label="Accuracy" value={`${Math.round(summary.accuracy * 100)}%`} />
          <EndReadout label="On the beat" value={summary.timed ? `${summary.onBeat}/${summary.timed}` : '—'} />
        </div>
        {summary.streakExtended && (
          <p className="label-text text-sm text-amber">
            {streak === 1 ? 'First session today' : `Day ${streak} in a row`}
          </p>
        )}
      </div>
      <Button className="mx-auto max-w-sm" onClick={() => goBack()}>
        Done ▸▸
      </Button>
    </div>
  )
}

function FailedScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-dvh flex-col px-6 py-8 text-center">
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="flex gap-2">
          {Array.from({ length: MAX_CLIPS }, (_, i) => (
            <span key={i} className="led led-red !h-3.5 !w-3.5" />
          ))}
        </div>
        <h1 className="label-text text-3xl text-cream">Take ruined</h1>
        <p className="max-w-xs text-muted">Three clips. Rewind and run it again. The notes you missed will come up more often.</p>
      </div>
      <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
        <Button onClick={onRetry}>◂◂ Rewind and retry</Button>
        <Button variant="dark" onClick={() => goBack()}>
          ■ Stop
        </Button>
      </div>
    </div>
  )
}
