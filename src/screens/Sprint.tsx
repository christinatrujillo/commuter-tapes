import { useEffect, useMemo, useRef, useState } from 'react'
import { playNotes, playStrum, playWrong } from '../audio/sound'
import { QuestionStage } from '../components/QuestionStage'
import { Button } from '../components/ui'
import { answerSound, pickIsCorrect } from '../game/present'
import { namedIntervals, namedKeys } from '../game/jams'
import { buildFromPositions, buildSession, FLUENT_MS, isPick, practicedPositions, type Question, type Stats } from '../game/questions'
import { goBack } from '../lib/router'
import { ALL_STRINGS, describePosition, FULL_NECK, midiAt, pcName, pitchClass, samePos, spelledName, stringName, type Position } from '../music/notes'
import { KEYS } from '../music/score'
import { useProgress, type LessonRecord } from '../store/progress'

export const SPRINT_SECONDS = 60
/** Practiced-spots sprints need enough spots to keep from repeating. */
const MIN_PRACTICED_SPOTS = 6

type Lessons = Record<string, LessonRecord>

export interface SprintPreset {
  id: string
  label: string
  /** Whether you've learned enough for this sprint, and what to do if not. */
  ready: (stats: Stats, lessons: Lessons) => boolean
  sealed: string
  build: (stats: Stats, lessons: Lessons) => Question[]
}

const LOTS = 150

export const SPRINT_PRESETS: SprintPreset[] = [
  {
    id: 'practiced',
    label: 'Spots you’ve practiced',
    ready: (stats) => practicedPositions(stats).length >= MIN_PRACTICED_SPOTS,
    sealed: `Practice at least ${MIN_PRACTICED_SPOTS} spots to unlock this one.`,
    build: (stats) => buildFromPositions(practicedPositions(stats), stats, LOTS),
  },
  {
    id: 'low',
    label: 'Low E & A',
    ready: () => true,
    sealed: '',
    build: (stats) =>
      buildSession({ id: 'sprint', title: 'Sprint', exercises: ['name', 'find'], region: { strings: [0, 1], minFret: 0, maxFret: 12 }, count: LOTS }, stats),
  },
  {
    id: 'neck',
    label: 'Whole neck',
    ready: () => true,
    sealed: '',
    build: (stats) => buildSession({ id: 'sprint', title: 'Sprint', exercises: ['name', 'find'], region: FULL_NECK, count: LOTS }, stats),
  },
  {
    id: 'staff',
    label: 'Staff reading',
    ready: () => true,
    sealed: '',
    build: (stats) =>
      buildSession(
        { id: 'sprint', title: 'Sprint', exercises: ['staffName', 'staffFind'], region: { strings: ALL_STRINGS, minFret: 0, maxFret: 3 }, count: LOTS },
        stats,
      ),
  },
  {
    id: 'keys',
    label: 'Keys',
    ready: (_, lessons) => namedKeys(lessons).length >= 2,
    sealed: 'Record “Name the key” on the Key signatures tape to unlock this one.',
    build: (stats, lessons) =>
      buildSession({ id: 'sprint', title: 'Sprint', exercises: ['keyName', 'keySignature'], region: FULL_NECK, keys: namedKeys(lessons), count: LOTS }, stats),
  },
  {
    id: 'intervals',
    label: 'Intervals',
    ready: (_, lessons) => !!lessons['t6-1']?.stars || namedIntervals(lessons).length >= 2,
    sealed: 'Record a track on the Naming intervals tape to unlock this one.',
    build: (stats, lessons) => {
      const names = namedIntervals(lessons)
      const exercises = [...(lessons['t6-1']?.stars ? (['ivNumber'] as const) : []), ...(names.length >= 2 ? (['ivName'] as const) : [])]
      return buildSession({ id: 'sprint', title: 'Sprint', exercises, region: FULL_NECK, ivNames: names, count: LOTS }, stats)
    },
  },
]

