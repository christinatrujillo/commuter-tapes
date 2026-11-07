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
import { intervalName, intervalSize, majorScale, parseInterval, relativeMinor, toneId, toneName, tonePc, type Tone } from '../music/theory'
import { bluesScale, majorPentatonic, minorPentatonic, patternSpots, SCALE_DEGREES } from '../game/blues'
import { fretboardViews, type ScaleView } from '../game/jams'
import { useProgress } from '../store/progress'

const PCS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

type Mode = 'notes' | 'scale' | 'interval'
/** Which notes the Notes view shows, and what it calls the ones between the natural notes. */
type Names = 'naturals' | 'sharps' | 'flats'

const SCALE_NAMES: Record<ScaleView, string> = { major: 'Major scale', majorPent: 'Major pentatonic', minorPent: 'Minor pentatonic', blues: 'Blues scale' }

/** A scale the Scale view can show in `key`: the minor ones start on its relative minor, so they share its notes. */
function scaleIn(view: ScaleView, key: KeyId): { tones: Tone[]; degrees: string[]; name: string } {
  const minor = relativeMinor(key)
  switch (view) {
    case 'majorPent':
      return { tones: majorPentatonic(key), degrees: SCALE_DEGREES.majorPent, name: `${keyLabel(key)} major pentatonic` }
    case 'minorPent':
      return { tones: minorPentatonic(toneId(minor)), degrees: SCALE_DEGREES.minorPent, name: `${toneName(minor)} minor pentatonic` }
    case 'blues':
      return { tones: bluesScale(toneId(minor)), degrees: SCALE_DEGREES.blues, name: `${toneName(minor)} blues scale` }
    default:
      return { tones: majorScale(key), degrees: ['1', '2', '3', '4', '5', '6', '7'], name: `${keyLabel(key)} major scale` }
  }
}

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
  const [names, setNames] = useState<Names>('naturals')
  const spelling = names === 'flats' ? 'flat' : 'sharp'
  const [highlight, setHighlight] = useState<number | null>(null)
  const [selected, setSelected] = useState<Position | null>(null)
  const [key, setKey] = useState<KeyId>(unlocked.keys[0] ?? 'C')
  const [degrees, setDegrees] = useState(false)
  const [scale, setScale] = useState<ScaleView>(unlocked.scales[0] ?? 'major')
  // 0 shows the whole neck; 1 to 5 show one pentatonic pattern.
  const [pattern, setPattern] = useState(0)
  const [interval, setIntervalName] = useState(unlocked.intervals[0] ?? 'P5')

  const modes: { value: Mode; label: string }[] = [
    { value: 'notes', label: 'Notes' },
    ...(unlocked.keys.length ? [{ value: 'scale' as const, label: 'Scale' }] : []),
    ...(unlocked.intervals.length ? [{ value: 'interval' as const, label: 'Interval' }] : []),
  ]

  const shown = scaleIn(unlocked.scales.includes(scale) ? scale : 'major', key)
  const tones = shown.tones
  const scalePcs = tones.map(tonePc)
  const onePattern = scale === 'minorPent' && unlocked.patterns.includes(pattern)
  const patternNotes = onePattern ? patternSpots(toneId(tones[0]), pattern) : []
  const size = intervalSize(parseInterval(interval)) ?? 7
  const ivName = intervalName(parseInterval(interval))

  let markers: Marker[]
  if (mode === 'scale') {
    markers = (onePattern ? patternNotes : allPositions(FULL_NECK))
      .filter((p) => scalePcs.includes(pitchClass(midiAt(p))))
      .map((p) => {
        const d = scalePcs.indexOf(pitchClass(midiAt(p)))
        return { pos: p, tone: selected && samePos(p, selected) ? 'target' : d === 0 ? 'root' : 'note', label: degrees ? shown.degrees[d] : toneName(tones[d]) }
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
        return highlight === null ? names !== 'naturals' || isNatural(pc) : pc === highlight
      })
      .map((p) => {
        const pc = pitchClass(midiAt(p))
        const tone = selected && samePos(p, selected) ? 'target' : highlight !== null ? 'correct' : isNatural(pc) ? 'note' : 'accidental'
        return { pos: p, tone, label: pcName(pc, spelling) }
      })
  }

  const tap = (p: Position) => {
    // In the Notes and Scale views only the notes on show answer a tap; in the Interval view you
    // pick a starting note anywhere.
    if (mode !== 'interval' && !markers.some((m) => samePos(m.pos, p))) return
    setSelected(p)
    playNotes(...(mode === 'interval' ? [midiAt(p), midiAt(p) + size] : [midiAt(p)]))
  }

  const written = selected ? spellMidi(midiAt(selected) + WRITTEN_OCTAVE_SHIFT, spelling) : null
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
              ? shown.tones.length === 7
                ? `The ${degreeOf + 1}${['st', 'nd', 'rd'][degreeOf] ?? 'th'} note of ${keyLabel(key)} major`
                : degreeOf === 0
                  ? `The root of the ${shown.name}`
                  : `Degree ${shown.degrees[degreeOf]} of the ${shown.name}`
              : `Written ${spelledName(written, true)}, ${staffPlace(written)}`}
          </div>
        </div>
      </>
    ) : (
      <p className="px-2 text-muted">
        {mode === 'scale'
          ? onePattern
            ? `Pattern ${pattern} of the ${shown.name}, the root glowing.${patternNotes.length < 12 ? ' Part of it runs past the 12th fret, where this neck ends.' : ' Tap a note to hear it.'}`
            : `Every note of the ${shown.name}, the root glowing. Tap one to hear it.`
          : 'Tap any note to hear it and see where it’s written on the staff.'}
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
          {/* The notes between the naturals have two names; Sharps and Flats show the same frets under each. */}
          <LedButtons
            columns={3}
            options={[
              { value: 'naturals', label: 'Natural notes' },
              { value: 'sharps', label: 'Sharps' },
              { value: 'flats', label: 'Flats' },
            ]}
            selected={[names]}
            onToggle={(v) => {
              setNames(v)
              // A soloed or tapped note stays when only its name changes, but not when it disappears.
              if (v === 'naturals' && highlight !== null && !isNatural(highlight)) setHighlight(null)
              if (v === 'naturals' && selected && !isNatural(midiAt(selected))) setSelected(null)
            }}
          />
          <div>
            <div className="label-text mb-2 text-[11px] text-muted">Solo one note</div>
            <LedButtons
              options={PCS.filter((pc) => names !== 'naturals' || isNatural(pc)).map((pc) => ({ value: pc, label: pcName(pc, spelling) }))}
              selected={highlight === null ? [] : [highlight]}
              onToggle={(pc) => setHighlight(highlight === pc ? null : pc)}
            />
          </div>
        </>
      )}
      {mode === 'scale' && (
        <>
          {unlocked.scales.length > 1 && (
            <LedButtons
              columns={2}
              options={unlocked.scales.map((v) => ({ value: v, label: SCALE_NAMES[v] }))}
              selected={[scale]}
              onToggle={(v) => {
                setScale(v)
                setPattern(0)
                setSelected(null)
              }}
            />
          )}
          <div>
            {/* The minor scales are named by their home notes: the relative minors of the keys learned. */}
            <div className="label-text mb-2 text-[11px] text-muted">{unlocked.scales.length > 1 ? 'Key' : 'Major scale'}</div>
            <LedButtons
              options={unlocked.keys.map((k) => ({ value: k, label: scale === 'minorPent' || scale === 'blues' ? toneName(relativeMinor(k)) : keyLabel(k) }))}
              selected={[key]}
              onToggle={setKey}
            />
          </div>
          {scale === 'minorPent' && unlocked.patterns.length > 0 && (
            <div>
              <div className="label-text mb-2 text-[11px] text-muted">Pattern</div>
              <LedButtons
                columns={unlocked.patterns.length + 1}
                options={[{ value: 0, label: 'All' }, ...unlocked.patterns.map((n) => ({ value: n, label: String(n) }))]}
                selected={[pattern]}
                onToggle={(n) => {
                  setPattern(n)
                  setSelected(null)
                }}
              />
            </div>
          )}
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
