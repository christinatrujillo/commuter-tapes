import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('.', import.meta.url))

/** The app's own source files, tests aside. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

// Symbols like ▶, ⏏ and ↔ also come as color emoji. iPhones draw them as emoji unless the
// text-style selector (written \uFE0E) follows, while Android draws plain text either way, so a
// missing selector only shows up on an iPhone. Buttons use drawn icons (TransportIcon) instead.
describe('symbols', () => {
  it('never turn into emoji on iPhones', () => {
    const bare = sourceFiles(SRC).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) => [...line.matchAll(/\p{Extended_Pictographic}(?!\uFE0E|\\uFE0E)/gu)].map((m) => `${relative(SRC, file)}:${i + 1} ${m[0]}`)),
    )
    expect(bare).toEqual([])
  })
})
