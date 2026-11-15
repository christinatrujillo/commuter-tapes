import { useRef, useState, type PointerEvent } from 'react'
import { GlossaryText } from '../components/GlossaryText'
import { HeadphonesIcon, MonitorsSwitch } from '../components/Monitors'
import { Fretboard, type Marker } from '../components/Fretboard'
import { Staff } from '../components/Staff'
import { LabelTape, LedBar, TransportIcon } from '../components/ui'
import { navigate } from '../lib/router'
import { isListening, tapeBefore, tapeNumber, type LessonSpec, type Unit } from '../music/curriculum'
import { mastery } from '../game/questions'
import { allPositions, isNatural, midiAt, pcName, pitchClass, posKey } from '../music/notes'
import { isUnlocked, RATING_NAMES, trackPath, useProgress, type Rating } from '../store/progress'

/** A fold in the insert's card, between its panels. */
const FOLD = 'border-t border-dashed border-ink/35'

/**
 * A tape's paper insert, slid up out of its case from under the cassette in the deck: the track list,
 * the liner notes and the pictures, with Play at the bottom. `top` is where the cassette ends;
 * `motion` slides it up ('in') or back down ('out'), or neither when it was already out. Its top edge
 * can be dragged (or its grip tapped) up to fill the screen, and down to shrink it or put it back.
 */
