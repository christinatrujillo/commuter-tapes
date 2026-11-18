import { expect, type Locator, type Page } from '@playwright/test'

/**
 * The app ignores taps for this long after a question appears, so a double tap on Next can't answer
 * the next question too. An answer any sooner would be silently dropped.
 */
const INPUT_GUARD_MS = 400

// The answers are worked out here from the guitar itself, not borrowed from the app, so the tests
// check the app instead of agreeing with it.
/** Standard tuning as MIDI notes, from the low E string (0) to the high E string (5). */
const TUNING = [40, 45, 50, 55, 59, 64]
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const NATURALS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

/** The note at a spot on the neck, written "string:fret" the way the fretboard tags its spots: "5:3" is G. */
export function noteAt(spot: string): string {
  const [string, fret] = spot.split(':').map(Number)
  return NOTE_NAMES[(TUNING[string] + fret) % 12]
}

/** A take: the recorded run of a track, about ten questions. Answers the way a player would, by reading the neck and the question. */
export class TakePage {
  readonly question: Locator
  readonly result: Locator
  readonly recorded: Locator
  readonly ruined: Locator

  constructor(readonly page: Page) {
    this.question = page.getByRole('heading', { level: 2 })
    this.result = page.getByRole('status')
    this.recorded = page.getByText('Take recorded')
    this.ruined = page.getByRole('heading', { name: 'Take ruined' })
  }

  async open(track: string) {
    await this.page.goto(`/#/lesson/${track}`)
    await expect(this.counter(1)).toBeVisible()
  }

  /** The tape counter, showing question `n`. */
  counter(n: number): Locator {
    return this.page.getByLabel(`Question ${n}`, { exact: true })
  }

  /** The CLIP lamps, with `n` mistakes to go before the take is ruined. */
  chancesLeft(n: number): Locator {
    return this.page.getByLabel(`${n} of 3 chances left`, { exact: true })
  }

  /** Answers the question on screen, right or wrong on purpose. Knows the two kinds a track on the neck asks. */
  async answer(right: boolean) {
    await expect(this.question).toBeVisible()
    await this.page.waitForTimeout(INPUT_GUARD_MS + 50)
    const asked = await this.question.textContent()
    if (asked === 'What note is this?') {
      const note = noteAt((await this.page.locator('g[data-tone="target"]').getAttribute('data-pos'))!)
      const choice = right ? note : NATURALS.find((n) => n !== note)!
      await this.page.getByRole('button', { name: choice, exact: true }).click()
    } else if (asked?.startsWith('Tap ')) {
      // "Tap G on the high E string": the note is the part in amber.
      const note = await this.question.locator('.text-amber').textContent()
      const spots = this.page.locator('rect.fret-hit')
      await expect(spots.first()).toBeAttached()
      const all = await spots.evaluateAll((els) => els.map((el) => el.getAttribute('data-pos')!))
      const spot = all.find((s) => (noteAt(s) === note) === right)
      await this.page.locator(`rect.fret-hit[data-pos="${spot}"]`).click()
    } else {
      throw new Error(`TakePage doesn't know how to answer "${asked}"`)
    }
    await expect(this.result).toHaveAttribute('data-result', right ? 'clean' : 'clipped')
  }

  /** Presses Next on question `n` and waits for what comes after it: the next question, or the end of the take. */
  async next(n: number) {
    await this.page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(this.counter(n + 1).or(this.recorded).or(this.ruined)).toBeVisible()
  }

  /** Answers every question right until the take is recorded. Returns how many questions there were. */
  async playClean(): Promise<number> {
    for (let n = 1; n <= 30; n++) {
      await this.answer(true)
      await this.next(n)
      if (await this.recorded.isVisible()) return n
    }
    throw new Error('The take never ended')
  }
}
