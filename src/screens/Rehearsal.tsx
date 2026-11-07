import { useEffect, useMemo, useRef, useState } from 'react'
import { playListen, playNotes, stopSounds } from '../audio/sound'
import { ChordChart } from '../components/ChordChart'
import { ChordDiagram } from '../components/ChordDiagram'
import { CircleOfFifths } from '../components/CircleOfFifths'
import { GlossaryText } from '../components/GlossaryText'
import { MonitorsOffScreen } from '../components/Monitors'
import { Fretboard, useLandscape } from '../components/Fretboard'
import { Notation } from '../components/Notation'
import { Score } from '../components/Score'
import { QuestionStage, useQuestionInput } from '../components/QuestionStage'
import { Staff } from '../components/Staff'
import { BackHeader, Button, LabelTape } from '../components/ui'
import { needsListening, newQuestionId, type Question } from '../game/questions'
import { buildRehearsal, type Card, type Rehearsal } from '../game/rehearsal'
import { goBack, navigate } from '../lib/router'
import { playRhythm } from '../audio/metronome'
import { METER_PULSE } from '../music/rhythm'
import { answerSound, feedbackDetail, type Answer } from '../game/present'
import { isListening } from '../music/curriculum'
import { listeningOff, useProgress } from '../store/progress'

export function RehearsalScreen({ lessonId }: { lessonId: string }) {
  const [attempt, setAttempt] = useState(0)
  // "Rehearse again" deals fresh questions.
  const plan = useMemo(() => buildRehearsal(lessonId), [lessonId, attempt])
  const markRehearsed = useProgress((s) => s.markRehearsed)
  const listening = useProgress((s) => listeningOff(s) === null)
  if (!plan) return <BackHeader title="Track not found" />
  if (!listening && isListening(plan.lesson)) return <MonitorsOffScreen />
  const record = () => {
    markRehearsed(lessonId)
    navigate(`/lesson/${lessonId}`, { replace: true })
  }
  return <RehearsalRunner key={attempt} plan={plan} onRecord={record} onAgain={() => setAttempt((a) => a + 1)} />
}

function RehearsalRunner({ plan, onRecord, onAgain }: { plan: Rehearsal; onRecord: () => void; onAgain: () => void }) {
  const [index, setIndex] = useState(0)
  // How far you've got: checks before this point are done, so revisiting cards skips them.
  const [furthest, setFurthest] = useState(0)
  const step = plan.steps[index]
  const next = () => {
    let i = index + 1
    while (i < furthest && plan.steps[i].kind === 'check') i++
    const to = Math.min(i, plan.steps.length - 1)
    setIndex(to)
    setFurthest((f) => Math.max(f, to))
  }
  /** Back to the card before this step, if there is one. */
  const previousCard = plan.steps.slice(0, index).findLastIndex((s) => s.kind === 'card')
  const back = previousCard >= 0 ? () => setIndex(previousCard) : undefined

  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-edge bg-tolex">
        <div className="flex items-center gap-3 px-3 py-2">
          <button onClick={() => goBack()} className="hw-btn hw-dark px-3 py-1.5 text-sm" aria-label="Back">
            ◂◂
          </button>
          <div className="min-w-0 flex-1">
            <div className="label-text text-[11px] text-muted">{plan.mode === 'learn' ? 'Rehearsal' : 'Warm-up'}</div>
            <div className="truncate text-sm text-cream">{plan.lesson.title}</div>
          </div>
          {step.kind !== 'ready' && (
            <button onClick={onRecord} className="label-text px-1 text-xs text-muted">
              Skip ▸▸
            </button>
          )}
        </div>
        <div className="h-1 bg-[#120e0c]">
          <div className="h-full bg-amber transition-[width] duration-300" style={{ width: `${(index / (plan.steps.length - 1)) * 100}%` }} />
        </div>
      </header>
      {step.kind === 'card' && <CardView key={index} card={step.card} onNext={next} onBack={back} />}
      {step.kind === 'check' && <CheckView key={index} questions={step.questions} onDone={next} onBack={back} />}
      {step.kind === 'ready' && <ReadyView plan={plan} onRecord={onRecord} onAgain={onAgain} />}
    </div>
  )
}

