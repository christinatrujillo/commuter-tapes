import { Cassette } from '../components/Cassette'
import { LabelTape, TransportIcon } from '../components/ui'
import { navigate } from '../lib/router'
import { findLesson, tapeNumber, UNITS, type Unit } from '../music/curriculum'
import { THEORY_START, useProgress } from '../store/progress'
import { CARVED, CARVED_TITLE, WOOD } from './Home'

/** One tape to start with, in its case on the rack: the cassette itself, what's on it, and a key to play it. */
function Choice({ unit, volume, title, line, onPick }: { unit: Unit; volume: string; title: string; line: string; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      className="relative flex w-full flex-col gap-2 overflow-hidden rounded-[3px] border border-black bg-[linear-gradient(#2f2723,#211b18)] p-2.5 text-left active:translate-y-[1px]"
    >
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <LabelTape>{title}</LabelTape>
        <span className="label-text text-[11px] text-muted">{volume}</span>
      </span>
      <span className="flex items-center gap-3">
        <span className="w-[44%] shrink-0">
          <Cassette title={unit.title} number={tapeNumber(unit)} color={unit.color} recorded={0} total={unit.lessons.length} playing />
        </span>
        <span className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <span className="text-sm leading-snug text-cream-dim">{line}</span>
          <span className="hw-btn hw-amber flex items-center gap-[0.45em] px-3 py-1.5 text-xs">
            <TransportIcon kind="play" />
            Start here
          </span>
        </span>
      </span>
      {/* The case's plastic: a faint sheen and a lit top edge, like the tapes on the rack. */}
      <span className="pointer-events-none absolute inset-0 rounded-[3px] bg-[linear-gradient(180deg,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.025)_45%,transparent_46%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" />
    </button>
  )
}

/** The first-run question, asked in the studio: an empty deck, and two tapes on the rack to start from. */
export function StartScreen() {
  const chooseStart = useProgress((s) => s.chooseStart)
  // Always lands on the deck, wherever the app was when it asked (Settings, after erasing everything).
  const pick = (theoryFirst: boolean) => {
    chooseStart(theoryFirst)
    navigate('/', { replace: true })
  }
  return (
    <div className="h-dvh overflow-y-auto">
      <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* The deck, powered on with nothing in it yet. */}
        <section className="panel px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="led led-red breathe !h-2 !w-2" />
            <span className="label-text text-xs text-cream">Commuter Tapes</span>
          </div>
          <div className="lcd lcd-wide mt-3 flex flex-col px-3 py-2">
            <span className="text-[11px] opacity-75">NO TAPE LOADED</span>
            <h1 className="text-lg leading-tight">Pick your first tape</h1>
            <span className="text-[11px] opacity-75">CHANGE IT ANY TIME IN SETTINGS</span>
          </div>
        </section>

        <div className={`rounded-md p-2.5 shadow-[0_8px_14px_rgba(0,0,0,0.5)] ${WOOD}`}>
          <div className="flex flex-col gap-2 rounded-sm bg-[#120e0c] p-1.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.85)]">
            <h2 className={`rounded-[2px] px-2 py-1 shadow-[0_2px_4px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] ${WOOD}`}>
              <span className={`font-label text-[15px] ${CARVED} ${CARVED_TITLE}`}>Where do you want to start?</span>
            </h2>
            <Choice
              unit={UNITS[0]}
              volume="Vol. 1"
              title="From the beginning"
              line="Reading music and the notes on the neck, then theory."
              onPick={() => pick(false)}
            />
            <Choice
              unit={findLesson(THEORY_START)!.unit}
              volume="Vol. 3"
              title="Straight to theory"
              line="I already read music and know the notes on the neck."
              onPick={() => pick(true)}
            />
          </div>
        </div>

        <p className="paper -rotate-[0.6deg] px-4 py-3 font-typed text-sm leading-relaxed">
          The theory tapes use written music and the notes on the neck, so Vol. 1 and 2 teach those first. Either way, every tape stays on the rack.
        </p>
      </div>
    </div>
  )
}
