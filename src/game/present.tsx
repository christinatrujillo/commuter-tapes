import type { ReactNode } from 'react'
import type { Marker } from '../components/Fretboard'
import {
  describePosition,
  intervalInfo,
  midiAt,
  noteAt,
  ordinal,
  pcName,
  pitchClass,
  samePos,
  spelledMidi,
  spelledName,
  staffPlace,
  stringName,
  type Position,
} from '../music/notes'
import { beatsText, countAt, countName, METER_NAME, METER_PULSE, onsets, SYMBOLS } from '../music/rhythm'
import { KEYS, MOTION_NAMES, motionBetween, resolveNotes, signName, staffDegree } from '../music/score'
import { isPick, isTap, type Ask, type PickQuestion, type Question } from './questions'
import { capitalize } from '../lib/text'
import { readingAnswerPc } from './reading'

/** How a tapped rhythm went. */
export interface TapResult {
  /** Notes tapped on time, out of notes to play. */
  hits: number
  total: number
  /** Taps that didn't match any note. */
  extra: number
  /** Per event: ms early (−) or late (+), or null if missed. Rests are always null. */
  offsets: (number | null)[]
  /** Where each tap landed, in beats from the start of the measure. */
  tapBeats: number[]
  /** Average timing of the matched taps, ms (− early, + late). */
  meanOffset: number
}

export interface Answer {
  ok: boolean
  /** How long the answer took. */
  ms: number
  /** Value chosen from buttons: a pitch class, interval size, option index, beat count or note index. */
  picked?: number
  tapped?: Position
  rhythm?: TapResult
}

const BOARD_KINDS: Question['kind'][] = ['name', 'find', 'findAll', 'staffFind', 'interval', 'intervalName', 'phrase']

/** Whether a question is answered by tapping the fretboard. */
export const usesBoard = (q: Question) => BOARD_KINDS.includes(q.kind) || isTap(q) || (q.kind === 'keyNote' && q.mode === 'find')

/** The notes of a melody question as they're actually played (key signature and accidentals applied). */
export function phraseNotes(q: Extract<Question, { kind: 'phrase' }>) {
  return resolveNotes(q.measures, q.key)
}

const article = (semitones: number) => (semitones === 12 ? 'an' : 'a')
const fretWord = (p: Position) => (p.fret === 0 ? 'open' : `${ordinal(p.fret)} fret`)
const Hl = ({ children }: { children: ReactNode }) => <span className="text-amber">{children}</span>
const aOrAn = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a')
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** A theory question's words, with its key part in amber. */
function askText({ text, hl }: Ask): ReactNode {
  if (!hl || !text.includes(hl)) return text
  const at = text.indexOf(hl)
  return (
    <>
      {text.slice(0, at)}
      <Hl>{hl}</Hl>
      {text.slice(at + hl.length)}
    </>
  )
}

/** What a theory button says: its label, or the note name for the keyboard. */
const pickLabel = (q: PickQuestion, value: number) => (q.options === 'notes' ? pcName(value) : q.options[value])

/** The value that answers a button question (used to light up the right button afterwards). */
export function correctPick(q: Question): number {
  if (isPick(q)) return q.answer
  switch (q.kind) {
    case 'name':
      return pitchClass(midiAt(q.target))
    case 'staffName':
      return pitchClass(spelledMidi(q.note))
    case 'intervalName':
      return q.semitones
    case 'symbolName':
      return q.options.indexOf(q.symbol)
    case 'beats':
      return SYMBOLS[q.symbol].beats
    case 'measureFill':
      return q.options.findIndex((s) => SYMBOLS[s].beats === q.missing)
    case 'countBeat':
      return q.target
    case 'accidentalRule':
      return readingAnswerPc(q)!
    case 'keyNote':
      return readingAnswerPc(q)!
    case 'keyName':
      return q.options.indexOf(q.key)
    case 'motion':
      return q.options.indexOf(motionBetween(q.from, q.to))
    default:
      return -1
  }
}

