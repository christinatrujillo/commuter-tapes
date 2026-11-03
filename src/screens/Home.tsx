import { useEffect, useRef } from 'react'
import { Cassette } from '../components/Cassette'
import { TabShell } from '../components/ui'
import { navigate } from '../lib/router'
import { ALL_LESSONS, UNITS, type Unit } from '../music/curriculum'
import { currentLessonId, isUnlocked, useProgress } from '../store/progress'

/** Home: every unit is a cassette on a shelf. */
export function HomeScreen() {
  const lessons = useProgress((s) => s.lessons)
  const unlockAll = useProgress((s) => s.settings.unlockAll)
  const current = currentLessonId(lessons)
  const currentRef = useRef<HTMLDivElement>(null)
  const tracksDone = ALL_LESSONS.filter((l) => lessons[l.id]?.stars).length

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  const rows: Unit[][] = []
  for (let i = 0; i < UNITS.length; i += 2) rows.push(UNITS.slice(i, i + 2))

  return (
    <TabShell>
      <div className="mx-auto max-w-lg px-4 pt-5 pb-10">
        <div className="mb-5 flex items-baseline justify-between">
          <h1 className="label-text text-sm text-muted">Tape shelf</h1>
          <span className="font-mono text-xs text-muted">
            {tracksDone}/{ALL_LESSONS.length} tracks recorded
          </span>
        </div>
        {rows.map((row, r) => (
          <div key={r} className="mb-8">
            <div className="grid grid-cols-2 gap-4 px-1">
              {row.map((unit) => {
                const number = UNITS.indexOf(unit) + 1
                const nowPlaying = unit.lessons.some((l) => l.id === current)
                return (
                  <div key={unit.id} ref={nowPlaying ? currentRef : undefined}>
                    <TapeTile
                      unit={unit}
                      number={number}
                      recorded={unit.lessons.filter((l) => lessons[l.id]?.stars).length}
                      sealed={!isUnlocked(unit.lessons[0].id, lessons, unlockAll)}
                      nowPlaying={nowPlaying}
                      nextTitle={unit.lessons.find((l) => !lessons[l.id]?.stars)?.title}
                    />
                  </div>
                )
              })}
            </div>
            <div className="shelf -mx-2 mt-2" />
          </div>
        ))}
      </div>
    </TabShell>
  )
}

function TapeTile({
  unit,
  number,
  recorded,
  sealed,
  nowPlaying,
  nextTitle,
}: {
  unit: Unit
  number: number
  recorded: number
  sealed: boolean
  nowPlaying: boolean
  nextTitle?: string
}) {
  const total = unit.lessons.length
  const status = sealed
    ? `Finish tape ${number - 1} to unseal`
    : recorded >= total
      ? 'All tracks recorded'
      : nowPlaying && nextTitle
        ? `Next: ${nextTitle}`
        : `${recorded}/${total} recorded`
  return (
    <button onClick={() => navigate(`/tape/${unit.id}`)} className="relative block w-full text-left" aria-label={`Tape ${number}: ${unit.title}`}>
      {nowPlaying && (
        <div className="absolute -top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded border border-edge bg-room px-2 py-0.5 whitespace-nowrap">
          <span className="led led-red blink !h-2 !w-2" />
          <span className="label-text text-[10px] text-cream">Now playing</span>
        </div>
      )}
      <div className={`rounded-lg ${nowPlaying ? 'ring-2 ring-amber/70 ring-offset-2 ring-offset-room' : ''} ${sealed ? 'opacity-70' : ''}`}>
        <Cassette title={unit.title} number={number} color={unit.color} recorded={recorded} total={total} sealed={sealed} playing={nowPlaying} />
      </div>
      <div className="mt-2 px-0.5">
        <div className="label-text text-[10px] text-muted">Tape {number}</div>
        <div className={`truncate text-sm ${sealed ? 'text-muted' : 'text-cream'}`}>{status}</div>
      </div>
    </button>
  )
}
