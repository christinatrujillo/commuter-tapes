import { test as base } from '@playwright/test'
import { TakePage } from './take-page'

export { expect } from '@playwright/test'

/** Saved progress, in the shape the app stores it. Anything left out gets the app's defaults. */
export type Progress = Record<string, unknown>

/** Someone past the first run: start picked, tour and tips seen. Sound and vibration off. */
export const RETURNING: Progress = {
  startChosen: true,
  guideDone: true,
  tipsSeen: { play: true, rehearsal: true, take: true },
  settings: { sound: false, haptics: false },
}

/** A returning player with one track recorded: a Master take of tape 5, track 1. */
export const ONE_TRACK: Progress = {
  ...RETURNING,
  nailed: 10,
  rehearsed: { 'u7-1': true },
  lessons: { 'u7-1': { stars: 3, completions: 1 } },
}

/** Where and how the app saves progress (`persist` in src/store/progress.ts). */
const SAVE_KEY = 'fretboard-trainer'
const SAVE_VERSION = 3

export const test = base.extend<{ progress: Progress | null; take: TakePage }>({
  // Every test starts as a brand-new visitor, unless it sets saved progress with test.use({ progress }).
  progress: [null, { option: true }],
  storageState: async ({ progress, baseURL }, use) => {
    const saved = progress && { name: SAVE_KEY, value: JSON.stringify({ state: progress, version: SAVE_VERSION }) }
    await use(saved ? { cookies: [], origins: [{ origin: new URL(baseURL!).origin, localStorage: [saved] }] } : undefined)
  },
  take: async ({ page }, use) => {
    await use(new TakePage(page))
  },
})
