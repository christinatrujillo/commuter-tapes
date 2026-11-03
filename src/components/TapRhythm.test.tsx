// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Measure } from '../music/rhythm'
import { TapRhythm } from './TapRhythm'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

it('counts down every beat of the count-in, then asks for taps', () => {
  const measure: Measure = { meter: '4/4', events: [{ dur: 'w', dots: 0, rest: false }] }
  render(<TapRhythm measure={measure} bpm={60} result={null} onDone={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Count me in' }))
  const seen: string[] = []
  for (let t = 0; t < 4500; t += 50) {
    act(() => vi.advanceTimersByTime(50))
    const now = screen.queryByTestId('countdown')?.textContent ?? screen.getByRole('button', { name: 'Tap' }).textContent!.replace(/[^A-Za-z!]/g, '')
    if (seen.at(-1) !== now) seen.push(now)
  }
  expect(seen).toEqual(['Getready', '4', '3', '2', '1', 'Tap!'])
})
