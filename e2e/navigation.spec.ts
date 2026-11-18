import { expect, RETURNING, test } from './fixtures'

test.use({ progress: RETURNING })

test('the deck keys switch tabs, and Back from any tab returns to Tapes', async ({ page }) => {
  await page.goto('/')
  const key = (name: string) => page.getByRole('navigation').getByRole('button', { name, exact: true })
  await expect(key('Tapes')).toHaveAttribute('aria-current', 'page')

  for (const [name, heading] of [
    ['Jam', 'Jam room'],
    ['Fretboard', 'Fretboard'],
    ['Meters', 'Meters'],
  ]) {
    await key(name).click()
    await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible()
    await expect(key(name)).toHaveAttribute('aria-current', 'page')
  }

  // The tabs replace one another in the history, so one Back lands on Tapes, as Android's back button does.
  await page.goBack()
  await expect(key('Tapes')).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', { name: 'Play next track' })).toBeVisible()
})

test('Setup opens the settings, and Back returns to the deck', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Play next track' })).toBeVisible()
})

test('a link to a track that doesn’t exist says so, and Back leads home', async ({ page }) => {
  await page.goto('/#/lesson/no-such-track')
  await expect(page.getByText('That track doesn’t exist.')).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Play next track' })).toBeVisible()
})
