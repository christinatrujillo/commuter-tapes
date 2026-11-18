import { expect, test } from './fixtures'

test('opens offline once it has loaded, sheet music included', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright only drives service workers in Chromium')

  await page.goto('/')
  const firstRun = page.getByRole('heading', { name: 'Pick your first tape' })
  await expect(firstRun).toBeVisible()
  // The service worker saves every built file when it installs, then takes over the page.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

  await context.setOffline(true)
  await page.reload()
  await expect(firstRun).toBeVisible()

  // The sheet-music library only loads when a staff is first drawn, so it has to come from the cache too.
  await page.getByRole('button', { name: /From the beginning/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Skip', exact: true }).click()
  await page.getByRole('navigation').getByRole('button', { name: 'Fretboard', exact: true }).click()
  await page.locator('rect.fret-hit[data-pos="0:1"]').click()
  await expect(page.locator('.staff svg')).toBeVisible()

  // And every file the app has used is in the service worker's cache.
  const uncached = await page.evaluate(async () => {
    const used = [location.origin + location.pathname, ...performance.getEntriesByType('resource').map((entry) => entry.name)]
    const missing: string[] = []
    for (const url of new Set(used)) if (new URL(url).origin === location.origin && !(await caches.match(url))) missing.push(url)
    return missing
  })
  expect(uncached).toEqual([])
})
