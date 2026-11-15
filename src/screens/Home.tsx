import { useEffect, useLayoutEffect, useRef, useState, type Ref } from 'react'
import { Cassette, DeckWell } from '../components/Cassette'
import { HeadphonesIcon } from '../components/Monitors'
import { LabelTape, TabShell, TransportIcon } from '../components/ui'
import { goBack, navigate } from '../lib/router'
import { ALL_LESSONS, findLesson, isListening, isPlanned, tapeBefore, tapeNumber, UNITS, VOLUMES, type Unit } from '../music/curriculum'
import { currentLessonId, isUnlocked, earTracksWaiting, trackPath, useProgress } from '../store/progress'
import { TapeInsert } from './TapeInsert'

/** Wood grain, for the rack and its shelf rails. */
export const WOOD = 'bg-[repeating-linear-gradient(90deg,#4a3222_0px,#4f3625_5px,#432d1f_9px,#553a28_12px,#4a3222_17px)]'
/** Lettering cut into the rails: shaded darker at the top of each letter, its top lip in shadow, its bottom edge catching the light. */
export const CARVED = 'bg-clip-text text-transparent [filter:drop-shadow(0_-1px_0_rgba(0,0,0,0.85))_drop-shadow(0_1px_0_rgba(255,226,180,0.22))]'
export const CARVED_TITLE = 'bg-[linear-gradient(180deg,#6f5234_0%,#b0905f_45%,#ead0a6_100%)]'
const CARVED_LABEL = 'bg-[linear-gradient(180deg,#5e452b_0%,#94784f_45%,#c9ab80_100%)]'

/**
 * Home: a tape deck holding your next lesson's tape, and a rack of every tape below it, by volume.
 * With `tapeId` (the address /tape/<id>), that tape is in the deck with its paper insert pulled out.
 */
export function HomeScreen({ tapeId }: { tapeId?: string }) {
  return (
    <TabShell locked={!!tapeId}>
      <div className="mx-auto max-w-lg px-4 pt-4 pb-10">
        <RackHome tapeId={tapeId} />
      </div>
    </TabShell>
  )
}

