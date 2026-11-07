import { useEffect, useRef, useState, type ReactNode } from 'react'
import { playListen, playNotes, stopSounds } from '../audio/sound'
import { correctPick, hintText, markersFor, phraseNotes, pickIsCorrect, promptText, usesBoard, type Answer, type TapResult } from '../game/present'
import { isPick, isTap, type Question } from '../game/questions'
import { samePos, midiAt, spelledName, vexKey, type Position } from '../music/notes'
import { countAt, onsets, SYMBOLS } from '../music/rhythm'
import { KEYS, MOTION_NAMES, resolveNotes } from '../music/score'
import { Score } from './Score'
import { IntervalButtons, NoteButtons, OptionButtons } from './AnswerButtons'
import { Fretboard, useLandscape } from './Fretboard'
import { ChordChart } from './ChordChart'
import { ChordDiagram } from './ChordDiagram'
import { CantListenButton, HeadphonesIcon } from './Monitors'
import { Notation } from './Notation'
import { Staff } from './Staff'
import { TapRhythm } from './TapRhythm'

type Submit = (ok: boolean, detail?: Omit<Answer, 'ok' | 'ms'>) => void

/**
 * Taps this soon after a question appears are ignored, so a click meant for the last
 * question's Next button can't land on this one's answers.
 */
const INPUT_GUARD_MS = 400

/** Turns taps and button presses into answers. Shared by lessons and rehearsals. */
export function useQuestionInput(q: Question, answer: Answer | null, submit: Submit) {
  const [found, setFound] = useState<{ id: number; spots: Position[] }>({ id: q.id, spots: [] })
  const spots = found.id === q.id ? found.spots : []
  const shown = useRef({ id: q.id, at: Date.now() })
  if (shown.current.id !== q.id) shown.current = { id: q.id, at: Date.now() }
  const settling = () => Date.now() - shown.current.at < INPUT_GUARD_MS

  function tap(p: Position) {
    if (answer || settling()) return
    if (isTap(q)) return submit(q.targets.some((t) => samePos(t, p)), { tapped: p })
    switch (q.kind) {
      case 'find':
      case 'staffFind':
      case 'interval':
        return submit(q.targets.some((t) => samePos(t, p)), { tapped: p })
      case 'findAll': {
        if (spots.some((f) => samePos(f, p))) return
        if (!q.targets.some((t) => samePos(t, p))) return submit(false, { tapped: p })
        const now = [...spots, p]
        setFound({ id: q.id, spots: now })
        if (now.length === q.targets.length) submit(true, { tapped: p })
        else playNotes(midiAt(p))
        return
      }
      case 'keyNote':
        if (q.mode === 'find') submit(q.targets.some((t) => samePos(t, p)), { tapped: p })
        return
      case 'phrase': {
        // Notes are played in order; `found` holds the spots tapped so far (a repeated note can repeat a spot).
        const at = spots.length
        if (!q.targets[at]?.some((t) => samePos(t, p))) return submit(false, { tapped: p, picked: at })
        const now = [...spots, p]
        setFound({ id: q.id, spots: now })
        if (now.length === q.targets.length) submit(true, { tapped: p })
        else playNotes(midiAt(p))
        return
      }
    }
  }

  function pick(value: number) {
    if (!answer && !settling()) submit(pickIsCorrect(q, value), { picked: value })
  }

  function rhythm(result: TapResult) {
    if (!answer) submit(result.hits === result.total && result.extra === 0, { rhythm: result })
  }

  return { found: spots, tap, pick, rhythm }
}

const BEAT_LABELS: Record<number, string> = { 0.5: '½', 1.5: '1½' }

interface StageProps {
  q: Question
  answer: Answer | null
  found: Position[]
  /** Small line above the question ("● Rec · Frets 0–5", "Quick check · no clips"). */
  label?: ReactNode
  /** Shown in place of the answer controls once answered. */
  feedback?: ReactNode
  onTap: (p: Position) => void
  onPick: (value: number) => void
  onRhythm: (result: TapResult) => void
  /** Let rhythm questions play the rhythm first (rehearsals). */
  allowListen?: boolean
  /** Offers "Can't listen now" on ear questions. */
  onCantListen?: () => void
}