export function SprintScreen({ presetId }: { presetId: string }) {
  const preset = SPRINT_PRESETS.find((p) => p.id === presetId) ?? SPRINT_PRESETS[1]
  const [attempt, setAttempt] = useState(0)
  // A new attempt deals a fresh run of questions.
  const questions = useMemo(() => {
    const { stats, lessons } = useProgress.getState()
    return preset.ready(stats, lessons) ? preset.build(stats, lessons) : null
  }, [preset, attempt])
  if (!questions) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-6 px-8 text-center">
        <p className="text-lg text-muted">{preset.sealed}</p>
        <Button variant="dark" className="max-w-xs" onClick={() => goBack()}>
          ◂◂ Back
        </Button>
      </div>
    )
  }
  return <SprintRunner key={attempt} preset={preset} questions={questions} onAgain={() => setAttempt((a) => a + 1)} />
}

type Phase = 'countin' | 'running' | 'done'

interface Flash {
  ok: boolean
  tapped?: Position
  picked?: number
}

/** One minute, as many right answers as possible. Wrong answers just cost time. */
function SprintRunner({ preset, questions, onAgain }: { preset: SprintPreset; questions: Question[]; onAgain: () => void }) {
  const recordAnswer = useProgress((s) => s.recordAnswer)
  const completeSession = useProgress((s) => s.completeSession)
  const recordBest = useProgress((s) => s.recordBest)
  const [previousBest] = useState(() => useProgress.getState().bests[preset.id] ?? 0)

  const [phase, setPhase] = useState<Phase>('countin')
  const [count, setCount] = useState(3)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [misses, setMisses] = useState<Question[]>([])
  const [flash, setFlash] = useState<Flash | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [newBest, setNewBest] = useState(false)
  const endAt = useRef(0)
  const questionStart = useRef(0)
  const phaseRef = useRef<Phase>('countin')
  phaseRef.current = phase

  // Count-in: 3, 2, 1, go.
  useEffect(() => {
    if (phase !== 'countin') return
    if (count === 0) {
      const start = Date.now()
      endAt.current = start + SPRINT_SECONDS * 1000
      questionStart.current = start
      setNow(start)
      setPhase('running')
      return
    }
    const timer = setTimeout(() => setCount((c) => c - 1), 700)
    return () => clearTimeout(timer)
  }, [phase, count])

  useEffect(() => {
    if (phase !== 'running') return
    const timer = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'running' || now < endAt.current) return
    setPhase('done')
    completeSession({ nailed: score, mistakes: misses.length })
    setNewBest(recordBest(preset.id, score))
    // Runs when the clock passes the end; score and misses are current at that render.
  }, [now, phase])

  const q = questions[index % questions.length]

  function submit(ok: boolean, detail: Omit<Flash, 'ok'> = {}) {
    if (flash || phase !== 'running') return
    recordAnswer(q.facts, ok, Date.now() - questionStart.current, FLUENT_MS[q.kind] ?? null)
    setFlash({ ok, ...detail })
    if (ok) {
      setScore((s) => s + 1)
      playNotes(...answerSound(q, detail.tapped))
    } else {
      setMisses((m) => [...m, q])
      playWrong()
    }
    // A quick flash on a right answer; a longer look at the fix on a wrong one.
    setTimeout(
      () => {
        if (phaseRef.current !== 'running') return
        setFlash(null)
        setIndex((i) => i + 1)
        questionStart.current = Date.now()
      },
      ok ? 250 : 900,
    )
  }

  function tap(p: Position) {
    if (q.kind === 'find' || q.kind === 'staffFind') submit(q.targets.some((t) => samePos(t, p)), { tapped: p })
  }

  function pick(value: number) {
    submit(pickIsCorrect(q, value), { picked: value })
  }

  if (phase === 'countin') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 text-center">
        <span className="label-text text-xs text-muted">Count-in</span>
        <span className="font-label text-8xl text-amber">{count || 'Go'}</span>
        <span className="text-cream">{preset.label}</span>
        <span className="text-sm text-muted">Best so far: {previousBest || '—'}</span>
      </div>
    )
  }

  if (phase === 'done') {
    return <SprintDone preset={preset} score={score} previousBest={previousBest} newBest={newBest} misses={misses} onAgain={onAgain} />
  }

  const remaining = Math.max(0, Math.ceil((endAt.current - now) / 1000))

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-edge bg-tolex">
        <div className="flex items-center gap-3 px-3 py-2">
          <button onClick={() => goBack()} aria-label="Stop sprint" className="hw-btn hw-dark px-2.5 py-1.5 text-sm">
            ■
          </button>
          <span className="min-w-0 flex-1 truncate text-sm text-cream">{preset.label}</span>
          <span className={`lcd px-2 py-0.5 text-lg ${remaining <= 10 ? '!text-rec' : ''}`} aria-label={`${remaining} seconds left`}>
            0:{String(remaining).padStart(2, '0')}
          </span>
          <span className="lcd px-2 py-0.5 text-lg" aria-label={`Score ${score}`}>
            {String(score).padStart(2, '0')}
          </span>
        </div>
        <div className="h-1 bg-[#120e0c]">
          <div className="h-full bg-amber transition-[width] duration-100" style={{ width: `${(remaining / SPRINT_SECONDS) * 100}%` }} />
        </div>
      </header>
      <QuestionStage q={q} answer={flash ? { ...flash, ms: 0 } : null} found={[]} onTap={tap} onPick={pick} onRhythm={() => {}} />
    </div>
  )
}