function RackHome({ tapeId }: { tapeId?: string }) {
  const lessons = useProgress((s) => s.lessons)
  const unlockAll = useProgress((s) => s.settings.unlockAll)
  const earTraining = useProgress((s) => s.settings.earTraining)
  // With listening off or paused, the next track is the first one that doesn't need sound.
  const listening = useProgress((s) => !earTracksWaiting(s))
  const theoryFirst = useProgress((s) => s.settings.theoryFirst)
  const current = currentLessonId(lessons, listening, theoryFirst)
  const found = current ? findLesson(current) : null
  const doneCount = ALL_LESSONS.filter((l) => lessons[l.id]?.stars).length
  // The tape in the deck: your next lesson's, unless you've picked another off the rack.
  const [picked, setPicked] = useState<Unit | null>(null)
  // The tape whose insert is out, if any. Its insert stays a moment after closing, to slide back in.
  const opened = UNITS.find((u) => u.id === tapeId) ?? null
  const [lastOpened, setLastOpened] = useState(opened)
  // Opening on a tape with its insert already out (back from a take, or a reload) shows it in place.
  const [slideIn, setSlideIn] = useState(!opened)
  const [insertTop, setInsertTop] = useState(0)
  const loaded = opened ?? picked ?? found?.unit ?? null
  const deckRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (opened) {
      setLastOpened(opened)
      // The tape stays in the deck once its insert goes back in.
      setPicked(opened === found?.unit ? null : opened)
      return
    }
    setSlideIn(true)
    const gone = setTimeout(() => setLastOpened(null), 280)
    return () => clearTimeout(gone)
    // Only opening and closing the insert matters here.
  }, [opened])

  // The insert comes out from under the cassette: bring the deck to the top and measure where the cassette ends.
  useLayoutEffect(() => {
    if (!opened) return
    const measure = () => {
      const well = deckRef.current?.querySelector('[data-deck-well]')
      // On a short screen (a phone on its side) it covers part of the cassette, to keep at least half the screen for itself.
      if (well) setInsertTop(Math.min(well.getBoundingClientRect().bottom, window.innerHeight * 0.45))
    }
    deckRef.current?.scrollIntoView({ block: 'start' })
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [opened])
  const insert = opened ?? lastOpened

  function pick(unit: Unit) {
    setPicked(unit === found?.unit ? null : unit)
    deckRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      {loaded ? (
        <Deck
          ref={deckRef}
          unit={loaded}
          isNext={loaded === found?.unit}
          locked={!isUnlocked(loaded.lessons[0].id, lessons, unlockAll, earTraining, theoryFirst)}
        />
      ) : (
        <p className="panel p-5 text-cream">Every tape is recorded. Keep it fresh in Jam.</p>
      )}

      <div className="mt-7 mb-2 flex items-baseline justify-between">
        <h2 className="label-text text-xs text-cream-dim">Tape rack</h2>
        <span className="font-mono text-xs text-muted">
          {doneCount}/{ALL_LESSONS.length} tracks
        </span>
      </div>
      {/* A wooden rack holding the tapes spine-out, a shelf per volume under a rail with its name: a list you can scan at a glance. */}
      <div className={`rounded-md p-2.5 shadow-[0_8px_14px_rgba(0,0,0,0.5)] ${WOOD}`}>
        <ol className="flex flex-col gap-2.5 rounded-sm bg-well p-1.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.85)]">
          {VOLUMES.map((volume) => (
            <li key={volume.label}>
              <h3 className={`mb-1.5 flex items-baseline gap-2 rounded-[2px] px-2 py-1 shadow-[0_2px_4px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] ${WOOD}`}>
                <span className={`label-text text-[11px] ${CARVED} ${CARVED_LABEL}`}>{volume.label}</span>
                <span className={`font-label text-[15px] ${CARVED} ${CARVED_TITLE}`}>{volume.title}</span>
              </h3>
              <ol className="flex flex-col gap-1">
                {volume.tapes.map((t) =>
                  isPlanned(t) ? (
                    <li key={t.title}>
                      <BlankTape title={t.title} number={tapeNumber(t)} />
                    </li>
                  ) : (
                    <li key={t.id}>
                      <Spine
                        unit={t}
                        done={t.lessons.filter((l) => lessons[l.id]?.stars).length}
                        isCurrent={t === found?.unit}
                        inDeck={t === loaded}
                        locked={!isUnlocked(t.lessons[0].id, lessons, unlockAll, earTraining, theoryFirst)}
                        onPick={() => pick(t)}
                      />
                    </li>
                  ),
                )}
              </ol>
            </li>
          ))}
        </ol>
      </div>
      {insert && <TapeInsert unit={insert} top={insertTop} motion={opened ? (slideIn ? 'in' : null) : 'out'} onClose={() => goBack('/')} />}
    </>
  )
}

