import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { glossarySegments, type GlossaryEntry } from '../game/glossary'

interface Open {
  entry: GlossaryEntry
  /** Where the tapped word is on screen, to point the card at it. */
  at: DOMRect
}

/**
 * Text with its music words picked out: tap one and a small liner-note card opens beside it with
 * the meaning. `skip` leaves words plain (the card's own topic, which the card explains).
 */
export function GlossaryText({ text, skip = [] }: { text: string; skip?: string[] }) {
  const [open, setOpen] = useState<Open | null>(null)
  return (
    <>
      {glossarySegments(text, skip).map((seg, i) =>
        seg.entry ? (
          <button
            key={i}
            type="button"
            onClick={(e) => setOpen({ entry: seg.entry!, at: e.currentTarget.getBoundingClientRect() })}
            className="inline cursor-help underline decoration-amber-dim decoration-dotted decoration-2 underline-offset-[5px]"
          >
            {seg.text}
          </button>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
      {open && <LinerNote {...open} onClose={() => setOpen(null)} />}
    </>
  )
}

const MARGIN = 12

/** The meaning, on a small rounded card printed like a cassette insert, right by the word. */
function LinerNote({ entry, at, onClose }: Open & { onClose: () => void }) {
  useEffect(() => {
    const close = (e: Event) => (e.type !== 'keydown' || (e as KeyboardEvent).key === 'Escape') && onClose()
    window.addEventListener('keydown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('keydown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [onClose])

  const vw = window.innerWidth
  const width = Math.min(320, vw - MARGIN * 2)
  const center = at.left + at.width / 2
  const left = Math.max(MARGIN, Math.min(vw - width - MARGIN, center - width / 2))
  // Above the word when there's room, otherwise below it.
  const above = at.top > 230

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-label={entry.term}
        onClick={(e) => e.stopPropagation()}
        className="fade-in fixed overflow-hidden rounded-2xl bg-[linear-gradient(#f7f0de,#ede3cb)] text-ink shadow-[0_22px_45px_rgba(0,0,0,0.55),0_3px_8px_rgba(0,0,0,0.35)] ring-1 ring-black/10"
        style={{ left, width, ...(above ? { bottom: window.innerHeight - at.top + 10 } : { top: at.bottom + 10 }) }}
      >
        {/* Printed stripes across the top, like a vintage tape insert. */}
        <div className="h-[4px] bg-amber-dim" />
        <div className="mt-[2px] h-[2px] bg-[#b5473a]/80" />
        <div className="px-5 pt-3 pb-5">
          <div className="flex items-center justify-between">
            <span className="font-typed text-[10px] tracking-[0.25em] text-ink/50 uppercase">Liner note</span>
            <button onClick={onClose} aria-label="Close" className="-mr-1.5 px-1.5 text-lg leading-none text-ink/45 hover:text-ink">
              ×
            </button>
          </div>
          <h3 className="mt-1 font-label text-[17px] tracking-[0.2em] uppercase">{entry.term}</h3>
          <div className="mt-2 h-px bg-ink/15" />
          <p className="mt-2 font-typed text-[14.5px] leading-relaxed text-ink/90">{entry.definition}</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
