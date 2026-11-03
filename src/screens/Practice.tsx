import { useState, type ReactNode } from 'react'
import { Button, LabelTape, LedButtons, TabShell, Toggle } from '../components/ui'
import { DEFAULT_DRILL, drillToQuery, type DrillOptions } from '../game/drill'
import { practicedPositions, weakestPositions } from '../game/questions'
import type { ExerciseType } from '../music/curriculum'
import { STRING_LABELS, describePosition, midiAt, pcName, pitchClass } from '../music/notes'
import { navigate } from '../lib/router'
import { useProgress } from '../store/progress'
import { MIN_PRACTICED_SPOTS, SPRINT_PRESETS, SPRINT_SECONDS } from './Sprint'

const FRET_RANGES: { value: string; label: string; frets: [number, number] }[] = [
  { value: '0-4', label: '0–4', frets: [0, 4] },
  { value: '0-7', label: '0–7', frets: [0, 7] },
  { value: '5-12', label: '5–12', frets: [5, 12] },
  { value: '0-12', label: '0–12', frets: [0, 12] },
]

const EXERCISE_OPTIONS: { value: ExerciseType; label: string }[] = [
  { value: 'name', label: 'Name it' },
  { value: 'find', label: 'Find it' },
  { value: 'findAll', label: 'Find them all' },
  { value: 'staffFind', label: 'Staff → frets' },
  { value: 'staffName', label: 'Read the staff' },
]

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

function Channel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-edge py-3 first:border-t-0">
      <h3 className="label-text mb-2 text-[11px] text-muted">{label}</h3>
      {children}
    </div>
  )
}

export function PracticeScreen() {
  const stats = useProgress((s) => s.stats)
  const bests = useProgress((s) => s.bests)
  const weak = weakestPositions(stats, 5)
  const practiced = practicedPositions(stats).length
  const [sprint, setSprint] = useState(practiced >= MIN_PRACTICED_SPOTS ? 'practiced' : 'low')
  const sprintReady = sprint !== 'practiced' || practiced >= MIN_PRACTICED_SPOTS
  const [drill, setDrill] = useState<DrillOptions>(DEFAULT_DRILL)
  const update = (patch: Partial<DrillOptions>) => setDrill((d) => ({ ...d, ...patch }))
  const canStart = drill.strings.length > 0 && drill.exercises.length > 0

  return (
    <TabShell>
      <div className="mx-auto flex max-w-lg flex-col gap-5 p-4">
        <h1 className="label-text text-sm text-muted">Jam room</h1>

        <section className="panel px-5 pt-5 pb-5">
          <h2 className="label-text text-lg text-cream">{SPRINT_SECONDS}-second sprint</h2>
          <p className="mt-1 text-sm text-muted">As many right answers as you can in a minute. Speed is what makes notes automatic.</p>
          <div className="mt-4">
            <LedButtons options={SPRINT_PRESETS.map((p) => ({ value: p.id, label: p.label }))} selected={[sprint]} onToggle={setSprint} />
          </div>
          <p className="mt-3 text-sm text-muted">
            {sprintReady ? (
              <>
                Best: <span className="font-mono text-amber">{bests[sprint] ?? '—'}</span>
              </>
            ) : (
              `Practice at least ${MIN_PRACTICED_SPOTS} spots to unlock this one.`
            )}
          </p>
          <Button className="mt-4" disabled={!sprintReady} onClick={() => navigate(`/sprint?p=${sprint}`)}>
            ▶ Count me in
          </Button>
        </section>

        <section className="panel px-5 pt-5 pb-5">
          <h2 className="label-text text-lg text-cream">Trouble spots</h2>
          <p className="mt-1 text-sm text-muted">Twelve quick notes from the spots you clip most or answer slowest.</p>
          {weak.length >= 3 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {weak.map((p, i) => (
                // Label-maker strips stuck on the console, never quite straight.
                <li key={`${p.string}:${p.fret}`} style={{ transform: `rotate(${i % 2 ? 1 : -1}deg)` }}>
                  <LabelTape>
                    {pcName(pitchClass(midiAt(p)), 'sharp')} · {describePosition(p)}
                  </LabelTape>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Record a few tracks first so there’s something to work on.</p>
          )}
          <Button variant="rec" className="mt-5" disabled={weak.length < 3} onClick={() => navigate('/weak')}>
            ● Jam on these
          </Button>
        </section>

        <section className="panel px-5 pt-5 pb-5">
          <h2 className="label-text text-lg text-cream">Jam setup</h2>
          <p className="mt-1 mb-2 text-sm text-muted">Dial in exactly what to drill.</p>

          <Channel label="Strings">
            <LedButtons
              options={STRING_LABELS.map((label, s) => ({ value: s, label }))}
              selected={drill.strings}
              onToggle={(s) => update({ strings: toggle(drill.strings, s).sort((a, b) => a - b) })}
            />
          </Channel>
          <Channel label="Frets">
            <LedButtons
              options={FRET_RANGES.map((r) => ({ value: r.value, label: r.label }))}
              selected={[drill.frets.join('-')]}
              onToggle={(v) => update({ frets: FRET_RANGES.find((r) => r.value === v)!.frets })}
            />
          </Channel>
          <Channel label="Drills">
            <LedButtons options={EXERCISE_OPTIONS} selected={drill.exercises} onToggle={(e) => update({ exercises: toggle(drill.exercises, e) })} />
          </Channel>
          <Channel label="Length">
            <LedButtons
              options={[10, 20, 30].map((n) => ({ value: n, label: `${n} notes` }))}
              selected={[drill.count]}
              onToggle={(n) => update({ count: n })}
            />
          </Channel>
          <div className="border-t border-edge">
            <Toggle label="Sharps & flats" checked={drill.accidentals} onChange={(accidentals) => update({ accidentals })} />
          </div>

          <Button className="mt-3" disabled={!canStart} onClick={() => navigate(`/drill?${drillToQuery(drill)}`)}>
            ▶ Start jam
          </Button>
        </section>
      </div>
    </TabShell>
  )
}
