// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useProgress } from '../store/progress'
import { SettingsScreen } from './Settings'

/** A touch screen (a phone) or not (a computer). */
function touchScreen(coarse: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: coarse && query.includes('coarse'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

const vibrationSwitch = () => screen.getByRole('checkbox', { name: /^Vibration/ })

beforeEach(() => useProgress.getState().reset())
afterEach(() => {
  cleanup()
  Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true })
})

describe('the Vibration switch', () => {
  it('says so on a device that can’t vibrate', () => {
    touchScreen(false)
    render(<SettingsScreen />)
    expect(screen.getByText('This device can’t vibrate')).toBeTruthy()
  })

  it('buzzes when it’s turned on, and says what the browser did with it', () => {
    touchScreen(true)
    const vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    render(<SettingsScreen />)
    expect(screen.getByText(/Turn it off and on to test it/)).toBeTruthy()

    fireEvent.click(vibrationSwitch()) // off: no buzz
    expect(vibrate).not.toHaveBeenCalled()
    fireEvent.click(vibrationSwitch()) // on: one firm buzz
    expect(vibrate).toHaveBeenCalledWith(200)
    expect(screen.getByText(/It should have buzzed/)).toBeTruthy()

    vibrate.mockReturnValue(false)
    fireEvent.click(vibrationSwitch())
    fireEvent.click(vibrationSwitch())
    expect(screen.getByText('Your browser blocked vibration')).toBeTruthy()
  })
})