export function pickIsCorrect(q: Question, value: number): boolean {
  if (q.kind === 'measureFill') return SYMBOLS[q.options[value]]?.beats === q.missing
  return value === correctPick(q)
}

export function promptText(q: Question): ReactNode {
  if (isPick(q) || isTap(q)) return askText(q.ask)
  switch (q.kind) {
    case 'name':
    case 'staffName':
      return 'What note is this?'
    case 'find':
      return (
        <>
          Tap <Hl>{q.label}</Hl> on the {stringName(q.string)} string
        </>
      )
    case 'findAll':
      return (
        <>
          Find every <Hl>{q.label}</Hl>
          {q.region.strings.length === 1 && ` on the ${stringName(q.region.strings[0])} string`}
        </>
      )
    case 'staffFind':
      return 'Where do you play this note?'
    case 'interval': {
      const info = intervalInfo(q.semitones)
      return (
        <>
          Tap {article(q.semitones)} <Hl>{info.name}</Hl> above this {noteAt(q.root)}
        </>
      )
    }
    case 'intervalName':
      return 'What interval is this?'
    case 'symbolName':
      return 'What is this called?'
    case 'beats':
      return 'How many beats does this get?'
    case 'measureFill':
      return 'What completes the measure?'
    case 'countBeat':
      return (
        <>
          Tap the note on <Hl>{countName(q.beat, q.measure.meter)}</Hl>
        </>
      )
    case 'tapRhythm':
      return 'Tap this rhythm'
    case 'accidentalRule':
      return 'What is the marked note?'
    case 'keyName':
      return 'What key is this?'
    case 'keyNote':
      return q.mode === 'name' ? 'In this key, what note is this?' : 'In this key, where do you play this note?'
    case 'motion':
      return 'How does the melody move?'
    case 'phrase':
      return 'Play this phrase, one note at a time'
  }
}

export function hintText(q: Question, found: Position[]): string | null {
  if (q.kind === 'findAll') return `${found.length} of ${q.targets.length} found`
  if ((q.kind === 'staffFind' || q.kind === 'interval' || isTap(q)) && 'targets' in q && q.targets.length > 1) return 'More than one spot works. Pick any.'
  if (q.kind === 'countBeat') return 'Count from the start of the measure.'
  if (q.kind === 'measureFill') return `It’s in ${METER_NAME[q.measure.meter]}.`
  if (q.kind === 'phrase') return `Note ${Math.min(found.length + 1, q.targets.length)} of ${q.targets.length}`
  if (q.kind === 'motion') return 'From the first note to the second.'
  return null
}

export function answerSound(q: Question, tapped?: Position): number[] {
  if (isPick(q)) return q.sound
  if (isTap(q)) return tapped ? [midiAt(q.from), midiAt(tapped)] : []
  switch (q.kind) {
    case 'name':
      return [midiAt(q.target)]
    case 'staffName':
      return [spelledMidi(q.note) - 12]
    case 'find':
    case 'findAll':
    case 'staffFind':
      return tapped ? [midiAt(tapped)] : []
    case 'interval':
      return tapped ? [midiAt(q.root), midiAt(tapped)] : []
    case 'intervalName':
      return [midiAt(q.root), midiAt(q.other)]
    case 'accidentalRule':
    case 'keyNote':
      return q.kind === 'keyNote' && q.mode === 'find' ? (tapped ? [midiAt(tapped)] : []) : [writtenToSounding(resolvedTarget(q))]
    case 'motion':
      return [q.from, q.to].map((n) => writtenToSounding(spelledMidi(resolveNotes([[n]])[0])))
    case 'phrase':
      return phraseNotes(q).map((n) => writtenToSounding(spelledMidi(n)))
    default:
      return []
  }
}

const writtenToSounding = (written: number) => written - 12

/** Written pitch of the note an accidental or key question asks about. */
function resolvedTarget(q: Extract<Question, { kind: 'accidentalRule' | 'keyNote' }>): number {
  return q.kind === 'accidentalRule' ? spelledMidi(resolveNotes(q.measures)[q.target]) : spelledMidi(resolveNotes([[q.note]], q.key)[0])
}

