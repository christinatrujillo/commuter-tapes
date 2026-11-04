import type { Spelling } from '../music/notes'

/** A source of random numbers in [0, 1). Tests pass a seeded one so failures can be replayed. */
export type Rng = () => number

export const pick = <T,>(items: T[], rng: Rng): T => items[Math.floor(rng() * items.length)]

/** A whole number from `lo` to `hi`, inclusive. */
export const between = (lo: number, hi: number, rng: Rng) => lo + Math.floor(rng() * (hi - lo + 1))

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Sharp or flat names for black keys, half the time each. */
export const randomSpelling = (rng: Rng): Spelling => (rng() < 0.5 ? 'sharp' : 'flat')