export function TapeInsert({ unit, top, motion, onClose }: { unit: Unit; top: number; motion: 'in' | 'out' | null; onClose: () => void }) {
  const lessons = useProgress((s) => s.lessons)
  const rehearsed = useProgress((s) => s.rehearsed)
  const stats = useProgress((s) => s.stats)
  const unlockAll = useProgress((s) => s.settings.unlockAll)
  const earTraining = useProgress((s) => s.settings.earTraining)
  const theoryFirst = useProgress((s) => s.settings.theoryFirst)

  const tape = tapeNumber(unit)
  const next = unit.lessons.find((l) => !lessons[l.id]?.stars)
  const canRecord = next ? isUnlocked(next.id, lessons, unlockAll, earTraining, theoryFirst) : false
  // The first time through, a track starts with its rehearsal.
  const startPath = (id: string) => trackPath(id, { rehearsed, lessons })
  const region = unit.tipRegion
  const spots = region ? allPositions(region).filter((p) => unit.tipAccidentals || isNatural(midiAt(p))) : []
  const fluent = spots.filter((p) => mastery(stats[posKey(p)]) === 'fluent').length
  const markers: Marker[] = region
    ? spots.map((p) => {
          const pc = pitchClass(midiAt(p))
          return { pos: p, tone: isNatural(pc) ? 'note' : 'accidental', label: pcName(pc, 'sharp') }
        })
    : []

  const [full, setFull] = useState(false)
  // How far the top edge has been dragged, while a finger is on it.
  const [drag, setDrag] = useState<number | null>(null)
  // The top glides between its places, but not before it first moves: on opening it's measured into place.
  const [glide, setGlide] = useState(false)
  const grab = useRef<{ y: number; moved: boolean } | null>(null)
  // A drag that starts on the grip mustn't also count as a tap on it.
  const dragged = useRef(false)
  const restTop = full ? 0 : top
  const shownTop = drag === null ? restTop : Math.max(0, restTop + drag)
  const settle = () => {
    grab.current = null
    setGlide(true)
    setDrag(null)
  }
  const dragArea = {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if ((e.target as Element).closest('[data-no-drag]')) return
      grab.current = { y: e.clientY, moved: false }
      dragged.current = false
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const g = grab.current
      if (!g) return
      const dy = e.clientY - g.y
      // A few pixels of wobble is still a tap.
      if (!g.moved && Math.abs(dy) < 6) return
      if (!g.moved) {
        g.moved = dragged.current = true
        e.currentTarget.setPointerCapture?.(e.pointerId)
      }
      setDrag(dy)
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      const g = grab.current
      if (!g?.moved) return void (grab.current = null)
      const dy = e.clientY - g.y
      settle()
      // Up a little fills the screen; down a fair way shrinks it, or from its resting place puts it back.
      if (dy < -50) setFull(true)
      else if (dy > 80) {
        if (full) setFull(false)
        else onClose()
      }
    },
    onPointerCancel: settle,
  }

  return (
    <>
      {/* Everything below the cassette dims; tapping it puts the insert back. */}
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-x-0 bottom-0 z-30 bg-black/60 ${motion === 'out' ? 'insert-dim-out pointer-events-none' : motion === 'in' ? 'insert-dim' : ''}`}
        style={{ top: shownTop }}
      />
      <div
        className={`fixed inset-x-2 bottom-0 z-30 mx-auto flex max-w-lg flex-col overflow-hidden rounded-t-md ${glide && drag === null ? 'insert-glide' : ''} bg-[linear-gradient(var(--color-paper),var(--color-paper-shade))] text-ink shadow-[0_-10px_24px_rgba(0,0,0,0.6)] ${
          motion === 'out' ? 'insert-down pointer-events-none' : motion === 'in' ? 'insert-up' : ''
        }`}
        style={{ top: shownTop, paddingTop: full ? 'env(safe-area-inset-top)' : undefined }}
      >
        {/* The top edge, grip and header are what you drag. */}
        <div {...dragArea} className="shrink-0 touch-none select-none">
          <div className="h-1.5" style={{ background: unit.color }} />
          <button
            aria-label={full ? 'Shrink the insert' : 'Fill the screen'}
            aria-expanded={full}
            onClick={() => {
              if (dragged.current) return
              setGlide(true)
              setFull(!full)
            }}
            className="flex h-5 w-full items-center justify-center"
          >
            <span className="h-1 w-10 rounded-full bg-ink/30" />
          </button>
          {/* Kept short, so the paper's room goes to reading; a long name wraps rather than being cut off. */}
          <header className="flex items-center gap-3 border-b border-ink/20 px-4 pb-2">
            <div className="min-w-0 flex-1">
              <h1 className="label-text text-[15px] leading-tight">
                <span className="text-ink/60">Tape {tape} · </span>
                {unit.title}
              </h1>
              <p className="font-typed text-[13px] text-ink/70">{unit.description}</p>
            </div>
            <button data-no-drag onClick={onClose} className="hw-btn hw-dark shrink-0 px-2.5 py-1 text-xs">
              Close
            </button>
          </header>
        </div>

        {/* Tracks, liner notes and pictures: the panels of one folded card, read by scrolling the paper. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* Ear-training tapes need sound: the switch for it sits right here. */}
          {unit.lessons.some(isListening) && (
            <div className="px-4 pt-3">
              <MonitorsSwitch />
            </div>
          )}

          <section className="px-4 pt-3 pb-2" aria-label="Tracks">
            <div className="flex items-baseline justify-between border-b-2 border-ink/80 pb-1 font-typed">
              <span className="text-sm">Tracks · Side A</span>
            </div>
            <ol>
              {unit.lessons.map((lesson, i) => (
                <TrackRow
                  key={lesson.id}
                  number={i + 1}
                  lesson={lesson}
                  rating={(lessons[lesson.id]?.stars as Rating | undefined) ?? null}
                  unlocked={isUnlocked(lesson.id, lessons, unlockAll, earTraining, theoryFirst)}
                  rehearsed={!!rehearsed[lesson.id]}
                  startPath={startPath(lesson.id)}
                />
              ))}
            </ol>
          </section>

          <section className={`${FOLD} paper-lined px-4 pt-2 pb-3`} aria-label="Liner notes">
            <h2 className="font-typed text-sm leading-[28px] underline underline-offset-4">Liner notes</h2>
            <ul className="font-typed text-[16px] leading-[28px]">
              {unit.tips.map((tip) => (
                <li key={tip}>
                  – <GlossaryText text={tip} />
                </li>
              ))}
            </ul>
          </section>

          {/* Pictures stay phone-sized on any screen, with the neck always drawn upright like a chord chart. */}
          {(unit.tipStaff || region) && (
            <div className={`${FOLD} flex flex-col items-center gap-3 px-4 py-3`}>
              {unit.tipStaff && (
                <div className="h-36 w-full max-w-xs">
                  <Staff keys={unit.tipStaff.keys} labels={unit.tipStaff.labels} />
                </div>
              )}
              {region && (
                <div className="w-full max-w-[16rem] rounded-md bg-tolex p-2 shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
                  <Fretboard minFret={region.minFret} maxFret={region.maxFret} activeStrings={region.strings} markers={markers} orientation="vertical" fit="width" />
                  {spots.length > 0 && <FluencyMeter fluent={fluent} total={spots.length} />}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-ink/20 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {next ? (
            <button
              disabled={!canRecord}
              className="hw-btn hw-amber flex w-full items-center justify-center gap-[0.45em] py-2.5 text-base"
              onClick={() => navigate(startPath(next.id))}
              data-guide="play"
            >
              {canRecord ? (
                <>
                  <TransportIcon kind="play" />
                  Play
                </>
              ) : (
                `Sealed: finish tape ${tapeBefore(unit)} first`
              )}
            </button>
          ) : (
            <p className="label-text py-2 text-center text-sm text-ink/80">All tracks recorded</p>
          )}
        </div>
      </div>
    </>
  )
}

/** A 10-segment LED bar under the neck: how many of its spots you know fast and cold. */
function FluencyMeter({ fluent, total }: { fluent: number; total: number }) {
  return (
    <div className="mt-2 flex items-center justify-center gap-2" aria-label={`${fluent} of ${total} spots fluent`}>
      <span className="label-text text-[11px] text-muted">Fluent</span>
      <LedBar value={fluent} total={total} />
      <span className="font-mono text-xs text-cream">
        {fluent}/{total}
      </span>
    </div>
  )
}

function TrackRow({
  number,
  lesson,
  rating,
  unlocked,
  rehearsed,
  startPath,
}: {
  number: number
  lesson: LessonSpec
  rating: Rating | null
  unlocked: boolean
  rehearsed: boolean
  startPath: string
}) {
  return (
    <li className="flex items-center gap-3 border-b border-ink/15 py-2.5 last:border-b-0">
      <span className="w-5 font-typed text-sm text-ink/80">{number}</span>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="flex items-center gap-1.5">
          <LabelTape className={unlocked ? '' : 'opacity-40'}>{lesson.title}</LabelTape>
          {isListening(lesson) && (
            <>
              <HeadphonesIcon className="h-3.5 w-3.5 shrink-0 text-ink/80" />
              <span className="sr-only">Needs headphones</span>
            </>
          )}
        </span>
        {rating && (
          <span className="label-text -rotate-2 rounded border border-stamp px-1.5 text-[11px] whitespace-nowrap text-stamp">
            {RATING_NAMES[rating]}
          </span>
        )}
      </span>
      {unlocked ? (
        <span className="flex shrink-0 gap-1.5">
          {(rehearsed || rating) && (
            <button
              onClick={() => navigate(`/rehearse/${lesson.id}`)}
              className="hw-btn hw-dark px-2 py-1 text-xs"
              aria-label={`Rehearse ${lesson.title}`}
            >
              Rehearse
            </button>
          )}
          <button
            onClick={() => navigate(startPath)}
            className="hw-btn hw-rec px-2.5 py-1 text-xs"
            aria-label={`${rating ? 'Re-record' : 'Record'} ${lesson.title}`}
          >
            {rating ? <><TransportIcon kind="redo" /> Redo</> : <><TransportIcon kind="rec" /> Rec</>}
          </button>
        </span>
      ) : (
        <span className="label-text text-[11px] text-ink/65">Locked</span>
      )}
    </li>
  )
}