/** Lays out a question: prompt, what to read (staff, notation or fretboard), and how to answer. */
export function QuestionStage({ q, answer, found, label, feedback, onTap, onPick, onRhythm, allowListen, onCantListen }: StageProps) {
  const landscape = useLandscape()
  const hint = hintText(q, found)
  const result = answer && answer.picked !== undefined ? { picked: answer.picked, correct: correctPick(q) } : null

  // Ear questions play their notes as they appear. Moving on to the next question cuts off
  // anything this one was still playing: its notes, an answer's sound, a count-in.
  const listen = isPick(q) || isTap(q) ? q.listen : undefined
  useEffect(() => {
    if (listen) playListen(listen.notes, listen.together, listen.chord)
    return () => stopSounds()
  }, [q.id])
  const listenKeys = listen && (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button onClick={() => playListen(listen.notes, listen.together, listen.chord)} className="hw-btn hw-amber px-4 py-2 text-sm">
        ▶ Hear again
      </button>
      {onCantListen && !answer && <CantListenButton onPress={onCantListen} />}
    </div>
  )

  const prompt = (
    <div>
      {label}
      <h2 className="font-label text-2xl leading-tight font-medium text-cream">{promptText(q)}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      {/* On the fretboard, the listening keys sit with the question. */}
      {listenKeys && usesBoard(q) && <div className="mt-2 flex">{listenKeys}</div>}
    </div>
  )

  const staff = (q.kind === 'staffName' || q.kind === 'staffFind') && (
    <div className="paper h-full px-3 py-1">
      <Staff keys={[vexKey(q.note)]} />
    </div>
  )

  const board =
    usesBoard(q) && 'region' in q ? (
      <Fretboard
        key={q.id}
        minFret={q.region.minFret}
        maxFret={q.region.maxFret}
        activeStrings={q.kind === 'find' ? [q.string] : q.region.strings}
        markers={markersFor(q, answer, found)}
        onTap={q.kind === 'name' || q.kind === 'intervalName' ? undefined : onTap}
      />
    ) : isPick(q) && q.board ? (
      // A fretboard to look at, answered with buttons.
      <Fretboard
        key={q.id}
        minFret={q.board.region.minFret}
        maxFret={q.board.region.maxFret}
        activeStrings={q.board.region.strings}
        markers={markersFor(q, answer, found)}
      />
    ) : null

  let notation: ReactNode = null
  if (q.kind === 'symbolName' || q.kind === 'beats') {
    notation = <Notation measure={{ meter: '4/4', events: [SYMBOLS[q.symbol].event!] }} clef={false} timeSig={false} />
  } else if (q.kind === 'measureFill') {
    notation = <Notation measure={q.measure} blankBeats={q.missing} />
  } else if (q.kind === 'countBeat') {
    const starts = onsets(q.measure)
    const colors = answer ? q.measure.events.map((_, i) => (i === q.target ? '#2f8f4e' : i === answer.picked ? '#c0392b' : undefined)) : undefined
    notation = (
      <Notation
        measure={q.measure}
        onTapNote={answer ? undefined : onPick}
        colors={colors}
        labels={answer ? q.measure.events.map((_, i) => countAt(starts[i], q.measure.meter)) : undefined}
      />
    )
  }

  const score = scoreFor(q, answer, found)

  const tapRhythm = q.kind === 'tapRhythm' && (
    <TapRhythm key={q.id} measure={q.measure} bpm={q.bpm} result={answer?.rhythm ?? null} onDone={onRhythm} allowListen={allowListen} />
  )

  let controls: ReactNode = null
  if (isPick(q)) {
    const options = q.options
    controls =
      options === 'notes' ? (
        <NoteButtons choices="all" onPick={onPick} result={result} />
      ) : (
        <OptionButtons
          options={options.map((label, i) => ({ value: i, label }))}
          onPick={onPick}
          result={result}
          columns={options.every((o) => o.length <= 2) ? options.length : 2}
        />
      )
  } else if (q.kind === 'name' || q.kind === 'staffName') controls = <NoteButtons choices={q.choices} onPick={onPick} result={result} />
  else if (q.kind === 'intervalName') controls = <IntervalButtons options={q.options} onPick={onPick} result={result} />
  else if (q.kind === 'symbolName' || q.kind === 'measureFill')
    controls = <OptionButtons options={q.options.map((s, i) => ({ value: i, label: SYMBOLS[s].name }))} onPick={onPick} result={result} />
  else if (q.kind === 'beats')
    controls = (
      <OptionButtons options={q.options.map((b) => ({ value: b, label: BEAT_LABELS[b] ?? String(b) }))} onPick={onPick} result={result} columns={3} />
    )
  else if (q.kind === 'accidentalRule' || (q.kind === 'keyNote' && q.mode === 'name'))
    controls = <NoteButtons choices="all" onPick={onPick} result={result} />
  else if (q.kind === 'keyName')
    controls = <OptionButtons options={q.options.map((k, i) => ({ value: i, label: KEYS[k].name }))} onPick={onPick} result={result} />
  else if (q.kind === 'motion')
    controls = <OptionButtons options={q.options.map((m, i) => ({ value: i, label: MOTION_NAMES[m] }))} onPick={onPick} result={result} />

  const diagram = isPick(q) && q.diagram
  const chart = isPick(q) && q.chart
  const visual = notation ? (
    <div className="paper h-full max-h-60 w-full px-3 py-2">{notation}</div>
  ) : diagram ? (
    // A chord diagram, printed on paper like a page of a chord book.
    <div className="paper mx-auto h-full max-h-64 w-full max-w-[220px] px-3 py-2">
      <ChordDiagram {...diagram} {...(answer ? diagram.after : {})} />
    </div>
  ) : chart ? (
    // A chord chart, printed on paper like a page of a method book.
    <div className="paper w-full max-w-md px-2 py-2">
      <ChordChart {...chart} {...(answer ? chart.after : {})} />
    </div>
  ) : (
    listenKeys &&
    !usesBoard(q) && (
      // Nothing to look at, only something to hear.
      <div className="panel flex w-full flex-col items-center gap-4 px-4 py-6">
        <HeadphonesIcon className="h-12 w-12 text-amber" />
        {listenKeys}
      </div>
    )
  )

  if (landscape) {
    return (
      <div className="flex min-h-0 flex-1 gap-3 px-3 pt-2 pb-3">
        {board && <div className="min-h-0 flex-1">{board}</div>}
        <div className={`flex min-h-0 flex-col gap-2 ${board ? 'w-[42%] max-w-md' : 'flex-1'}`}>
          {prompt}
          {staff && <div className={board ? 'h-24 shrink-0' : 'min-h-0 flex-1'}>{staff}</div>}
          {score && (
            <div className={board ? 'h-28 shrink-0' : 'min-h-0 flex-1'}>
              <div className="paper h-full px-3 py-1">{score}</div>
            </div>
          )}
          {visual && <div className="min-h-0 flex-1">{visual}</div>}
          {tapRhythm}
          {!visual && !tapRhythm && <div className="flex-1" />}
          {feedback ?? controls}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-5 pt-3 pb-2">{prompt}</div>
      {staff && <div className={board ? 'h-28 shrink-0 px-6' : 'min-h-0 flex-1 px-6 py-4'}>{staff}</div>}
      {score && (
        <div className={board ? 'h-32 shrink-0 px-4' : 'flex min-h-0 flex-1 items-center px-5 py-3'}>
          <div className="paper h-full max-h-60 w-full px-3 py-1">{score}</div>
        </div>
      )}
      {visual && <div className="flex min-h-0 flex-1 items-center px-5 py-3">{visual}</div>}
      {board && <div className="min-h-0 flex-1 px-2 py-1">{board}</div>}
      {tapRhythm && <div className="flex min-h-0 flex-1 flex-col px-4 pb-3">{tapRhythm}</div>}
      {/* Questions with nothing to look at keep their buttons at the bottom, in reach of a thumb. */}
      {!staff && !score && !visual && !board && !tapRhythm && <div className="flex-1" />}
      <div className={`flex shrink-0 flex-col justify-end ${tapRhythm ? '' : 'min-h-[176px]'}`}>
        {feedback ?? (controls && <div className="px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">{controls}</div>)}
      </div>
    </div>
  )
}

const RIGHT = '#2f8f4e'
const WRONG = '#c0392b'

/** Sheet music for the reading questions; note names appear underneath once you've answered. */
function scoreFor(q: Question, answer: Answer | null, found: Position[]): ReactNode {
  if (isPick(q)) {
    const s = q.score
    if (!s) return null
    return (
      <Score
        measures={answer ? (s.afterMeasures ?? s.measures) : s.measures}
        keySig={s.keySig}
        colors={s.colors}
        labels={answer ? (s.after ?? s.labels) : s.labels}
        marker={answer ? null : (s.marker ?? null)}
      />
    )
  }
  switch (q.kind) {
    case 'accidentalRule': {
      const names = resolveNotes(q.measures).map((n) => spelledName(n))
      const colors = answer ? names.map((_, i) => (i === q.target ? (answer.ok ? RIGHT : WRONG) : undefined)) : undefined
      return <Score measures={q.measures} meter="4/4" marker={answer ? null : q.target} labels={answer ? names : undefined} colors={colors} />
    }
    case 'keyName':
      return <Score measures={[[]]} keySig={q.key} />
    case 'keyNote':
      return <Score measures={[[q.note]]} keySig={q.key} labels={answer ? [spelledName(resolveNotes([[q.note]], q.key)[0])] : undefined} />
    case 'motion':
      return <Score measures={[[q.from, q.to]]} labels={answer ? resolveNotes([[q.from, q.to]]).map((n) => spelledName(n)) : undefined} />
    case 'phrase': {
      const names = phraseNotes(q).map((n) => spelledName(n))
      const colors = names.map((_, i) => (i < found.length ? RIGHT : answer && !answer.ok && i === found.length ? WRONG : undefined))
      return (
        <Score
          measures={q.measures}
          keySig={q.key}
          meter="4/4"
          marker={answer ? null : found.length}
          colors={colors}
          labels={answer ? names : undefined}
        />
      )
    }
    default:
      return null
  }
}
