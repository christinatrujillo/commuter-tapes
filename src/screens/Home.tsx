import { useRef, useState, type Ref } from 'react'
import { Cassette, DeckWell } from '../components/Cassette'
import { HeadphonesIcon } from '../components/Monitors'
import { LabelTape, TabShell } from '../components/ui'
import { navigate } from '../lib/router'
import { ALL_LESSONS, findLesson, isListening, isPlanned, tapeBefore, tapeNumber, VOLUMES, type Unit } from '../music/curriculum'
import { currentLessonId, isUnlocked, useProgress } from '../store/progress'

/** Wood grain, for the rack and its shelf rails. */
const WOOD = 'bg-[repeating-linear-gradient(90deg,#4a3222_0px,#4f3625_5px,#432d1f_9px,#553a28_12px,#4a3222_17px)]'
/** Lettering cut into the rails: shaded darker at the top of each letter, its top lip in shadow, its bottom edge catching the light. */
const CARVED = 'bg-clip-text text-transparent [filter:drop-shadow(0_-1px_0_rgba(0,0,0,0.85))_drop-shadow(0_1px_0_rgba(255,226,180,0.22))]'
const CARVED_TITLE = 'bg-[linear-gradient(180deg,#6f5234_0%,#b0905f_45%,#ead0a6_100%)]'
const CARVED_LABEL = 'bg-[linear-gradient(180deg,#5e452b_0%,#94784f_45%,#c9ab80_100%)]'

/** Home: a tape deck holding your next lesson's tape, and a rack of every tape below it, by volume. */
export function HomeScreen() {
  return (
    <TabShell>
      <div className="mx-auto max-w-lg px-4 pt-4 pb-10">
        <RackHome />
      </div>
    </TabShell>
  )
}

