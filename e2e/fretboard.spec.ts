import { expect, RETURNING, test } from './fixtures'

test.use({ progress: RETURNING })

test.beforeEach(async ({ page }) => {
  await page.goto('/#/explore')
})

test('tapping a note names its spot and writes it on the staff', async ({ page }) => {
  await page.locator('rect.fret-hit[data-pos="0:1"]').click()
  await expect(page.getByText('low E string, 1st fret')).toBeVisible()
  // F, written an octave higher than it sounds, as guitar music is. The sheet-music library loads with the first staff.
  await expect(page.getByLabel('Staff showing f/3', { exact: true })).toBeVisible()
  await expect(page.locator('.staff svg')).toBeVisible()
})

test('Sharps and Flats fill in the notes between the naturals', async ({ page }) => {
  // Low E string, 2nd fret.
  const spot = page.locator('g[data-pos="0:2"]')
  await expect(spot).toHaveCount(0)
  await page.getByRole('button', { name: 'Sharps', exact: true }).click()
  await expect(spot).toHaveText('F♯')
  await page.getByRole('button', { name: 'Flats', exact: true }).click()
  await expect(spot).toHaveText('G♭')
})