export function markersFor(q: Question, answer: Answer | null, found: Position[]): Marker[] {
  if (isPick(q)) return q.board ? (answer ? (q.board.after ?? q.board.markers) : q.board.markers) : []
  if (isTap(q)) {
    if (!answer) return q.markers
    // The pattern stays up; the answer is lit on top of it.
    const shown = [...q.targets, ...(answer.tapped ? [answer.tapped] : [])]
    const out = q.markers.filter((m) => !shown.some((p) => samePos(p, m.pos)))
    for (const t of q.targets) {
      const isTapped = answer.tapped && samePos(t, answer.tapped)
      out.push({ pos: t, tone: answer.ok && !isTapped ? 'alt' : 'correct', label: q.label })
    }
    if (!answer.ok && answer.tapped) out.push({ pos: answer.tapped, tone: 'wrong', label: noteAt(answer.tapped) })
    return out
  }
  switch (q.kind) {
    case 'name':
      return [{ pos: q.target, tone: answer ? 'correct' : 'target', label: answer ? noteAt(q.target) : undefined }]
    case 'intervalName':
      return [
        { pos: q.root, tone: 'root', label: noteAt(q.root) },
        { pos: q.other, tone: answer ? 'correct' : 'target', label: answer ? noteAt(q.other) : '?' },
      ]
    case 'findAll': {
      const out: Marker[] = found.map((p) => ({ pos: p, tone: 'correct', label: q.label }))
      if (answer && !answer.ok) {
        for (const t of q.targets) if (!found.some((f) => samePos(f, t))) out.push({ pos: t, tone: 'alt', label: q.label })
        if (answer.tapped) out.push({ pos: answer.tapped, tone: 'wrong', label: noteAt(answer.tapped) })
      }
      return out
    }
    case 'phrase': {
      const names = phraseNotes(q).map((n) => spelledName(n))
      const out: Marker[] = found.map((p, i) => ({ pos: p, tone: 'correct', label: names[i] }))
      if (answer && !answer.ok) {
        const next = found.length
        for (const t of q.targets[next] ?? []) out.push({ pos: t, tone: 'alt', label: names[next] })
        if (answer.tapped) out.push({ pos: answer.tapped, tone: 'wrong', label: noteAt(answer.tapped) })
      }
      return out
    }
    case 'find':
    case 'staffFind':
    case 'keyNote':
    case 'interval': {
      const out: Marker[] = q.kind === 'interval' ? [{ pos: q.root, tone: 'root', label: noteAt(q.root) }] : []
      if (!answer) return out
      const keyName = q.kind === 'keyNote' ? spelledName(resolveNotes([[q.note]], q.key)[0]) : ''
      const label = (p: Position) =>
        q.kind === 'find' ? q.label : q.kind === 'staffFind' ? spelledName(q.note) : q.kind === 'keyNote' ? keyName : noteAt(p)
      for (const t of q.targets) {
        const isTapped = answer.tapped && samePos(t, answer.tapped)
        out.push({ pos: t, tone: answer.ok && !isTapped ? 'alt' : 'correct', label: label(t) })
      }
      if (!answer.ok && answer.tapped) out.push({ pos: answer.tapped, tone: 'wrong', label: noteAt(answer.tapped) })
      return out
    }
    default:
      return []
  }
}

