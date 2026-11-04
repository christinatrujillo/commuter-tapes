import { useRef, type ChangeEvent, type ReactNode } from 'react'
import { canVibrate } from '../audio/metronome'
import { BackHeader, Button, LedButtons, Toggle } from '../components/ui'
import { exportData, useProgress } from '../store/progress'

const GOALS = [
  { value: 15, label: 'Warm-up · 15' },
  { value: 30, label: 'Rehearsal · 30' },
  { value: 50, label: 'Session · 50' },
  { value: 80, label: 'Marathon · 80' },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel px-5 py-3">
      <h2 className="label-text pt-1 text-[11px] text-muted">{title}</h2>
      <div className="divide-y divide-edge">{children}</div>
    </section>
  )
}

export function SettingsScreen() {
  const settings = useProgress((s) => s.settings)
  const update = useProgress((s) => s.updateSettings)
  const importData = useProgress((s) => s.importData)
  const reset = useProgress((s) => s.reset)
  const fileInput = useRef<HTMLInputElement>(null)

  const download = () => {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `commuter-tapes-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const restore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const ok = importData(JSON.parse(await file.text()))
      window.alert(ok ? 'Progress restored.' : 'That file doesn’t look like a Commuter Tapes backup.')
    } catch {
      window.alert('Couldn’t read that file.')
    }
  }

  return (
    <div className="flex h-dvh flex-col">
      <BackHeader subtitle="Control panel" title="Settings" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
          <Section title="Sound">
            <Toggle label="Sound" hint="Hear each note when you answer" checked={settings.sound} onChange={(sound) => update({ sound })} />
            <Toggle label="Vibration" hint="Buzz when you clip" checked={settings.haptics} onChange={(haptics) => update({ haptics })} />
            <div className="flex items-center justify-between gap-4 py-3">
              <span>
                <span className="label-text block text-sm text-cream">Metronome</span>
                <span className="block text-sm text-muted">
                  {canVibrate() ? 'How you get the beat for rhythm exercises' : 'Click (this device can’t vibrate)'}
                </span>
              </span>
              {canVibrate() && (
                <LedButtons
                  options={[
                    { value: 'click', label: 'Click' },
                    { value: 'vibrate', label: 'Vibrate' },
                  ]}
                  selected={[settings.metronome]}
                  onToggle={(metronome) => update({ metronome })}
                />
              )}
            </div>
            <Toggle
              label="Ear training"
              hint="Listening questions, for when you have headphones. Off skips the ear-training tracks."
              checked={settings.earTraining}
              onChange={(earTraining) => update({ earTraining })}
            />
          </Section>

          <Section title="Lessons">
            <Toggle
              label="Auto-advance"
              hint="Move on after a clean answer"
              checked={settings.autoContinue}
              onChange={(autoContinue) => update({ autoContinue })}
            />
            <Toggle
              label="Unseal every tape"
              hint="Record any track without finishing the ones before it"
              checked={settings.unlockAll}
              onChange={(unlockAll) => update({ unlockAll })}
            />
            <div className="py-3">
              <span className="label-text block text-sm text-cream">Daily goal</span>
              <span className="mb-2.5 block text-sm text-muted">Right answers a day, shown on the VU meter</span>
              <LedButtons options={GOALS} selected={[settings.dailyGoal]} onToggle={(dailyGoal) => update({ dailyGoal })} />
            </div>
          </Section>

          <Section title="Fretboard">
            <Toggle label="Left-handed" hint="Mirror the fretboard" checked={settings.leftHanded} onChange={(leftHanded) => update({ leftHanded })} />
            <Toggle
              label="High E on top"
              hint="When the phone is sideways: on = like tab, off = like looking down at your guitar"
              checked={settings.highEOnTop}
              onChange={(highEOnTop) => update({ highEOnTop })}
            />
          </Section>

          <Section title="Your tapes">
            <div className="flex flex-col gap-3 py-3">
              <p className="text-sm text-muted">
                Progress is saved on this phone only. Clearing Chrome’s site data erases it, so export a backup now and then.
              </p>
              <Button variant="cream" onClick={download}>
                Export backup
              </Button>
              <Button variant="cream" onClick={() => fileInput.current?.click()}>
                Load backup
              </Button>
              <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={restore} />
              <Button
                variant="rec"
                onClick={() => {
                  if (window.confirm('Erase all progress and stats? This can’t be undone.')) reset()
                }}
              >
                Erase everything
              </Button>
            </div>
          </Section>
        </div>
      </main>
    </div>
  )
}
