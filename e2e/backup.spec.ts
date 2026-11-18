import { readFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import { expect, ONE_TRACK, test } from './fixtures'

test.use({ progress: ONE_TRACK })

test.beforeEach(async ({ page }) => {
  await page.goto('/#/settings')
})

/** Presses Export backup and returns the file's contents, after saving it to `path`. */
async function exportBackup(page: Page, path: string) {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup', exact: true }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^commuter-tapes-backup-\d{4}-\d{2}-\d{2}\.json$/)
  await file.saveAs(path)
  return JSON.parse(await readFile(path, 'utf8'))
}

/** Clicks OK on every alert and confirm from here on, keeping their messages to check. */
function acceptDialogs(page: Page): string[] {
  const messages: string[] = []
  page.on('dialog', (dialog) => {
    messages.push(dialog.message())
    void dialog.accept()
  })
  return messages
}

/** Opens Load backup's file picker and chooses `file`: a path, or a file made up on the spot. */
async function loadBackup(page: Page, file: string | { name: string; mimeType: string; buffer: Buffer }) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Load backup', exact: true }).click()
  await (await chooser).setFiles(file)
}

test('a backup brings everything back after Erase everything', async ({ page }, testInfo) => {
  const path = testInfo.outputPath('backup.json')
  const backup = await exportBackup(page, path)
  expect(backup).toMatchObject({ app: 'commuter-tapes', nailed: 10, lessons: { 'u7-1': { stars: 3, completions: 1 } } })

  const messages = acceptDialogs(page)
  await page.getByRole('button', { name: 'Erase everything', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Pick your first tape' })).toBeVisible()

  // Start over, as on a new phone, and load the file.
  await page.getByRole('button', { name: /From the beginning/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Skip', exact: true }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await loadBackup(page, path)
  await expect.poll(() => messages).toEqual(['Erase all progress and stats? This can’t be undone.', 'Progress restored.'])

  // A second backup matches the first in everything but the time it was made.
  const again = await exportBackup(page, testInfo.outputPath('again.json'))
  expect({ ...again, exported: undefined }).toEqual({ ...backup, exported: undefined })
})

test('Erase everything asks first, and Cancel keeps your progress', async ({ page }) => {
  let asked = ''
  page.once('dialog', (dialog) => {
    asked = dialog.message()
    void dialog.dismiss()
  })
  await page.getByRole('button', { name: 'Erase everything', exact: true }).click()
  expect(asked).toBe('Erase all progress and stats? This can’t be undone.')

  // Erased progress would bring back the first-run screen in place of the settings.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings', exact: true })).toBeVisible()
})

test('turns down a file that isn’t a backup', async ({ page }) => {
  const messages = acceptDialogs(page)
  await loadBackup(page, { name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"notes":["E","A","D"]}') })
  await expect.poll(() => messages).toEqual(['That file doesn’t look like a Commuter Tapes backup.'])
})