/** The tape deck: the loaded tape turning in the window, its next lesson on the LCD, and a key to open it. */
function Deck({ ref, unit, isNext, locked }: { ref: Ref<HTMLElement>; unit: Unit; isNext: boolean; locked: boolean }) {
  const lessons = useProgress((s) => s.lessons)
  const rehearsed = useProgress((s) => s.rehearsed)
  const unlockAll = useProgress((s) => s.settings.unlockAll)
  const earTraining = useProgress((s) => s.settings.earTraining)
  const theoryFirst = useProgress((s) => s.settings.theoryFirst)
  const tape = tapeNumber(unit)
  const recorded = unit.lessons.filter((l) => lessons[l.id]?.stars).length
  // The tape in the well trails the one picked: the old tape lifts out, then the new one drops in.
  const [shown, setShown] = useState(unit)
  const [change, setChange] = useState<'out' | 'in' | null>(null)
  useEffect(() => {
    if (unit === shown) return setChange(null)
    setChange('out')
    const swap = setTimeout(() => {
      setShown(unit)
      setChange('in')
    }, 210)
    const settle = setTimeout(() => setChange(null), 630)
    return () => {
      clearTimeout(swap)
      clearTimeout(settle)
    }
    // Only a new pick starts a change; `shown` catching up must not cancel it.
  }, [unit])
  const shownSealed = !isUnlocked(shown.lessons[0].id, lessons, unlockAll, earTraining, theoryFirst)
  const next = unit.lessons.find((l) => !lessons[l.id]?.stars)
  const playable = next && isUnlocked(next.id, lessons, unlockAll, earTraining, theoryFirst) ? next : null
  // What the LCD reads for this tape.
  const [top, middle, bottom] = locked
    ? ['SEALED', unit.title, `FINISH TAPE ${tapeBefore(unit)} FIRST`]
    : !next
      ? ['ALL DONE', unit.title, `TAPE ${tape} · ${recorded} OF ${unit.lessons.length} TRACKS`]
      : [isNext ? 'UP NEXT' : 'NEXT ON THIS TAPE', next.title, `TAPE ${tape} · TRACK ${unit.lessons.indexOf(next) + 1} OF ${unit.lessons.length}`]
  return (
    <section ref={ref} className="panel scroll-mt-4 px-4 pt-6 pb-4">
      {/* The tape in the deck, front and center; a newly loaded tape drops in. The band on it: blinking
          "now playing" for your next lesson's tape, steady "loaded" for one you're browsing. */}
      <DeckWell
        open={change !== null}
        band={
          <>
            <span className={`led !h-2 !w-2 ${isNext ? 'led-red breathe' : 'led-amber'}`} />
            <span className={`label-text text-[11px] ${isNext ? 'text-cream' : 'text-amber'}`}>{isNext ? 'Now playing' : 'Loaded'}</span>
          </>
        }
      >
        <div className={change ? `tape-${change}` : ''}>
          <Cassette
            title={shown.title}
            number={tapeNumber(shown)}
            color={shown.color}
            recorded={shown.lessons.filter((l) => lessons[l.id]?.stars).length}
            total={shown.lessons.length}
            sealed={shownSealed}
            playing={!shownSealed && !change}
            listening={shown.lessons.some(isListening)}
          />
        </div>
      </DeckWell>
      <div className="lcd lcd-wide mt-4 flex flex-col px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] opacity-75">{top}</span>
          {/* A little level meter: bouncing while your next lesson's tape is playing, still and dim otherwise. */}
          <span className="flex h-3 items-end gap-[2px]" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`level-bar ${isNext ? '' : 'idle'}`} />
            ))}
          </span>
        </div>
        <span className="text-lg leading-tight text-balance">{middle}</span>
        <span className="text-[11px] opacity-75">{bottom}</span>
      </div>
      {/* The main key says what it does: it starts the next track. Load tape (the track list and liner notes) sits under it. */}
      {playable && (
        <button onClick={() => navigate(trackPath(playable.id, { rehearsed, lessons }))} data-guide="play-next" className="hw-btn hw-amber mt-4 flex w-full items-center justify-center gap-[0.45em] py-3.5 text-xl">
          <TransportIcon kind="play" />
          Play next track
        </button>
      )}
      <button
        onClick={() => navigate(`/tape/${unit.id}`)}
        data-guide="load-tape"
        className={`hw-btn flex w-full items-center justify-center gap-[0.45em] ${playable ? 'hw-dark mt-2.5 py-2.5 text-sm' : 'hw-amber mt-4 py-3.5 text-xl'}`}
      >
        <TransportIcon kind="eject" />
        Load tape
      </button>
    </section>
  )
}

/** How many lamps each tape had lit the last time the rack was on screen, so newly recorded tracks can light up. */
const lampsSeen = new Map<string, number>()
/** Whether each tape was sealed the last time the rack was on screen, so a newly opened one can shed its cellophane. */
const sealSeen = new Map<string, boolean>()

