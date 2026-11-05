import { createHash } from 'node:crypto'
import { readdirSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Emits dist/sw.js: a small service worker that precaches every built file so
 * the app works offline once it's installed on the phone. The cache name is a
 * hash of the (content-hashed) file names, so each deploy replaces the old cache.
 */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      // Only basic Latin .woff2 fonts are needed (Chrome never asks for the older .woff copies).
      const built = Object.keys(bundle).filter(
        (f) => f !== 'index.html' && !f.endsWith('.map') && !f.endsWith('.woff') && (!f.endsWith('.woff2') || /-latin-(?!ext)/.test(f)),
      )
      const icons = readdirSync('public/icons').map((f) => `icons/${f}`)
      const files = ['./', ...[...built, 'manifest.webmanifest', ...icons].map((f) => `./${f}`)]
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12)
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `const CACHE = 'commuter-tapes-${version}'
const PRECACHE = ${JSON.stringify(files)}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  // The page itself: try the network first so updates show up, fall back to the cache offline.
  // Only a good copy replaces the cached one, so an error page (or a train Wi-Fi login page) can't.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put('./', copy))
          }
          return response
        })
        .catch(() => caches.match('./')),
    )
    return
  }

  // Everything else has a content hash in its name, so the cached copy is always right.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
`,
      })
    },
  }
}

export default defineConfig({
  // Relative paths so the build works at any URL (e.g. username.github.io/commuter-tapes/).
  base: './',
  plugins: [react(), tailwindcss(), serviceWorker()],
  // VexFlow embeds its music font, so the main bundle is ~1.2 MB (cached once, then offline).
  build: { chunkSizeWarningLimit: 1300 },
})
