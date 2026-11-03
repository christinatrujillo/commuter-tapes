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

const PCS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

/** A reference fretboard: every note labeled, tap one to hear it and see it on the staff. */
export function ExploreScreen() {
  const landscape = useLandscape()
  const [showSharps, setShowSharps] = useState(false)
  const [highlight, setHighlight] = useState<number | null>(null)
  const [selected, setSelected] = useState<Position | null>(null)

  const markers: Marker[] = allPositions(FULL_NECK)
    .filter((p) => {
      const pc = pitchClass(midiAt(p))
      return highlight === null ? showSharps || isNatural(pc) : pc === highlight
    })
    .map((p) => {
      const pc = pitchClass(midiAt(p))
      const tone = selected && samePos(p, selected) ? 'target' : highlight !== null ? 'correct' : isNatural(pc) ? 'note' : 'accidental'
      return { pos: p, tone, label: pcName(pc, 'sharp') }
    })

  const tap = (p: Position) => {
    setSelected(p)
    playNotes(midiAt(p))
  }

  const written = selected ? spellMidi(midiAt(selected) + WRITTEN_OCTAVE_SHIFT, 'sharp') : null

  const controls = (
    <div className="flex flex-col gap-3">
      <h1 className="label-text text-sm text-muted">Fretboard reference</h1>
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
      <div className="panel flex min-h-[120px] items-center gap-3 p-3">
        {selected && written ? (
          <>
            <div className="paper h-24 w-32 shrink-0 px-1">
              <Staff keys={[vexKey(written)]} />
            </div>
            <div className="min-w-0">
              <div className="font-label text-3xl leading-none text-amber">{pcName(pitchClass(midiAt(selected)))}</div>
              <div className="mt-1 text-cream">{describePosition(selected)}</div>
              <div className="text-sm text-muted">
                Written {spelledName(written, true)}, {staffPlace(written)}
              </div>
            </div>
          </>
        ) : (
          <p className="px-2 text-muted">Tap any fret to hear it and see where it’s written on the staff.</p>
        )}
      </div>
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
