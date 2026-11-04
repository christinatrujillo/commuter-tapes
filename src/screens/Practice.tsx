import { useState, type ReactNode } from 'react'
import { Button, LabelTape, LedButtons, TabShell, Toggle } from '../components/ui'
import { DEFAULT_DRILL, drillToQuery, type DrillOptions } from '../game/drill'
import { recordedOn, THEORY_JAMS } from '../game/jams'
import { describeFact, dueFacts, weakestFacts } from '../game/review'
import { today } from '../lib/date'
import type { ExerciseType } from '../music/curriculum'
import { STRING_LABELS } from '../music/notes'
import { navigate } from '../lib/router'
import { listeningOff, useProgress } from '../store/progress'
import { REVIEW_SESSION } from './Lesson'
import { SPRINT_PRESETS, SPRINT_SECONDS } from './Sprint'

const FRET_RANGES: { value: string; label: string; frets: [number, number] }[] = [
  { value: '0-4', label: '0–4', frets: [0, 4] },
  { value: '0-7', label: '0–7', frets: [0, 7] },
  { value: '5-12', label: '5–12', frets: [5, 12] },
  { value: '0-12', label: '0–12', frets: [0, 12] },
]

const EXERCISE_OPTIONS: { value: ExerciseType; label: string; hint: string }[] = [
  { value: 'name', label: 'Name the note', hint: 'A dot lights up on the neck: pick its name' },
  { value: 'find', label: 'Find the note', hint: '“Tap G on the A string”: tap the fret' },
  { value: 'findAll', label: 'Find every one', hint: '“Find every G”: tap them all in range' },
  { value: 'staffFind', label: 'Staff to neck', hint: 'A note on the staff: tap where it’s played' },
  { value: 'staffName', label: 'Read the staff', hint: 'A note on the staff: pick its name' },
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
  const lessons = useProgress((s) => s.lessons)
  const bests = useProgress((s) => s.bests)
  const listening = useProgress((s) => listeningOff(s) === null)
  const weak = weakestFacts(stats, 5, listening)
  const due = dueFacts(stats, today(), listening).length
  const [sprint, setSprint] = useState(() => (SPRINT_PRESETS[0].ready(stats, lessons) ? SPRINT_PRESETS[0].id : 'low'))
  const preset = SPRINT_PRESETS.find((p) => p.id === sprint)!
  const sprintReady = preset.ready(stats, lessons)
  // Theory jams appear once you've recorded a track they draw on.
  const jams = THEORY_JAMS.map((j) => ({ ...j, ready: recordedOn(j.tapes, lessons).length > 0 }))
  const [drill, setDrill] = useState<DrillOptions>(DEFAULT_DRILL)
  const update = (patch: Partial<DrillOptions>) => setDrill((d) => ({ ...d, ...patch }))
  const canStart = drill.strings.length > 0 && drill.exercises.length > 0

  return (
    <TabShell>
      <div className="mx-auto flex max-w-lg flex-col gap-5 p-4">
        <h1 className="label-text text-sm text-muted">Jam room</h1>

        <section className="panel px-5 pt-5 pb-5">
          <h2 className="label-text text-lg text-cream">Review</h2>
          <p className="mt-1 text-sm text-muted">
            Notes and ideas from earlier tapes that are due for a refresh. They already mix into every take, so this is extra, for when you have a spare minute.
          </p>
          <p className="mt-3 text-sm text-muted">
            {due ? (
              <>
                <span className="font-mono text-amber">{due}</span> due · {Math.min(due, REVIEW_SESSION)} at a time
              </>
            ) : (
              'Nothing due right now.'
            )}
          </p>
          <Button variant="cream" className="mt-4" disabled={!due} onClick={() => navigate('/review')}>
            ↺ Review now
          </Button>
        </section>

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
              preset.sealed
            )}
          </p>
          <Button className="mt-4" disabled={!sprintReady} onClick={() => navigate(`/sprint?p=${sprint}`)}>
            ▶ Count me in
          </Button>
        </section>

        <section className="panel px-5 pt-5 pb-5">
          <h2 className="label-text text-lg text-cream">Trouble spots</h2>
          <p className="mt-1 text-sm text-muted">Twelve quick questions on what you clip most or answer slowest.</p>
          {weak.length >= 3 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {weak.map((fact, i) => (
                // Label-maker strips stuck on the console, never quite straight.
                <li key={fact} style={{ transform: `rotate(${i % 2 ? 1 : -1}deg)` }}>
                  <LabelTape>{describeFact(fact)}</LabelTape>
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

        {jams.some((j) => j.ready) && (
          <section className="panel px-5 pt-5 pb-5">
            <h2 className="label-text text-lg text-cream">Theory jam</h2>
            <p className="mt-1 text-sm text-muted">Ten quick questions from the theory tracks you’ve recorded. One tap, no setup.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {jams.map((j) => {
                const waiting = j.id === 'ear' && !listening
                return (
                  <button
                    key={j.id}
                    disabled={!j.ready || waiting}
                    onClick={() => navigate(`/jam?t=${j.id}`)}
                    className="hw-btn hw-dark flex flex-col items-center px-2 py-3 text-sm"
                  >
                    {j.label}
                    {!j.ready && <span className="mt-0.5 text-[10px] normal-case opacity-80">Record its tape first</span>}
                    {j.ready && waiting && <span className="mt-0.5 text-[10px] normal-case opacity-80">Monitors off</span>}
                  </button>
                )
              })}
            </div>
          </section>
        )}

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
          <Channel label="Drills (pick one or more)">
            <div className="divide-y divide-edge">
              {EXERCISE_OPTIONS.map((o) => (
                <Toggle
                  key={o.value}
                  label={o.label}
                  hint={o.hint}
                  checked={drill.exercises.includes(o.value)}
                  onChange={() => update({ exercises: toggle(drill.exercises, o.value) })}
                />
              ))}
            </div>
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
