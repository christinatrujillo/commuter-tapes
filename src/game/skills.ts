import { mastery, type Stats } from './questions'

/** The skill areas the Meters tab reports on, and which practiced facts belong to each. */
const SKILLS: { label: string; test: RegExp }[] = [
  { label: 'Fretboard', test: /^\d:\d+$/ },
  { label: 'Reading', test: /^(staff|rule|motion):/ },
  { label: 'Rhythm', test: /^(sym|count|fill):/ },
  { label: 'Scales & keys', test: /^(step|scale|degree|key|rel|minor|pmin|pdeg|pmaj|prel|pblues|pbox|ppat):/ },
  { label: 'Intervals', test: /^(iv|ivnum|ivn|invnum|inv):/ },
  { label: 'Triads', test: /^(triad|tri|tq|tinv|tneck):/ },
  { label: 'Chords', test: /^(hd|hrn|hprim|hbox|hprog|chd|chq|csym|h7|diag|caged|mh|mrn|hmin|hmv|mprog|kfind|b12|b12key|b12var|bminor):/ },
  { label: 'Ear', test: /^ear:/ },
]

export interface SkillMeter {
  label: string
  /** Facts in this area you've answered fast and right, out of the ones you've practiced. */
  fluent: number
  practiced: number
}

/** How solid each skill area is: fluent facts out of the ones you've practiced so far. */
export function skillMeters(stats: Stats, day?: string): SkillMeter[] {
  const seen = Object.keys(stats).filter((f) => stats[f].seen > 0)
  return SKILLS.map(({ label, test }) => {
    const facts = seen.filter((f) => test.test(f))
    return { label, practiced: facts.length, fluent: facts.filter((f) => mastery(stats[f], day) === 'fluent').length }
  })
}
