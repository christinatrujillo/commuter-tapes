import type { ExerciseType, LessonSpec } from '../music/curriculum'

export interface DrillOptions {
  strings: number[]
  frets: [number, number]
  exercises: ExerciseType[]
  accidentals: boolean
  count: number
}

const EXERCISES: ExerciseType[] = ['name', 'find', 'findAll', 'staffName', 'staffFind']

export const DEFAULT_DRILL: DrillOptions = {
  strings: [0, 1, 2, 3, 4, 5],
  frets: [0, 12],
  exercises: ['name', 'find'],
  accidentals: false,
  count: 10,
}

export function drillToQuery(d: DrillOptions): string {
  const params = new URLSearchParams({
    s: d.strings.join(','),
    f: d.frets.join('-'),
    t: d.exercises.join(','),
    a: d.accidentals ? '1' : '0',
    n: String(d.count),
  })
  return params.toString()
}

export function drillFromQuery(q: URLSearchParams): LessonSpec {
  const strings = (q.get('s') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 5)
  const [min, max] = (q.get('f') ?? '').split('-').map(Number)
  const exercises = (q.get('t') ?? '').split(',').filter((t): t is ExerciseType => EXERCISES.includes(t as ExerciseType))
  const count = Number(q.get('n'))
  return {
    id: 'drill',
    title: 'Custom drill',
    region: {
      strings: strings.length ? [...new Set(strings)].sort((a, b) => a - b) : DEFAULT_DRILL.strings,
      minFret: Number.isInteger(min) && min >= 0 && min <= 12 ? min : 0,
      maxFret: Number.isInteger(max) && max >= 0 && max <= 12 && max >= min ? max : 12,
    },
    exercises: exercises.length ? exercises : DEFAULT_DRILL.exercises,
    accidentals: q.get('a') === '1',
    count: count >= 5 && count <= 50 ? count : 10,
  }
}