export function feedbackDetail(q: Question, a: Answer): string {
  const tapped = a.tapped
  if (isPick(q)) return a.ok ? q.why : `It’s ${pickLabel(q, q.answer)}, not ${a.picked !== undefined ? pickLabel(q, a.picked) : '?'}. ${q.why}`
  if (isTap(q)) return a.ok ? q.why : `That’s ${tapped ? noteAt(tapped) : '?'}. ${q.why}`
  switch (q.kind) {
    case 'name': {
      const name = pcName(pitchClass(midiAt(q.target)))
      return a.ok ? `${name} · ${describePosition(q.target)}` : `It’s ${name}, not ${pcName(a.picked ?? 0)}.`
    }
    case 'find':
      return a.ok && tapped
        ? `${q.label} · ${describePosition(tapped)}`
        : `That’s ${tapped ? noteAt(tapped) : '?'}. ${q.label} is ${q.targets.map(fretWord).join(' and ')}.`
    case 'findAll':
      return a.ok
        ? `All ${q.targets.length} found.`
        : `That’s ${tapped ? noteAt(tapped) : '?'}, not ${q.label}. The ones you missed are lit up.`
    case 'staffName': {
      const name = spelledName(q.note)
      return a.ok ? `${name}, ${staffPlace(q.note)}` : `It’s ${name} (${staffPlace(q.note)}), not ${pcName(a.picked ?? 0)}.`
    }
    case 'staffFind': {
      const name = spelledName(q.note)
      if (a.ok && tapped) {
        const others = q.targets.filter((t) => !samePos(t, tapped))
        return `${name} · ${describePosition(tapped)}${others.length ? `. Also: ${others.map(describePosition).join('; ')}` : ''}`
      }
      return `That spot is ${tapped ? noteAt(tapped) : '?'}. This ${name} is on the ${q.targets.map(describePosition).join(' or ')}.`
    }
    case 'interval': {
      const info = intervalInfo(q.semitones)
      const target = noteAt(q.targets[0])
      return a.ok
        ? `${noteAt(q.root)} → ${target} is ${article(q.semitones)} ${info.name}.`
        : `That’s ${tapped ? noteAt(tapped) : '?'}. ${article(q.semitones) === 'an' ? 'An' : 'A'} ${info.name} above ${noteAt(q.root)} is ${target}.`
    }
    case 'intervalName': {
      const info = intervalInfo(q.semitones)
      return a.ok
        ? `${noteAt(q.root)} → ${noteAt(q.other)} is ${article(q.semitones)} ${info.name}.`
        : `It’s ${article(q.semitones)} ${info.name}, not ${article(a.picked ?? 0)} ${intervalInfo(a.picked ?? 12).name}.`
    }
    case 'symbolName': {
      const info = SYMBOLS[q.symbol]
      const picked = a.picked !== undefined ? SYMBOLS[q.options[a.picked]] : null
      return a.ok
        ? `${info.name}: ${beatsText(info.beats)}.`
        : `That’s ${aOrAn(info.name)} ${lower(info.name)} (${beatsText(info.beats)})${picked ? `, not ${aOrAn(picked.name)} ${lower(picked.name)}` : ''}.`
    }
    case 'beats': {
      const info = SYMBOLS[q.symbol]
      return a.ok
        ? `${info.name}: ${beatsText(info.beats)}.`
        : `${aOrAn(info.name) === 'an' ? 'An' : 'A'} ${lower(info.name)} gets ${beatsText(info.beats)}, not ${beatsText(a.picked ?? 0)}.`
    }
    case 'measureFill': {
      // Beats as counted in this time signature (in cut time a quarter note is half a beat).
      const perBeat = METER_PULSE[q.measure.meter].quarters
      const one = q.missing / perBeat <= 1
      const missing = capitalize(beatsText(q.missing / perBeat))
      const picked = a.picked !== undefined ? SYMBOLS[q.options[a.picked]] : null
      if (a.ok && picked) return `${missing} ${one ? 'was' : 'were'} missing, and ${aOrAn(picked.name)} ${lower(picked.name)} fills ${one ? 'it' : 'them'}.`
      return `${missing} ${one ? 'is' : 'are'} missing${picked ? `, but ${aOrAn(picked.name)} ${lower(picked.name)} is ${beatsText(picked.beats / perBeat)}` : ''}.`
    }
    case 'countBeat': {
      const meter = q.measure.meter
      const starts = onsets(q.measure)
      const counts = q.measure.events.map((_, i) => countAt(starts[i], meter)).join(' ')
      return a.ok
        ? `That note starts on ${countName(q.beat, meter)}.`
        : `That one starts on ${countName(starts[a.picked ?? 0], meter)}. Count along: ${counts}.`
    }
    case 'accidentalRule': {
      const notes = resolveNotes(q.measures)
      const flat = q.measures.flat()
      const target = notes[q.target]
      const name = spelledName(target)
      // The accidental that sets up the question: the first signed note on the marked letter.
      const first = flat.find((n) => n.letter === target.letter && n.sign !== undefined && n.sign !== 0)
      const sign = signName(first?.sign ?? 1)
      const why = {
        carry: `the ${sign} earlier in the measure still applies`,
        natural: `the natural sign cancels the ${sign}`,
        barline: `the bar line cancels the ${sign} from the last measure`,
        octave: `the ${sign} only affects its own line or space, and this ${target.letter} is an octave ${
          first && staffDegree(first) > staffDegree(target) ? 'lower' : 'higher'
        }`,
      }[q.rule]
      return a.ok ? `${name}: ${why}.` : `It’s ${name}, not ${pcName(a.picked ?? 0)}. ${capitalize(why)}.`
    }
    case 'keyName': {
      const k = KEYS[q.key]
      const picked = a.picked !== undefined ? KEYS[q.options[a.picked]] : null
      return a.ok ? `${k.name}: ${k.signature}.` : `It’s ${k.name} (${k.signature})${picked ? `, not ${picked.name}` : ''}.`
    }
    case 'keyNote': {
      const k = KEYS[q.key]
      const name = spelledName(resolveNotes([[q.note]], q.key)[0])
      const why = k.altered[q.note.letter] ? `in ${k.name}, every ${q.note.letter} is ${name}` : `${k.name} doesn’t change ${q.note.letter}`
      if (q.mode === 'name') return a.ok ? `${name}: ${why}.` : `It’s ${name}, not ${pcName(a.picked ?? 0)}: ${why}.`
      return a.ok && tapped
        ? `${name} · ${describePosition(tapped)}. ${capitalize(why)}.`
        : `That’s ${tapped ? noteAt(tapped) : '?'}. ${capitalize(why)}, so it’s on the ${q.targets.map(describePosition).join(' or ')}.`
    }
    case 'motion': {
      const m = motionBetween(q.from, q.to)
      const from = spelledName(resolveNotes([[q.from]])[0])
      const to = spelledName(resolveNotes([[q.to]])[0])
      const how = m === 'same' ? 'it stays on the same line or space' : m.startsWith('step') ? 'it moves to the very next line or space' : m.startsWith('skip') ? 'it jumps over one line or space' : 'it jumps over more than one'
      const picked = a.picked !== undefined ? MOTION_NAMES[q.options[a.picked]] : ''
      return a.ok ? `${MOTION_NAMES[m]}: ${from} to ${to}.` : `It’s ${lower(MOTION_NAMES[m])}, not ${lower(picked)}: ${from} to ${to}, ${how}.`
    }
    case 'phrase': {
      const notes = phraseNotes(q).map((n) => spelledName(n))
      if (a.ok) return `All ${notes.length} notes: ${notes.join(' ')}.`
      // `picked` holds which note you were on when the wrong spot was tapped.
      const at = Math.min(a.picked ?? 0, q.targets.length - 1)
      return `Note ${at + 1} is ${notes[at]}: ${q.targets[at].map(describePosition).join(' or ')}.`
    }
    case 'tapRhythm': {
      const r = a.rhythm
      if (!r) return ''
      const timing = Math.abs(r.meanOffset) < 50 ? 'right on time' : r.meanOffset < 0 ? 'a little early' : 'a little late'
      if (a.ok) return `${r.hits} of ${r.total} notes on time, ${timing}.`
      const extra = r.extra ? `, plus ${r.extra} extra tap${r.extra === 1 ? '' : 's'}` : ''
      return `${r.hits} of ${r.total} notes on time${extra}. Red notes were missed. Remember: one tap per note, none on rests.`
    }
  }
}