/** A note being introduced: what it is, where it is, and a hook to remember it by. */
function CardView({ card, onNext, onBack }: { card: Card; onNext: () => void; onBack?: () => void }) {
  const landscape = useLandscape()
  const sound = card.sound
  const playhead = useRef<((beat: number | null) => void) | null>(null)
  const canHear = sound.length > 0 || !!card.rhythm || !!card.listen

  function hear() {
    if (card.rhythm) {
      const { measure, bpm } = card.rhythm
      const clock = playRhythm(measure, bpm)
      const end = clock.start + (METER_PULSE[measure.meter].beats * 60000) / bpm
      const step = () => {
        const now = Date.now()
        playhead.current?.(now >= clock.start ? (((now - clock.start) * bpm) / 60000) * METER_PULSE[measure.meter].quarters : null)
        if (now < end) requestAnimationFrame(step)
        else playhead.current?.(null)
      }
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(step)
    } else if (card.listen) {
      playListen(card.listen.notes, card.listen.together, card.listen.chord)
    } else if (sound.length) {
      playNotes(...sound)
    }
  }

  // Cards play only when you press Hear, and stop when you move on (even halfway through).
  useEffect(() => () => stopSounds(), [])

  const paper = (
    <div className="paper px-4 pt-3 pb-4" data-step="card">
      <div className="font-typed text-xs text-ink/60">{card.counter}</div>
      <h1 className="mt-2">
        <LabelTape size="lg">{card.title}</LabelTape>
      </h1>
      <p className="mt-2 font-typed text-sm text-ink/80">{card.subtitle}</p>
      <p className="mt-2 font-typed text-[15px] leading-relaxed">
        <GlossaryText text={card.hook} skip={[card.title]} />
      </p>
      {card.onGuitar && (
        <p className="mt-3 border-t border-ink/15 pt-2 font-typed text-[14px] leading-snug">
          <span className="label-text mr-2 text-[10px] text-amber-dim">On guitar</span>
          <GlossaryText text={card.onGuitar} skip={[card.title]} />
        </p>
      )}
    </div>
  )
  const staff = card.staff ? (
    <div className="paper h-28 shrink-0 px-3 py-1">
      <Staff keys={card.staff.keys} labels={card.staff.labels.length ? card.staff.labels : undefined} />
    </div>
  ) : card.notation ? (
    <div className="paper h-36 shrink-0 px-3 py-1">
      <Notation
        measure={card.notation.measure}
        labels={card.notation.labels}
        blankBeats={card.notation.blankBeats}
        playhead={card.rhythm ? playhead : undefined}
      />
    </div>
  ) : card.score ? (
    <div className="paper h-40 shrink-0 px-3 py-1">
      <Score
        measures={card.score.measures}
        keySig={card.score.keySig}
        meter={card.score.meter}
        labels={card.score.labels}
        marker={card.score.marker}
        colors={card.score.colors}
      />
    </div>
  ) : null
  const board = card.board ? (
    <Fretboard
      minFret={card.board.region.minFret}
      maxFret={card.board.region.maxFret}
      activeStrings={card.board.region.strings}
      markers={card.board.markers}
    />
  ) : card.circle ? (
    <div className="paper h-full p-2">
      <CircleOfFifths majors={card.circle.majors} minors={card.circle.minors} />
    </div>
  ) : card.diagram ? (
    <div className="paper mx-auto h-full max-h-80 w-full max-w-[240px] px-3 py-2">
      <ChordDiagram {...card.diagram} />
    </div>
  ) : card.chart ? (
    <div className="paper w-full px-2 py-2">
      <ChordChart {...card.chart} />
    </div>
  ) : null
  // Three equal slots, centered: back, hear, next. Empty slots keep the others from shifting.
  const controls = (
    <div className="grid grid-cols-3 gap-3">
      {onBack ? (
        <Button variant="dark" className="flex items-center justify-center" onClick={onBack} aria-label="Previous card">
          <TransportIcon kind="back" />
        </Button>
      ) : (
        <span />
      )}
      {canHear ? (
        <Button variant="dark" className="flex items-center justify-center gap-2" onClick={hear} aria-label="Hear it again">
          <TransportIcon kind="play" />
          Hear
        </Button>
      ) : (
        <span />
      )}
      <Button className="flex items-center justify-center" onClick={onNext} aria-label="Next">
        <TransportIcon kind="next" />
      </Button>
    </div>
  )

  if (landscape) {
    return (
      <div className="flex min-h-0 flex-1 gap-4 p-3">
        {board && <div className="min-h-0 flex-1">{board}</div>}
        <div className={`flex min-h-0 flex-col gap-3 overflow-y-auto ${board ? 'w-[42%] max-w-md' : 'mx-auto w-full max-w-md'}`}>
          {paper}
          {staff}
          <div className="flex-1" />
          {controls}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-4">
      {paper}
      {staff}
      {board ? <div className="min-h-0 flex-1">{board}</div> : <div className="flex-1" />}
      <div className="pb-[max(1rem,env(safe-area-inset-bottom))]">{controls}</div>
    </div>
  )
}

/** Tape-deck transport symbols, drawn so they sit dead center in their keys. */
function TransportIcon({ kind }: { kind: 'back' | 'play' | 'next' }) {
  const shapes = { back: ['M11 2 L3 8 L11 14 Z'], play: ['M3 2 L12 8 L3 14 Z'], next: ['M1 2 L8 8 L1 14 Z', 'M9 2 L16 8 L9 14 Z'] }[kind]
  return (
    <svg viewBox={kind === 'next' ? '0 0 17 16' : '0 0 14 16'} className="h-4 w-auto" fill="currentColor" aria-hidden>
      {shapes.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

/** Quick recall right after the cards. No clips: a miss shows the answer and the question comes back. */
function CheckView({ questions, onDone, onBack }: { questions: Question[]; onDone: () => void; onBack?: () => void }) {
  const autoContinue = useProgress((s) => s.settings.autoContinue)
  const pauseListening = useProgress((s) => s.pauseListening)
  const landscape = useLandscape()
  const [queue, setQueue] = useState(questions)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const q = queue[index]
  const doneRef = useRef(false)

  function submit(ok: boolean, detail: Omit<Answer, 'ok' | 'ms'> = {}) {
    if (answer) return
    setAnswer({ ok, ms: 0, ...detail })
    if (ok) {
      playNotes(...answerSound(q, detail.tapped))
    } else {
      // Ask it again shortly, after one other question if there is one.
      setQueue((qs) => {
        const copy = [...qs]
        copy.splice(Math.min(index + 2, copy.length), 0, { ...q, id: newQuestionId() })
        return copy
      })
    }
  }

  const input = useQuestionInput(q, answer, submit)

  function next() {
    if (index + 1 >= queue.length) {
      if (!doneRef.current) {
        doneRef.current = true
        onDone()
      }
      return
    }
    setIndex((i) => i + 1)
    setAnswer(null)
  }

  useEffect(() => {
    if (!answer?.ok || !autoContinue) return
    const timer = setTimeout(next, 800)
    return () => clearTimeout(timer)
    // `next` is recreated each render; the answer changing is what matters.
  }, [answer])

  const feedback = answer && (
    <div
      className={`slide-up bg-tolex px-5 pt-4 ${landscape ? 'rounded-lg border-2 pb-4' : 'border-t-2 pb-[max(1rem,env(safe-area-inset-bottom))]'} ${
        answer.ok ? 'border-led/60' : 'border-amber/60'
      }`}
      role="status"
      data-result={answer.ok ? 'clean' : 'clipped'}
    >
      <div className="flex items-center gap-2.5">
        <span className={`led ${answer.ok ? 'led-green' : 'led-amber'}`} />
        <span className={`label-text text-lg ${answer.ok ? 'text-led' : 'text-amber'}`}>{answer.ok ? 'Got it' : 'Not yet'}</span>
        {!answer.ok && <span className="ml-auto text-xs text-muted">It’ll come back in a moment</span>}
      </div>
      <p className="mt-1.5 min-h-[2.75rem] text-[15px] leading-snug text-cream">
        <GlossaryText text={feedbackDetail(q, answer)} />
      </p>
      <Button variant={answer.ok ? 'amber' : 'cream'} className="mt-3" onClick={next}>
        Next ▸▸
      </Button>
    </div>
  )

  return (
    <QuestionStage
      q={q}
      answer={answer}
      found={input.found}
      onTap={input.tap}
      onPick={input.pick}
      onRhythm={input.rhythm}
      allowListen
      onCantListen={needsListening(q) ? pauseListening : undefined}
      label={
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className="led led-green !h-2 !w-2" />
          <span className="label-text text-[10px] text-muted">Quick check · no clips</span>
          {onBack && (
            <button onClick={onBack} aria-label="Back to the card" className="hw-btn hw-dark ml-auto px-2.5 py-0.5 text-xs">
              ◂
            </button>
          )}
        </div>
      }
      feedback={feedback}
    />
  )
}

function ReadyView({ plan, onRecord, onAgain }: { plan: Rehearsal; onRecord: () => void; onAgain: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-6 py-8">
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <div className="flex items-center gap-2">
          <span className="led led-green" />
          <span className="label-text text-sm text-cream">{plan.mode === 'learn' ? 'Rehearsed' : 'Warmed up'}</span>
        </div>
        <LabelTape size="lg" className="-rotate-1">
          Ready to record
        </LabelTape>
        <p className="max-w-xs text-muted">
          {plan.mode === 'learn'
            ? `You’ve rehearsed ${plan.newCount} new ${plan.noun}${plan.newCount === 1 ? '' : 's'}. Now record the take: three clips and it’s ruined.`
            : 'Now record the take: three clips and it’s ruined.'}
        </p>
      </div>
      <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
        <Button variant="rec" onClick={onRecord}>
          ● Record take
        </Button>
        <Button variant="dark" onClick={onAgain}>
          ◂◂ Rehearse again
        </Button>
      </div>
    </div>
  )
}
