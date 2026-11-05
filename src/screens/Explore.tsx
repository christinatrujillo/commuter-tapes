import { useState } from 'react'
import { playNotes } from '../audio/sound'
import { Fretboard, useLandscape, type Marker } from '../components/Fretboard'
import { Staff } from '../components/Staff'
import { LedButtons, TabShell } from '../components/ui'
import {
  FULL_NECK,
  allPositions,
  describePosition,
  isNatural,
  midiAt,
  noteAt,
  pcName,
  pitchClass,
  samePos,
  spellMidi,
  spelledName,
  staffPlace,
  vexKey,
  WRITTEN_OCTAVE_SHIFT,
  type Position,
} from '../music/notes'
import { keyLabel, type KeyId } from '../music/score'
import { intervalName, intervalSize, majorScale, parseInterval, toneName, tonePc } from '../music/theory'
import { fretboardViews } from '../game/jams'
import { useProgress } from '../store/progress'

const PCS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

type Mode = 'notes' | 'scale' | 'interval'

/**
 * A reference fretboard: every note labeled, tap one to hear it and see it on the staff. Once
 * you've reached the scale and interval tapes, a Scale view and an Interval view join it, showing
 * only the keys and intervals you've learned.
 */
export function ExploreScreen() {
  const landscape = useLandscape()
  const lessons = useProgress((s) => s.lessons)
  const unlocked = fretboardViews(lessons)
  const [mode, setMode] = useState<Mode>('notes')
  const [showSharps, setShowSharps] = useState(false)
  const [highlight, setHighlight] = useState<number | null>(null)
  const [selected, setSelected] = useState<Position | null>(null)
  const [key, setKey] = useState<KeyId>(unlocked.keys[0] ?? 'C')
  const [degrees, setDegrees] = useState(false)
  const [interval, setIntervalName] = useState(unlocked.intervals[0] ?? 'P5')

  const modes: { value: Mode; label: string }[] = [
    { value: 'notes', label: 'Notes' },
    ...(unlocked.keys.length ? [{ value: 'scale' as const, label: 'Scale' }] : []),
    ...(unlocked.intervals.length ? [{ value: 'interval' as const, label: 'Interval' }] : []),
  ]

  const tones = majorScale(key)
  const scalePcs = tones.map(tonePc)
  const size = intervalSize(parseInterval(interval)) ?? 7
  const ivName = intervalName(parseInterval(interval))

  let markers: Marker[]
  if (mode === 'scale') {
    markers = allPositions(FULL_NECK)
      .filter((p) => scalePcs.includes(pitchClass(midiAt(p))))
      .map((p) => {
        const d = scalePcs.indexOf(pitchClass(midiAt(p)))
        return { pos: p, tone: selected && samePos(p, selected) ? 'target' : d === 0 ? 'root' : 'note', label: degrees ? String(d + 1) : toneName(tones[d]) }
      })
  } else if (mode === 'interval') {
    // From the note you tap: every spot on the neck an interval above it.
    markers = selected
      ? [
          { pos: selected, tone: 'root', label: noteAt(selected) },
          ...allPositions(FULL_NECK)
            .filter((p) => midiAt(p) === midiAt(selected) + size)
            .map((p): Marker => ({ pos: p, tone: 'correct', label: noteAt(p) })),
        ]
      : []
  } else {
    markers = allPositions(FULL_NECK)
      .filter((p) => {
        const pc = pitchClass(midiAt(p))
        return highlight === null ? showSharps || isNatural(pc) : pc === highlight
      })
      .map((p) => {
        const pc = pitchClass(midiAt(p))
        const tone = selected && samePos(p, selected) ? 'target' : highlight !== null ? 'correct' : isNatural(pc) ? 'note' : 'accidental'
        return { pos: p, tone, label: pcName(pc, 'sharp') }
      })
  }

  const tap = (p: Position) => {
    setSelected(p)
    playNotes(...(mode === 'interval' ? [midiAt(p), midiAt(p) + size] : [midiAt(p)]))
  }

  const written = selected ? spellMidi(midiAt(selected) + WRITTEN_OCTAVE_SHIFT, 'sharp') : null
  const degreeOf = selected ? scalePcs.indexOf(pitchClass(midiAt(selected))) : -1

  const info =
    mode === 'interval' ? (
      <p className="px-2 text-cream">
        {selected
          ? `${noteAt(selected)} up ${/^[aeiou]/.test(ivName) ? 'an' : 'a'} ${ivName} is ${pcName(pitchClass(midiAt(selected) + size), 'sharp')}: ${size} half steps. Every spot lit green plays it.`
          : 'Tap any note to start from it.'}
      </p>
    ) : selected && written ? (
      <>
        <div className="paper h-24 w-32 shrink-0 px-1">
          <Staff keys={[vexKey(written)]} />
        </div>
        <div className="min-w-0">
          <div className="font-label text-3xl leading-none text-amber">{pcName(pitchClass(midiAt(selected)))}</div>
          <div className="mt-1 text-cream">{describePosition(selected)}</div>
          <div className="text-sm text-muted">
            {mode === 'scale' && degreeOf >= 0
              ? `The ${degreeOf + 1}${['st', 'nd', 'rd'][degreeOf] ?? 'th'} note of ${keyLabel(key)} major`
              : `Written ${spelledName(written, true)}, ${staffPlace(written)}`}
          </div>
        </div>
      </>
    ) : (
      <p className="px-2 text-muted">
        {mode === 'scale' ? `Every note of the ${keyLabel(key)} major scale, the root glowing. Tap one to hear it.` : 'Tap any fret to hear it and see where it’s written on the staff.'}
      </p>
    )

  const controls = (
    <div className="flex flex-col gap-3">
      <h1 className="label-text text-sm text-muted">Fretboard reference</h1>
      {modes.length > 1 && (
        <LedButtons
          columns={modes.length}
          options={modes}
          selected={[mode]}
          onToggle={(m) => {
            setMode(m)
            setSelected(null)
          }}
        />
      )}
      {mode === 'notes' && (
        <>
          <LedButtons
            options={[
              { value: 'naturals', label: 'Natural notes' },
              { value: 'all', label: 'All notes' },
            ]}
            selected={[showSharps ? 'all' : 'naturals']}
            onToggle={(v) => {
              setShowSharps(v === 'all')
              setHighlight(null)
            }}
          />
          <div>
            <div className="label-text mb-2 text-[11px] text-muted">Solo one note</div>
            <LedButtons
              options={PCS.filter((pc) => showSharps || isNatural(pc)).map((pc) => ({ value: pc, label: pcName(pc, 'sharp') }))}
              selected={highlight === null ? [] : [highlight]}
              onToggle={(pc) => setHighlight(highlight === pc ? null : pc)}
            />
          </div>
        </>
      )}
      {mode === 'scale' && (
        <>
          <div>
            <div className="label-text mb-2 text-[11px] text-muted">Major scale</div>
            <LedButtons options={unlocked.keys.map((k) => ({ value: k, label: keyLabel(k) }))} selected={[key]} onToggle={setKey} />
          </div>
          <LedButtons
            options={[
              { value: 'names', label: 'Note names' },
              { value: 'degrees', label: 'Degrees' },
            ]}
            selected={[degrees ? 'degrees' : 'names']}
            onToggle={(v) => setDegrees(v === 'degrees')}
          />
        </>
      )}
      {mode === 'interval' && (
        <div>
          <div className="label-text mb-2 text-[11px] text-muted">Interval</div>
          <LedButtons options={unlocked.intervals.map((s) => ({ value: s, label: s }))} selected={[interval]} onToggle={setIntervalName} />
        </div>
      )}
      <div className="panel flex min-h-[120px] items-center gap-3 p-3">{info}</div>
    </div>
  )

  if (landscape) {
    return (
      <TabShell>
        <div className="flex h-full gap-3 p-3">
          <div className="min-h-0 flex-1">
            <Fretboard markers={markers} onTap={tap} />
          </div>
          <div className="w-[38%] overflow-y-auto">{controls}</div>
        </div>
      </TabShell>
    )
  }

  return (
    <TabShell>
      <div className="mx-auto flex max-w-lg flex-col gap-3 p-4">
        {controls}
        <Fretboard markers={markers} onTap={tap} fit="width" />
      </div>
    </TabShell>
  )
}
