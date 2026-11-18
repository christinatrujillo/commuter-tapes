import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { expect, RETURNING, test } from './fixtures'

/**
 * How bad a problem has to be to fail the test. Everything axe finds is attached to the report
 * either way; add 'serious' here to hold the app to a higher bar.
 */
const BLOCKING = ['critical']

/** Scans the page against WCAG 2.1 A and AA with axe. */
async function audit(page: Page, testInfo: TestInfo) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  await testInfo.attach('axe-violations.json', { body: JSON.stringify(violations, null, 2), contentType: 'application/json' })
  const blocking = violations.filter((v) => BLOCKING.includes(v.impact ?? ''))
  expect(blocking.map((v) => `${v.id}: ${v.help} (${v.nodes.length} on the page)`)).toEqual([])
}

test('the first-run screen', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Pick your first tape' })).toBeVisible()
  await audit(page, testInfo)
})

test.describe('for a returning player', () => {
  test.use({ progress: RETURNING })

  const SCREENS: { name: string; path: string; ready: (page: Page) => Locator }[] = [
    { name: 'Tapes', path: '/', ready: (page) => page.getByRole('button', { name: 'Play next track' }) },
    { name: 'Jam', path: '/#/practice', ready: (page) => page.getByRole('heading', { level: 1, name: 'Jam room' }) },
    { name: 'Fretboard', path: '/#/explore', ready: (page) => page.getByRole('img', { name: 'Guitar fretboard' }) },
    { name: 'Meters', path: '/#/stats', ready: (page) => page.getByRole('heading', { level: 1, name: 'Meters' }) },
    { name: 'Settings', path: '/#/settings', ready: (page) => page.getByRole('heading', { level: 1, name: 'Settings' }) },
    { name: 'a take', path: '/#/lesson/u7-1', ready: (page) => page.getByRole('heading', { level: 2 }) },
  ]

  for (const screen of SCREENS) {
    test(screen.name, async ({ page }, testInfo) => {
      await page.goto(screen.path)
      await expect(screen.ready(page)).toBeVisible()
      await audit(page, testInfo)
    })
  }
})
