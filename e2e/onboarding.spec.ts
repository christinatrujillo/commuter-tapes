import { expect, test } from './fixtures'

/** The tour's six stops, in order: the four tabs, then the deck's two keys. */
const TOUR = [
  'Tapes are your lessons.',
  'Jam is extra practice.',
  'Fretboard is a reference neck.',
  'Meters show your progress.',
  'Play next track starts your next lesson straight away.',
  'Load tape opens the tape first',
]

test('a new visitor picks a start, takes the tour, and plays the first track', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Pick your first tape' })).toBeVisible()
  await page.getByRole('button', { name: /From the beginning/ }).click()

  const guide = page.getByRole('dialog', { name: /^Guide:/ })
  for (const [i, words] of TOUR.entries()) {
    await expect(guide).toContainText(words)
    await expect(guide.getByLabel(`Step ${i + 1} of ${TOUR.length}`)).toBeVisible()
    await guide.getByRole('button', { name: i + 1 < TOUR.length ? 'Next' : 'Got it', exact: true }).click()
  }
  await expect(guide).toBeHidden()

  // The tour never opens anything itself: the deck's main key starts the first track, with its rehearsal.
  await page.getByRole('button', { name: 'Play next track' }).click()
  await expect(page).toHaveURL(/#\/rehearse\/r1-1$/)
  await expect(guide).toContainText('A few cards teach')
})

test('Straight to theory starts at Vol. 3, and a skipped tour stays skipped', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Straight to theory/ }).click()
  const guide = page.getByRole('dialog', { name: /^Guide:/ })
  await guide.getByRole('button', { name: 'Skip', exact: true }).click()
  await expect(guide).toBeHidden()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Play next track' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pick your first tape' })).toBeHidden()
  await expect(guide).toBeHidden()

  await page.getByRole('button', { name: 'Play next track' }).click()
  await expect(page).toHaveURL(/#\/rehearse\/t1-1$/)
})