/** One tape in the rack, spine out: color stripe, label-tape title, a lamp per lesson, and where you stand. */
function Spine({
  unit,
  done,
  isCurrent,
  inDeck,
  locked,
  onPick,
}: {
  unit: Unit
  done: number
  isCurrent: boolean
  inDeck: boolean
  locked: boolean
  onPick: () => void
}) {
  const number = tapeNumber(unit)
  const total = unit.lessons.length
  const finished = done >= total && !locked
  const status = locked ? `Locked · finish tape ${tapeBefore(unit)} first` : finished ? 'Done' : `${done} of ${total} tracks`
  // The lights show how many tracks are recorded, so this line only says what they can't. Why a tape is sealed shows on the deck.
  const line = locked ? 'Sealed' : finished ? 'Done' : ''
  const listening = unit.lessons.some(isListening)
  const litBefore = lampsSeen.get(unit.id) ?? done
  useEffect(() => void lampsSeen.set(unit.id, done), [unit.id, done])
  const unwrapping = (sealSeen.get(unit.id) ?? locked) && !locked
  useEffect(() => void sealSeen.set(unit.id, locked), [unit.id, locked])
  return (
    <button
      onClick={onPick}
      aria-pressed={inDeck}
      aria-label={`Tape ${number}: ${unit.title}. ${listening ? 'Needs headphones. ' : ''}${isCurrent ? 'Now playing. ' : ''}${status}`}
      className={`relative flex min-h-[3.75rem] w-full items-center gap-3 overflow-hidden rounded-[3px] border border-black py-2 pr-3 pl-0 text-left transition-transform ${
        inDeck
          ? 'translate-x-3 bg-[linear-gradient(#3a2f28,#2a221d)] shadow-[0_0_18px_rgba(255,181,71,0.3)] ring-1 ring-amber/70'
          : 'bg-[linear-gradient(#2f2723,#211b18)]'
      } ${locked ? 'opacity-55' : ''} ${unwrapping ? 'tape-unwrap' : ''}`}
    >
      <span className="w-2 self-stretch" style={{ background: locked ? 'var(--color-screw)' : unit.color }} />
      <span className="w-6 shrink-0 text-center font-mono text-xs text-muted">{String(number).padStart(2, '0')}</span>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="flex max-w-full items-center gap-1.5">
          <LabelTape className="min-w-0 truncate">{unit.title}</LabelTape>
          {listening && <HeadphonesIcon className="h-3.5 w-3.5 shrink-0 text-cream-dim" />}
        </span>
        {/* The row under the name: where you stand on the left, a lamp per track on the right. The name gets the whole row above. */}
        {(isCurrent || line || !locked) && (
          <span className="flex w-full items-center justify-between gap-2">
            <span className={`flex items-center gap-1.5 text-[13px] ${finished ? 'text-led' : 'text-cream-dim'}`}>
              {isCurrent && (
                <>
                  <span className="led led-red breathe !h-2 !w-2" />
                  <span className="text-cream">Now playing{line ? ' ·' : ''}</span>
                </>
              )}
              {finished && <TransportIcon kind="check" />}
              {line}
            </span>
            {!locked && (
              <span className={`flex shrink-0 gap-1 ${unwrapping ? 'unwrap-lamps' : ''}`} aria-hidden>
                {unit.lessons.map((l, k) => (
                  <span key={l.id} className={`led !h-2 !w-2 ${k < done ? 'led-green' : ''} ${k >= litBefore && k < done ? 'lamp-on' : ''}`} />
                ))}
              </span>
            )}
          </span>
        )}
      </span>
      {/* The case's plastic: a faint sheen and a lit top edge. */}
      <span className="pointer-events-none absolute inset-0 rounded-[3px] bg-[linear-gradient(180deg,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.025)_45%,transparent_46%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" />
      {/* Unopened tapes still have their cellophane. When a tape opens, its shine sweeps off once. */}
      {(locked || unwrapping) && (
        <span className={`pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.08)_45%,transparent_60%)] ${unwrapping ? 'unwrap-shine' : ''}`} />
      )}
    </button>
  )
}

/** A tape that's planned but not recorded yet: a blank, dashed spine. */
function BlankTape({ number, title }: { number: number; title: string }) {
  return (
    <div className="relative flex w-full items-center gap-3 overflow-hidden rounded-[3px] border border-dashed border-[#4a3f38] bg-[#1a1512] py-2 pr-3 pl-0 opacity-60">
      <span className="w-2 self-stretch bg-led-off" />
      <span className="w-6 shrink-0 text-center font-mono text-xs text-muted">{String(number).padStart(2, '0')}</span>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <LabelTape className="max-w-full truncate opacity-70">{title}</LabelTape>
        <span className="text-[13px] text-muted">Coming soon</span>
      </span>
    </div>
  )
}
