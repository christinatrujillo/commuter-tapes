import { expect, RETURNING, test } from './fixtures'

test.use({ progress: RETURNING })

/** Tape 5, track 1: name and find the notes on the high E string, frets 0–5. */
const TRACK = 'u7-1'

test('a clean take is stamped Master take and counts toward the daily goal', async ({ page, take }) => {
  await take.open(TRACK)
  const asked = await take.playClean()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Frets 0–5')
  await expect(page.getByText('Master take')).toBeVisible()
  await expect(page.getByText('100%')).toBeVisible()

  await page.getByRole('button', { name: 'Done', exact: true }).click()
  const meter = page.getByRole('img', { name: `Today: ${asked} of 30 notes` })
  await expect(meter).toBeVisible()
  // Saved on the device, so it's still there after a reload.
  await page.reload()
  await expect(meter).toBeVisible()
})

test('three clips ruin the take, and Rewind starts it over', async ({ page, take }) => {
  await take.open(TRACK)
  for (let n = 1; n <= 3; n++) {
    await take.answer(false)
    await expect(take.chancesLeft(3 - n)).toBeVisible()
    await take.next(n)
  }
  await expect(take.ruined).toBeVisible()

  await page.getByRole('button', { name: 'Rewind and retry', exact: true }).click()
  await expect(take.counter(1)).toBeVisible()
  await expect(take.chancesLeft(3)).toBeVisible()
})

test('a take in progress picks up at the same question after a reload', async ({ page, take }) => {
  await take.open(TRACK)
  await take.answer(false)
  await take.next(1)
  await take.answer(true)
  await take.next(2)

  await page.reload()
  await expect(take.counter(3)).toBeVisible()
  await expect(take.chancesLeft(2)).toBeVisible()
})

test('stopping mid-take asks first, and Cancel keeps recording', async ({ page, take }) => {
  await take.open(TRACK)
  await take.answer(true)
  const stop = page.getByRole('button', { name: 'Stop recording', exact: true })

  let asked = ''
  page.once('dialog', (dialog) => {
    asked = dialog.message()
    void dialog.dismiss()
  })
  await stop.click()
  expect(asked).toBe('Stop recording? You’ll lose this take.')
  await expect(take.result).toBeVisible()

  page.once('dialog', (dialog) => void dialog.accept())
  await stop.click()
  await expect(page.getByRole('button', { name: 'Play next track' })).toBeVisible()
})
