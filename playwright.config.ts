import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const CI = !!process.env.CI

/**
 * End-to-end tests of the production build (service worker included), in desktop Chrome and on two
 * emulated phones: an iPhone (WebKit, the engine behind Safari) and an Android phone (Chromium).
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  // The HTML report is saved but never opened by itself: `npx playwright show-report` opens it.
  reporter: [[CI ? 'github' : 'list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The app switches its animations off for reduced motion, so nothing is mid-slide when a test taps it.
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
    { name: 'android', use: { ...devices['Pixel 5'] } },
  ],
  // Builds the app and serves it the way a static host would.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
})
