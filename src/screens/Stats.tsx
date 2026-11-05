import { useState } from 'react'
import { Fretboard, useLandscape, type Marker } from '../components/Fretboard'
import { Button, LedBar, TabShell } from '../components/ui'
import { heatColor } from '../lib/color'
import { navigate } from '../lib/router'
import { mastery, type Mastery } from '../game/questions'
import { skillMeters } from '../game/skills'
import { describePosition, MAX_FRET, midiAt, noteAt, NUM_STRINGS, parsePosKey, pcName, pitchClass, type Position } from '../music/notes'
import { useProgress } from '../store/progress'

const MASTERY_FILL: Record<Exclude<Mastery, 'new'>, string> = {
  learning: heatColor(0),
  accurate: heatColor(0.5),
  fluent: heatColor(1),
}
const ALL_SPOTS = NUM_STRINGS * (MAX_FRET + 1)

export function StatsScreen() {
  const landscape = useLandscape()
  const stats = useProgress((s) => s.stats)
  const [selected, setSelected] = useState<Position | null>(null)

  const positions = Object.entries(stats).flatMap(([key, stat]) => {
    const pos = parsePosKey(key)
    return pos && stat.seen > 0 ? [{ pos, stat }] : []
  })
  const seen = positions.reduce((n, p) => n + p.stat.seen, 0)
  const right = positions.reduce((n, p) => n + p.stat.correct, 0)
  const fluent = positions.filter((p) => mastery(p.stat) === 'fluent').length

  const markers: Marker[] = positions.map(({ pos, stat }) => ({
    pos,
    tone: 'heat',
    fill: MASTERY_FILL[mastery(stat) as Exclude<Mastery, 'new'>],
    label: noteAt(pos),
  }))
  const selectedStat = selected ? stats[`${selected.string}:${selected.fret}`] : undefined

  const summary = (
    <>
      <h1 className="label-text text-sm text-muted">Meters</h1>
      {/* Days in a row and notes nailed are already in the strip at the top. */}
      <div className="panel grid grid-cols-2 gap-x-4 p-5">
        <Readout label="Fluent spots" value={`${fluent}/${ALL_SPOTS}`} />
        <Readout label="Accuracy" value={seen ? `${Math.round((right / seen) * 100)}%` : '--'} />
      </div>
      <section className="panel p-5" aria-label="Skills">
        <h2 className="label-text text-base text-cream">Skills</h2>
        <p className="mt-1 text-sm text-muted">How solid each area is: fluent (right and fast) out of what you’ve practiced.</p>
        <ul className="mt-3 flex flex-col gap-2">
          {skillMeters(stats).map((m) => (
            <li key={m.label} className="flex items-center gap-3" aria-label={m.practiced ? `${m.label}: ${m.fluent} of ${m.practiced} fluent` : `${m.label}: not started`}>
              <span className={`label-text w-28 shrink-0 text-[11px] ${m.practiced ? 'text-cream' : 'text-muted'}`}>{m.label}</span>
              <LedBar value={m.fluent} total={m.practiced} />
              <span className="ml-auto font-mono text-xs text-cream-dim">{m.practiced ? `${m.fluent}/${m.practiced}` : '—'}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel p-5">
        <h2 className="label-text text-base text-cream">Signal map</h2>
        <p className="mt-1 text-sm text-muted">
          Every spot you’ve practiced lights up by where it stands: <span style={{ color: MASTERY_FILL.learning }}>red</span> is still
          learning, <span style={{ color: MASTERY_FILL.accurate }}>amber</span> is right but slow,{' '}
          <span style={{ color: MASTERY_FILL.fluent }}>green</span> is fluent (right and fast). Tap a spot for details.
        </p>
        <p className="mt-2 min-h-[1.5rem] font-mono text-sm text-amber">
          {selected && selectedStat
            ? `${pcName(pitchClass(midiAt(selected)))} · ${describePosition(selected)} · ${mastery(selectedStat)} · ${selectedStat.correct}/${selectedStat.seen} · ~${(selectedStat.ms / 1000).toFixed(1)}s`
            : selected
              ? `${describePosition(selected)}: not practiced yet`
              : ''}
        </p>
      </section>
      <Button variant="rec" onClick={() => navigate('/weak')} disabled={positions.length < 3}>
        ● Jam on trouble spots
      </Button>
    </>
  )

  if (landscape) {
    return (
      <TabShell>
        <div className="flex h-full gap-3 p-3">
          <div className="min-h-0 flex-1">
            <Fretboard markers={markers} onTap={setSelected} />
          </div>
          <div className="flex w-[38%] flex-col gap-3 overflow-y-auto">{summary}</div>
        </div>
      </TabShell>
    )
  }

  return (
    <TabShell>
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
        {summary}
        <Fretboard markers={markers} onTap={setSelected} fit="width" />
      </div>
    </TabShell>
  )
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="lcd px-3 py-2 text-2xl">{value}</div>
      <div className="label-text mt-1.5 text-[10px] text-muted">{label}</div>
    </div>
  )
}