/** Short description of a missed question, for the end screen. */
function missLabel(q: Question): string {
  if (isPick(q)) return q.ask.hl ?? q.ask.text
  switch (q.kind) {
    case 'name':
      return `${pcName(pitchClass(midiAt(q.target)))} · ${describePosition(q.target)}`
    case 'find':
      return `${q.label} on the ${stringName(q.string)} string`
    case 'staffName':
    case 'staffFind':
      return `${spelledName(q.note, true)} on the staff`
    case 'keyName':
      return `${KEYS[q.key].name} key signature`
    default:
      return ''
  }
}

function SprintDone({
  preset,
  score,
  previousBest,
  newBest,
  misses,
  onAgain,
}: {
  preset: SprintPreset
  score: number
  previousBest: number
  newBest: boolean
  misses: Question[]
  onAgain: () => void
}) {
  const uniqueMisses = [...new Set(misses.map(missLabel))].filter(Boolean).slice(0, 6)
  // The strum plays here, after the last question has stopped its own sounds.
  useEffect(() => playStrum(), [])
  return (
    <div className="flex h-dvh flex-col px-6 py-8">
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <span className="label-text text-sm text-cream">Time</span>
        <div className="relative">
          <span className="lcd block px-6 py-3 text-6xl">{String(score).padStart(2, '0')}</span>
          {newBest && (
            <span className="stamp label-text absolute -right-6 -bottom-4 rounded border-2 border-rec bg-room px-2 py-0.5 text-sm text-rec">
              New best
            </span>
          )}
        </div>
        <p className="text-muted">
          right answers in {SPRINT_SECONDS} seconds · {preset.label}
        </p>
        <p className="text-sm text-muted">
          {newBest ? (previousBest ? `Previous best: ${previousBest}` : 'First sprint of this kind') : `Best: ${previousBest}`}
        </p>
        {uniqueMisses.length > 0 && (
          <div className="mt-2 w-full max-w-sm text-left">
            <h2 className="label-text mb-2 text-[11px] text-muted">Missed</h2>
            <ul className="flex flex-col gap-1 text-sm text-cream">
              {uniqueMisses.map((m) => (
                <li key={m}>· {m}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
        <Button onClick={onAgain}>◂◂ Again</Button>
        <Button variant="dark" onClick={() => goBack()}>
          Done ▸▸
        </Button>
      </div>
    </div>
  )
}
