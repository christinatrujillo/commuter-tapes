import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ALL_LESSONS } from '../music/curriculum'
import type { FactStat, Stats } from '../game/questions'
import { addDays, today } from '../lib/date'

export interface Settings {
  sound: boolean
  haptics: boolean
  autoContinue: boolean
  leftHanded: boolean
  /** Horizontal fretboard: high E on top like tab, or low E on top like looking down at the guitar. */
  highEOnTop: boolean
  unlockAll: boolean
  dailyGoal: number
  /** How the beat is given for rhythm exercises: a click sound, or vibration (phones only). */
  metronome: 'click' | 'vibrate'
}

export interface LessonRecord {
  stars: number
  completions: number
}

export interface SessionResult {
  lessonId?: string
  /** Correct answers in the session. */
  nailed: number
  mistakes: number
}

interface ProgressData {
  /** Total correct answers ever ("notes nailed"). */
  nailed: number
  /** Best 60-second sprint score for each sprint type. */
  bests: Record<string, number>
  /** Tracks you've rehearsed (or chosen to skip rehearsing), so Record goes straight to the take. */
  rehearsed: Record<string, true>
  lessons: Record<string, LessonRecord>
  stats: Stats
  streak: { count: number; lastDate: string | null }
  daily: { date: string; nailed: number }
  settings: Settings
}

export type Rating = 1 | 2 | 3
export const RATING_NAMES: Record<Rating, string> = { 3: 'Master take', 2: 'Keeper', 1: 'Rough take' }
export const ratingFor = (mistakes: number): Rating => (mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1)

interface ProgressState extends ProgressData {
  /** `targetMs` is the fluency target for the question type, or null if it isn't timed. */
  recordAnswer: (facts: string[], ok: boolean, ms: number, targetMs: number | null) => void
  /** Saves a sprint score. Returns true if it's a new best. */
  recordBest: (key: string, score: number) => boolean
  markRehearsed: (lessonId: string) => void
  /** Saves a finished lesson. Returns whether this extended the streak today. */
  completeSession: (result: SessionResult) => { streakExtended: boolean }
  updateSettings: (patch: Partial<Settings>) => void
  importData: (data: unknown) => boolean
  reset: () => void
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  haptics: true,
  autoContinue: false,
  leftHanded: false,
  highEOnTop: true,
  unlockAll: false,
  dailyGoal: 30,
  metronome: 'click',
}

const initialData = (): ProgressData => ({
  nailed: 0,
  bests: {},
  rehearsed: {},
  lessons: {},
  stats: {},
  streak: { count: 0, lastDate: null },
  daily: { date: today(), nailed: 0 },
  settings: { ...DEFAULT_SETTINGS },
})

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...initialData(),

      recordAnswer: (facts, ok, ms, targetMs) =>
        set((state) => {
          const stats = { ...state.stats }
          // Cap long pauses (the train pulled in, you looked up) so one doesn't wreck the average.
          const time = Math.min(ms, 15000)
          const ratio = ok && targetMs ? Math.min(3, ms / targetMs) : null
          for (const key of facts) {
            const prev: FactStat | undefined = stats[key]
            const hit = ok ? 1 : 0
            const pace = ratio === null ? prev?.pace : prev?.pace !== undefined ? prev.pace * 0.6 + ratio * 0.4 : ratio
            stats[key] = prev
              ? {
                  seen: prev.seen + 1,
                  correct: prev.correct + hit,
                  recent: prev.recent * 0.6 + hit * 0.4,
                  ms: ok ? prev.ms * 0.6 + time * 0.4 : prev.ms,
                  pace,
                }
              : { seen: 1, correct: hit, recent: hit ? 0.8 : 0.2, ms: ok ? time : 5000, pace }
          }
          return { stats }
        }),

      recordBest: (key, score) => {
        const best = get().bests[key] ?? 0
        if (score <= best) return false
        set((state) => ({ bests: { ...state.bests, [key]: score } }))
        return true
      },

      completeSession: ({ lessonId, nailed, mistakes }) => {
        const state = get()
        const day = today()
        const lessons = { ...state.lessons }
        if (lessonId) {
          const stars = ratingFor(mistakes)
          const prev = lessons[lessonId]
          lessons[lessonId] = { stars: Math.max(stars, prev?.stars ?? 0), completions: (prev?.completions ?? 0) + 1 }
        }
        const { lastDate, count } = state.streak
        const streakExtended = lastDate !== day
        const streak = !streakExtended
          ? state.streak
          : { count: lastDate === addDays(day, -1) ? count + 1 : 1, lastDate: day }
        const daily = { date: day, nailed: (state.daily.date === day ? state.daily.nailed : 0) + nailed }
        set({ lessons, streak, daily, nailed: state.nailed + nailed })
        return { streakExtended }
      },

      markRehearsed: (lessonId) => set((state) => ({ rehearsed: { ...state.rehearsed, [lessonId]: true } })),

      updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),

      importData: (data) => {
        if (!data || typeof data !== 'object' || !('stats' in data) || !('lessons' in data)) return false
        const d = data as Partial<ProgressData>
        set({ ...initialData(), ...d, settings: { ...DEFAULT_SETTINGS, ...d.settings } })
        return true
      },

      reset: () => set(initialData()),
    }),
    {
      // Kept from the app's original name so saved progress isn't lost.
      name: 'fretboard-trainer',
      version: 3,
      partialize: ({ nailed, bests, rehearsed, lessons, stats, streak, daily, settings }) => ({
        nailed,
        bests,
        rehearsed,
        lessons,
        stats,
        streak,
        daily,
        settings,
      }),
      // Version 1 counted XP (with lesson bonuses); keep it as the starting "notes nailed" count.
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Record<string, unknown>
        let out = p
        if (version < 2) {
          const daily = p.daily as { date?: string; xp?: number } | undefined
          out = { ...out, nailed: p.xp ?? 0, daily: { date: daily?.date ?? today(), nailed: daily?.xp ?? 0 } }
        }
        // Version 3 turned auto-advance off by default: it made clicks meant for Next land on the next question.
        if (version < 3) out = { ...out, settings: { ...(out.settings as object), autoContinue: false } }
        return out
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProgressData>
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } }
      },
    },
  ),
)

/** The streak as of today: it shows 0 once a full day has been missed. */
export function currentStreak(streak: ProgressData['streak']): number {
  if (!streak.lastDate) return 0
  const day = today()
  return streak.lastDate === day || streak.lastDate === addDays(day, -1) ? streak.count : 0
}

export const todayNailed = (daily: ProgressData['daily']) => (daily.date === today() ? daily.nailed : 0)

export function isUnlocked(lessonId: string, lessons: Record<string, LessonRecord>, unlockAll: boolean): boolean {
  // Anything already recorded stays open, even if the shelf order has changed since.
  if (unlockAll || (lessons[lessonId]?.stars ?? 0) > 0) return true
  const i = ALL_LESSONS.findIndex((l) => l.id === lessonId)
  return i <= 0 || (lessons[ALL_LESSONS[i - 1].id]?.stars ?? 0) > 0
}

/** The first lesson you haven't finished yet. */
export function currentLessonId(lessons: Record<string, LessonRecord>): string | null {
  return ALL_LESSONS.find((l) => !lessons[l.id]?.stars)?.id ?? null
}

export function exportData(): string {
  const { nailed, bests, rehearsed, lessons, stats, streak, daily, settings } = useProgress.getState()
  return JSON.stringify(
    { app: 'commuter-tapes', exported: new Date().toISOString(), nailed, bests, rehearsed, lessons, stats, streak, daily, settings },
    null,
    2,
  )
}