function RackHome() {
  const lessons = useProgress((s) => s.lessons)
  const unlockAll = useProgress((s) => s.settings.unlockAll)
  const earTraining = useProgress((s) => s.settings.earTraining)
  const current = currentLessonId(lessons, earTraining)
  const found = current ? findLesson(current) : null
  const doneCount = ALL_LESSONS.filter((l) => lessons[l.id]?.stars).length
  // The tape in the deck: your next lesson's, unless you've picked another off the rack.
  const [picked, setPicked] = useState<Unit | null>(null)
  const loaded = picked ?? found?.unit ?? null
  const deckRef = useRef<HTMLElement>(null)

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
          locked={!isUnlocked(loaded.lessons[0].id, lessons, unlockAll, earTraining)}
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
        <ol className="flex flex-col gap-2.5 rounded-sm bg-[#120e0c] p-1.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.85)]">
          {VOLUMES.map((volume) => (
            <li key={volume.label}>
              <h3 className={`mb-1.5 flex items-baseline gap-2 rounded-[2px] px-2 py-1 shadow-[0_2px_4px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] ${WOOD}`}>
                <span className={`label-text text-[10px] ${CARVED} ${CARVED_LABEL}`}>{volume.label}</span>
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
                        locked={!isUnlocked(t.lessons[0].id, lessons, unlockAll, earTraining)}
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
    </>
  )
}

/** The tape deck: the loaded tape turning in the window, its next lesson on the LCD, and a key to open it. */
function Deck({ ref, unit, isNext, locked }: { ref: Ref<HTMLElement>; unit: Unit; isNext: boolean; locked: boolean }) {
  const lessons = useProgress((s) => s.lessons)
  const tape = tapeNumber(unit)
  const recorded = unit.lessons.filter((l) => lessons[l.id]?.stars).length
  const next = unit.lessons.find((l) => !lessons[l.id]?.stars)
  // What the LCD reads for this tape.
  const [top, middle, bottom] = locked
    ? ['SEALED', unit.title, `FINISH TAPE ${tapeBefore(unit)} FIRST`]
    : !next
      ? ['ALL DONE', unit.title, `TAPE ${tape} · ${recorded} OF ${unit.lessons.length} TRACKS`]
      : [isNext ? 'UP NEXT' : 'NEXT ON THIS TAPE', next.title, `TAPE ${tape} · TRACK ${unit.lessons.indexOf(next) + 1} OF ${unit.lessons.length}`]
  return (
    <section ref={ref} className="panel scroll-mt-4 px-4 pt-6 pb-4">
      {/* The tape in the deck, front and center; a newly loaded tape slides in. The band on it: blinking
          "now playing" for your next lesson's tape, steady "loaded" for one you're browsing. */}
      <DeckWell
        band={
          <>
            <span className={`led !h-2 !w-2 ${isNext ? 'led-red breathe' : 'led-amber'}`} />
            <span className={`label-text text-[10px] ${isNext ? 'text-cream' : 'text-amber'}`}>{isNext ? 'Now playing' : 'Loaded'}</span>
          </>
        }
      >
        <div key={unit.id} className="slide-up">
          <Cassette
            title={unit.title}
            number={tape}
            color={unit.color}
            recorded={recorded}
            total={unit.lessons.length}
            sealed={locked}
            playing={!locked}
            listening={unit.lessons.some(isListening)}
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
        <span className="truncate text-lg leading-tight">{middle}</span>
        <span className="text-[11px] opacity-75">{bottom}</span>
      </div>
      <button onClick={() => navigate(`/tape/${unit.id}`)} className="hw-btn hw-amber mt-4 w-full py-3.5 text-xl">
        ⏏ Load tape
      </button>
    </section>
  )
}

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
  const line = locked ? 'Sealed' : finished ? '✓ Done' : ''
  const listening = unit.lessons.some(isListening)
  return (
    <button
      onClick={onPick}
      aria-pressed={inDeck}
      aria-label={`Tape ${number}: ${unit.title}. ${listening ? 'Needs headphones. ' : ''}${isCurrent ? 'Now playing. ' : ''}${status}`}
      className={`relative flex min-h-[3.75rem] w-full items-center gap-3 overflow-hidden rounded-[3px] border border-black py-2 pr-3 pl-0 text-left transition-transform ${
        inDeck
          ? 'translate-x-3 bg-[linear-gradient(#3a2f28,#2a221d)] shadow-[0_0_18px_rgba(255,181,71,0.3)] ring-1 ring-amber/70'
          : 'bg-[linear-gradient(#2f2723,#211b18)]'
      } ${locked ? 'opacity-55' : ''}`}
    >
      <span className="w-2 self-stretch" style={{ background: locked ? '#5d5148' : unit.color }} />
      <span className="w-6 shrink-0 text-center font-mono text-xs text-muted">{String(number).padStart(2, '0')}</span>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="flex max-w-full items-center gap-1.5">
          <LabelTape className="min-w-0 truncate">{unit.title}</LabelTape>
          {listening && <HeadphonesIcon className="h-3.5 w-3.5 shrink-0 text-cream-dim" />}
        </span>
        {(isCurrent || line) && (
          <span className={`flex items-center gap-1.5 text-[13px] ${finished ? 'text-led' : 'text-cream-dim'}`}>
            {isCurrent && (
              <>
                <span className="led led-red breathe !h-2 !w-2" />
                <span className="text-cream">Now playing{line ? ' ·' : ''}</span>
              </>
            )}
            {line}
          </span>
        )}
      </span>
      {!locked && (
        <span className="flex shrink-0 gap-1" aria-hidden>
          {unit.lessons.map((l, k) => (
            <span key={l.id} className={`led !h-2 !w-2 ${k < done ? 'led-green' : ''}`} />
          ))}
        </span>
      )}
      {/* The case's plastic: a faint sheen and a lit top edge. */}
      <span className="pointer-events-none absolute inset-0 rounded-[3px] bg-[linear-gradient(180deg,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.025)_45%,transparent_46%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" />
      {/* Unopened tapes still have their cellophane. */}
      {locked && <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.08)_45%,transparent_60%)]" />}
    </button>
  )
}

/** A tape that's planned but not recorded yet: a blank, dashed spine. */
function BlankTape({ number, title }: { number: number; title: string }) {
  return (
    <div className="relative flex w-full items-center gap-3 overflow-hidden rounded-[3px] border border-dashed border-[#4a3f38] bg-[#1a1512] py-2 pr-3 pl-0 opacity-60">
      <span className="w-2 self-stretch bg-[#3a2f29]" />
      <span className="w-6 shrink-0 text-center font-mono text-xs text-muted">{String(number).padStart(2, '0')}</span>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <LabelTape className="max-w-full truncate opacity-70">{title}</LabelTape>
        <span className="text-[13px] text-muted">Coming soon</span>
      </span>
    </div>
  )
}
