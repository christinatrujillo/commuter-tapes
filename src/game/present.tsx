import type { ReactNode } from 'react'
import type { Marker } from '../components/Fretboard'
import {
  describePosition,
  intervalInfo,
  midiAt,
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
import { beatsText, countAt, countName, onsets, SYMBOLS } from '../music/rhythm'
import type { Question } from './questions'

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

export const BOARD_KINDS: Question['kind'][] = ['name', 'find', 'findAll', 'staffFind', 'interval', 'intervalName']
export const RHYTHM_KINDS: Question['kind'][] = ['symbolName', 'beats', 'measureFill', 'countBeat', 'tapRhythm']

const noteAt = (p: Position) => pcName(pitchClass(midiAt(p)), 'sharp')
const article = (semitones: number) => (semitones === 12 ? 'an' : 'a')
const fretWord = (p: Position) => (p.fret === 0 ? 'open' : `${ordinal(p.fret)} fret`)
const Hl = ({ children }: { children: ReactNode }) => <span className="text-amber">{children}</span>
const aOrAn = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a')
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** The value that answers a button question (used to light up the right button afterwards). */
export function correctPick(q: Question): number {
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
    default:
      return -1
  }
}

export function pickIsCorrect(q: Question, value: number): boolean {
  if (q.kind === 'measureFill') return SYMBOLS[q.options[value]]?.beats === q.missing
  return value === correctPick(q)
}

export function promptText(q: Question): ReactNode {
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
          Tap the note on <Hl>{countName(q.beat)}</Hl>
        </>
      )
    case 'tapRhythm':
      return 'Tap this rhythm'
  }
}

export function hintText(q: Question, found: Position[]): string | null {
  if (q.kind === 'findAll') return `${found.length} of ${q.targets.length} found`
  if ((q.kind === 'staffFind' || q.kind === 'interval') && q.targets.length > 1) return 'More than one spot works. Pick any.'
  if (q.kind === 'countBeat') return 'Count from the start of the measure.'
  if (q.kind === 'measureFill') return `It’s in ${q.measure.meter}.`
  return null
}

export function answerSound(q: Question, tapped?: Position): number[] {
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
    default:
      return []
  }
}

export function markersFor(q: Question, answer: Answer | null, found: Position[]): Marker[] {
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
    case 'find':
    case 'staffFind':
    case 'interval': {
      const out: Marker[] = q.kind === 'interval' ? [{ pos: q.root, tone: 'root', label: noteAt(q.root) }] : []
      if (!answer) return out
      const label = (p: Position) => (q.kind === 'find' ? q.label : q.kind === 'staffFind' ? spelledName(q.note) : noteAt(p))
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
      const picked = a.picked !== undefined ? SYMBOLS[q.options[a.picked]] : null
      return a.ok
        ? `${beatsText(q.missing)} were missing, and ${aOrAn(picked?.name ?? '')} ${lower(picked?.name ?? '')} fills them.`
        : `${capitalizeFirst(beatsText(q.missing))} ${q.missing === 1 ? 'is' : 'are'} missing${picked ? `, but ${aOrAn(picked.name)} ${lower(picked.name)} is ${beatsText(picked.beats)}` : ''}.`
    }
    case 'countBeat': {
      const starts = onsets(q.measure)
      const counts = q.measure.events.map((_, i) => countAt(starts[i])).join(' ')
      return a.ok
        ? `That note starts on ${countName(q.beat)}.`
        : `That one starts on ${countName(starts[a.picked ?? 0])}. Count along: ${counts}.`
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

const capitalizeFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
