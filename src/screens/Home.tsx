import { useRef, useState, type Ref } from 'react'
import { Cassette } from '../components/Cassette'
import { LabelTape, TabShell } from '../components/ui'
import { navigate } from '../lib/router'
import { ALL_LESSONS, findLesson, isPlanned, tapeBefore, tapeNumber, VOLUMES, type Unit } from '../music/curriculum'
import { currentLessonId, isUnlocked, useProgress } from '../store/progress'

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
      {/* A wooden rack holding the tapes spine-out, a labeled section per volume: a list you can scan at a glance. */}
      <div className="rounded-md border-x-[10px] border-y-[6px] border-[#4a3222] bg-[#120e0c] p-1.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),0_8px_14px_rgba(0,0,0,0.5)]">
        <ol className="flex flex-col gap-3">
          {VOLUMES.map((volume) => (
            <li key={volume.label}>
              <h3 className="mb-1 flex items-baseline gap-2 border-b border-edge px-1 pb-1">
                <span className="label-text text-[11px] text-amber">{volume.label}</span>
                <span className="font-label text-[15px] text-cream">{volume.title}</span>
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
      {/* The tape window, front and center; a newly loaded tape slides in. */}
      <div className="relative w-full overflow-hidden rounded-lg bg-[#0d0a08] p-3 shadow-[inset_0_2px_8px_rgba(0,0,0,0.9)]">
        {/* A band on the tape: blinking "now playing" for your next lesson's tape, steady "loaded" for one you're browsing. */}
        <div className="absolute top-1 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded border border-edge bg-room px-2 py-0.5 whitespace-nowrap">
          <span className={`led !h-2 !w-2 ${isNext ? 'led-red breathe' : 'led-amber'}`} />
          <span className={`label-text text-[10px] ${isNext ? 'text-cream' : 'text-amber'}`}>{isNext ? 'Now playing' : 'Loaded'}</span>
        </div>
        <div key={unit.id} className="slide-up">
          <Cassette title={unit.title} number={tape} color={unit.color} recorded={recorded} total={unit.lessons.length} sealed={locked} playing={!locked} />
        </div>
      </div>
      <div className="lcd mt-4 flex flex-col px-3 py-2">
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
  const status = locked ? `Locked · finish tape ${tapeBefore(unit)} first` : done >= total ? 'Done' : `${done} of ${total} tracks`
  return (
    <button
      onClick={onPick}
      aria-pressed={inDeck}
      aria-label={`Tape ${number}: ${unit.title}. ${isCurrent ? 'Now playing. ' : ''}${status}`}
      className={`relative flex w-full items-center gap-3 overflow-hidden rounded-[3px] border border-black py-2 pr-3 pl-0 text-left transition-transform ${
        inDeck
          ? 'translate-x-3 bg-[linear-gradient(#3a2f28,#2a221d)] shadow-[0_0_18px_rgba(255,181,71,0.3)] ring-1 ring-amber/70'
          : 'bg-[linear-gradient(#2f2723,#211b18)]'
      } ${locked ? 'opacity-55' : ''}`}
    >
      <span className="w-2 self-stretch" style={{ background: locked ? '#5d5148' : unit.color }} />
      <span className="w-6 shrink-0 text-center font-mono text-xs text-muted">{String(number).padStart(2, '0')}</span>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <LabelTape className="max-w-full truncate">{unit.title}</LabelTape>
        <span className={`flex items-center gap-1.5 text-[13px] ${isCurrent ? 'text-amber' : done >= total && !locked ? 'text-led' : 'text-cream-dim'}`}>
          {isCurrent && (
            <>
              <span className="led led-red breathe !h-2 !w-2" />
              <span className="text-cream">Now playing ·</span>
            </>
          )}
          {done >= total && !locked ? '✓ ' : ''}
          {status}
        </span>
      </span>
      {!locked && (
        <span className="flex shrink-0 gap-1" aria-hidden>
          {unit.lessons.map((l, k) => (
            <span key={l.id} className={`led !h-2 !w-2 ${k < done ? 'led-green' : ''}`} />
          ))}
        </span>
      )}
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
