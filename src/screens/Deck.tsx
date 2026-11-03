import { Cassette } from '../components/Cassette'
import { Fretboard, type Marker } from '../components/Fretboard'
import { Staff } from '../components/Staff'
import { BackHeader, Button, LabelTape } from '../components/ui'
import { navigate } from '../lib/router'
import { UNITS, type LessonSpec } from '../music/curriculum'
import { mastery } from '../game/questions'
import { allPositions, isNatural, midiAt, pcName, pitchClass, posKey } from '../music/notes'
import { isUnlocked, RATING_NAMES, useProgress, type Rating } from '../store/progress'

/** One tape in the deck: its track list (lessons) and liner notes (tips). */
export function DeckScreen({ unitId }: { unitId: string }) {
  const index = UNITS.findIndex((u) => u.id === unitId)
  const unit = UNITS[index]
  const lessons = useProgress((s) => s.lessons)
  const rehearsed = useProgress((s) => s.rehearsed)
  const stats = useProgress((s) => s.stats)
  const unlockAll = useProgress((s) => s.settings.unlockAll)
  if (!unit) return <BackHeader title="Tape not found" />

  const recorded = unit.lessons.filter((l) => lessons[l.id]?.stars).length
  const next = unit.lessons.find((l) => !lessons[l.id]?.stars)
  const canRecord = next ? isUnlocked(next.id, lessons, unlockAll) : false
  // The first time through, a track starts with its rehearsal.
  const startPath = (id: string) => (rehearsed[id] || lessons[id]?.stars ? `/lesson/${id}` : `/rehearse/${id}`)
  const nextFresh = next ? !rehearsed[next.id] && !lessons[next.id]?.stars : false
  const region = unit.tipRegion
  const spots = region ? allPositions(region).filter((p) => unit.tipAccidentals || isNatural(midiAt(p))) : []
  const fluent = spots.filter((p) => mastery(stats[posKey(p)]) === 'fluent').length
  const markers: Marker[] = region
    ? spots.map((p) => {
          const pc = pitchClass(midiAt(p))
          return { pos: p, tone: isNatural(pc) ? 'note' : 'accidental', label: pcName(pc, 'sharp') }
        })
    : []

  return (
    <div className="flex h-dvh flex-col">
      <BackHeader subtitle={`Tape ${index + 1}`} title={unit.title} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-lg flex-col gap-5 p-4">
          <div className="panel px-6 pt-6 pb-4">
            <div className="mx-auto max-w-[290px]">
              <Cassette title={unit.title} number={index + 1} color={unit.color} recorded={recorded} total={unit.lessons.length} playing />
            </div>
            <p className="mt-3 text-center text-sm text-muted">{unit.description}</p>
            {spots.length > 0 && <FluencyMeter fluent={fluent} total={spots.length} />}
          </div>

          <section className="paper px-4 pt-3 pb-2" aria-label="Tracks">
            <div className="flex items-baseline justify-between border-b-2 border-ink/80 pb-1 font-typed">
              <span className="text-sm">Tracks · Side A</span>
              <span className="text-sm">
                {recorded}/{unit.lessons.length}
              </span>
            </div>
            <ol>
              {unit.lessons.map((lesson, i) => (
                <TrackRow
                  key={lesson.id}
                  number={i + 1}
                  lesson={lesson}
                  rating={(lessons[lesson.id]?.stars as Rating | undefined) ?? null}
                  unlocked={isUnlocked(lesson.id, lessons, unlockAll)}
                  rehearsed={!!rehearsed[lesson.id]}
                  startPath={startPath(lesson.id)}
                />
              ))}
            </ol>
          </section>

          <section className="paper paper-lined px-4 pt-2 pb-3" aria-label="Liner notes">
            <h2 className="font-typed text-sm leading-[28px] underline underline-offset-4">Liner notes</h2>
            <ul className="font-typed text-[16px] leading-[28px]">
              {unit.tips.map((tip) => (
                <li key={tip}>– {tip}</li>
              ))}
            </ul>
          </section>

          {unit.tipStaff && (
            <div className="paper h-40 p-2">
              <Staff keys={unit.tipStaff.keys} labels={unit.tipStaff.labels} />
            </div>
          )}
          {region && (
            <div className="panel p-3">
              <Fretboard minFret={region.minFret} maxFret={region.maxFret} activeStrings={region.strings} markers={markers} fit="width" />
            </div>
          )}
        </div>
      </main>
      <div className="border-t border-edge bg-tolex p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {next ? (
          <Button variant="rec" disabled={!canRecord} onClick={() => navigate(startPath(next.id))}>
            {!canRecord ? 'Sealed: finish the tape before this one' : nextFresh ? `● Rehearse & record: ${next.title}` : `● Record: ${next.title}`}
          </Button>
        ) : (
          <p className="label-text py-2 text-center text-sm text-amber">All tracks recorded</p>
        )}
      </div>
    </div>
  )
}

/** A 10-segment LED bar: how many of this tape's spots you know fast and cold. */
function FluencyMeter({ fluent, total }: { fluent: number; total: number }) {
  const lit = Math.round((fluent / total) * 10)
  return (
    <div className="mt-3 flex items-center justify-center gap-2" aria-label={`${fluent} of ${total} spots fluent`}>
      <span className="label-text text-[10px] text-muted">Fluent</span>
      <span className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`h-2.5 w-1.5 rounded-[1px] ${i < lit ? 'bg-led shadow-[0_0_4px_var(--color-led)]' : 'bg-[#3a2f29]'}`} />
        ))}
      </span>
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
      <span className="w-5 font-typed text-sm text-ink/60">{number}</span>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <LabelTape className={unlocked ? '' : 'opacity-40'}>{lesson.title}</LabelTape>
        {rating && (
          <span className="label-text -rotate-2 rounded border border-[#b5473a] px-1.5 text-[10px] whitespace-nowrap text-[#b5473a]">
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
            {rating ? '↺ Redo' : '● Rec'}
          </button>
        </span>
      ) : (
        <span className="label-text text-[10px] text-ink/40">Locked</span>
      )}
    </li>
  )
}
