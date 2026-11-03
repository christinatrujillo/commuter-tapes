import { useSyncExternalStore } from 'react'

/**
 * Tiny hash router (#/lesson/u1-1). Hash URLs work on any static host, and
 * Android's back button moves between screens for free.
 */
function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

const getHash = () => window.location.hash

export interface Route {
  parts: string[]
  query: URLSearchParams
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash)
  const [path, search = ''] = hash.replace(/^#\/?/, '').split('?')
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(search) }
}

/** How many screens deep we are inside the app, stored on each history entry. */
const currentDepth = (): number => (history.state as { depth?: number } | null)?.depth ?? 0

export function navigate(path: string, { replace = false } = {}) {
  const hash = `#${path}`
  if (replace) history.replaceState({ depth: currentDepth() }, '', hash)
  else history.pushState({ depth: currentDepth() + 1 }, '', hash)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

/** Goes back a screen, or to `fallback` when the app was opened directly on this screen. */
export function goBack(fallback = '/') {
  if (currentDepth() > 0) history.back()
  else navigate(fallback, { replace: true })
}
