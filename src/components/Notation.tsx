import { useEffect, useRef, type MutableRefObject } from 'react'
import {
  Beam,
  Dot,
  Formatter,
  Fraction,
  Renderer,
  Stave,
  StaveNote,
  StaveTie,
  Voice,
  VoiceMode,
} from 'vexflow/bravura'
import { METER_PULSE, METER_QUARTERS, onsets, type Measure } from '../music/rhythm'

const fontReady: Promise<unknown> = globalThis.document?.fonts?.load('30px Bravura') ?? Promise.resolve()
const SVG_NS = 'http://www.w3.org/2000/svg'

export interface NotationProps {
  measure: Measure
  /** Pitch (VexFlow key, written) for every note; rhythm-only exercises use the middle line. */
  pitch?: string
  clef?: boolean
  timeSig?: boolean
  /** Leave this many beats empty at the end, outlined, for "what completes the measure?". */
  blankBeats?: number
  /** Per-event colors (e.g. green for right, red for missed). */
  colors?: (string | undefined)[]
  /** Per-event text under the notes (counts like "1 & 2"). */
  labels?: string[]
  /** Makes notes tappable. */
  onTapNote?: (index: number) => void
  /** Small ticks above the staff at these beat positions (where you tapped). */
  marks?: { beat: number; color: string }[]
  /** Filled in with a function that moves the playback line to a beat (null hides it). */
  playhead?: MutableRefObject<((beat: number | null) => void) | null>
}

/** One measure of rhythm, drawn with VexFlow on a cream page. */
export function Notation({ measure, pitch = 'b/4', clef = true, timeSig = true, blankBeats, colors, labels, onTapNote, marks, playhead }: NotationProps) {
  const ref = useRef<HTMLDivElement>(null)
  const tapRef = useRef(onTapNote)
  tapRef.current = onTapNote
  const signature = JSON.stringify([measure, pitch, clef, timeSig, blankBeats, colors, labels, marks, !!onTapNote])

  useEffect(() => {
    let cancelled = false
    void fontReady.then(() => {
      const el = ref.current
      if (cancelled || !el) return
      el.innerHTML = ''
      const total = METER_QUARTERS[measure.meter]
      const lead = (clef ? 42 : 8) + (timeSig ? 26 : 0)
      const width = Math.max(150, lead + 40 + total * 56)
      const height = labels ? 132 : 112
      const renderer = new Renderer(el, Renderer.Backends.SVG)
      renderer.resize(width, height)
      const ctx = renderer.getContext()
      const stave = new Stave(2, 6, width - 4)
      if (clef) stave.addClef('treble')
      // Cut time is written with its own sign, ¢.
      if (timeSig) stave.addTimeSignature(measure.meter === '2/2' ? 'C|' : measure.meter)
      stave.setContext(ctx).draw()

      const notes = measure.events.map((e, i) => {
        const n = new StaveNote({ keys: [e.rest ? 'r/4' : pitch], duration: `${e.dur}${e.rest ? 'r' : ''}`, clef: 'treble' })
        if (e.dots) Dot.buildAndAttach([n], { all: true })
        const color = colors?.[i]
        if (color) n.setStyle({ fillStyle: color, strokeStyle: color })
        return n
      })
      const voice = new Voice({ numBeats: total, beatValue: 4 }).setMode(VoiceMode.SOFT).addTickables(notes)
      // Eighths are beamed a beat at a time, the way beginners learn to see them.
      const beams = Beam.generateBeams(notes, { groups: [new Fraction(1, 4)] })
      const area = stave.getNoteEndX() - stave.getNoteStartX()
      const used = blankBeats ? area * (1 - blankBeats / total) : area
      new Formatter().joinVoices([voice]).format([voice], Math.max(30, used - 24))
      voice.draw(ctx, stave)
      beams.forEach((b) => b.setContext(ctx).draw())
      measure.events.forEach((e, i) => {
        if (e.tie && notes[i + 1]) {
          new StaveTie({ firstNote: notes[i], lastNote: notes[i + 1], firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw()
        }
      })

      const svg = el.querySelector('svg')
      if (!svg) return
      const top = stave.getYForLine(0)
      const bottom = stave.getYForLine(4)
      const xs = notes.map((n) => (n.getNoteHeadBeginX() + n.getNoteHeadEndX()) / 2)
      const endX = stave.getNoteStartX() + used - 8

      if (blankBeats) {
        const box = document.createElementNS(SVG_NS, 'rect')
        const x = stave.getNoteStartX() + used - 4
        box.setAttribute('x', String(x))
        box.setAttribute('y', String(top - 6))
        box.setAttribute('width', String(Math.max(16, stave.getNoteEndX() - x - 6)))
        box.setAttribute('height', String(bottom - top + 12))
        box.setAttribute('rx', '4')
        box.setAttribute('fill', 'rgba(255,181,71,0.12)')
        box.setAttribute('stroke', '#a8742a')
        box.setAttribute('stroke-dasharray', '4 3')
        svg.appendChild(box)
      }

      // Beat position → x, following the notes so the line passes over each one as it sounds.
      const starts = onsets(measure)
      const beatToX = (beat: number) => {
        const points = [...starts.map((s, i) => [s, xs[i]] as const), [total, endX] as const]
        for (let i = 0; i < points.length - 1; i++) {
          const [b0, x0] = points[i]
          const [b1, x1] = points[i + 1]
          if (beat <= b1) return x0 + ((x1 - x0) * Math.max(0, beat - b0)) / (b1 - b0 || 1)
        }
        return endX
      }

      // Counts go under the beat they name, so a half note's "1 2" spreads across the two beats it's held.
      const beatLength = METER_PULSE[measure.meter].quarters
      labels?.forEach((label, i) => {
        label.split(' ').forEach((count, k) => {
          const text = document.createElementNS(SVG_NS, 'text')
          const at = k === 0 ? starts[i] : (Math.floor(starts[i] / beatLength) + k) * beatLength
          text.setAttribute('x', String(beatToX(at)))
          text.setAttribute('y', String(height - 18))
          text.setAttribute('font-size', '10pt')
          text.setAttribute('text-anchor', 'middle')
          text.setAttribute('stroke', 'none')
          if (colors?.[i]) text.setAttribute('fill', colors[i]!)
          text.textContent = count
          svg.appendChild(text)
        })
      })

      for (const m of marks ?? []) {
        const tick = document.createElementNS(SVG_NS, 'path')
        const x = beatToX(m.beat)
        tick.setAttribute('d', `M ${x - 4} ${top - 16} L ${x + 4} ${top - 16} L ${x} ${top - 9} Z`)
        tick.setAttribute('fill', m.color)
        svg.appendChild(tick)
      }

      if (playhead) {
        const line = document.createElementNS(SVG_NS, 'line')
        line.setAttribute('y1', String(top - 12))
        line.setAttribute('y2', String(bottom + 12))
        line.setAttribute('stroke', '#a8742a')
        line.setAttribute('stroke-width', '2')
        line.setAttribute('visibility', 'hidden')
        svg.appendChild(line)
        playhead.current = (beat) => {
          if (beat === null) return line.setAttribute('visibility', 'hidden')
          const x = String(beatToX(Math.min(beat, total)))
          line.setAttribute('x1', x)
          line.setAttribute('x2', x)
          line.setAttribute('visibility', 'visible')
        }
      }

      if (tapRef.current) {
        measure.events.forEach((e, i) => {
          if (e.rest) return
          const hit = document.createElementNS(SVG_NS, 'rect')
          hit.setAttribute('x', String(xs[i] - 18))
          hit.setAttribute('y', String(top - 26))
          hit.setAttribute('width', '36')
          hit.setAttribute('height', String(bottom - top + 52))
          hit.setAttribute('fill', 'transparent')
          // VexFlow's <svg> has pointer-events="none" and a black stroke, which these would inherit.
          hit.setAttribute('stroke', 'none')
          hit.setAttribute('pointer-events', 'all')
          hit.setAttribute('class', 'note-hit')
          hit.dataset.noteIndex = String(i)
          hit.addEventListener('click', () => tapRef.current?.(i))
          svg.appendChild(hit)
        })
      }

      svg.removeAttribute('width')
      svg.removeAttribute('height')
      svg.style.width = '100%'
      svg.style.height = '100%'
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    })
    return () => {
      cancelled = true
    }
    // `signature` captures everything the drawing depends on.
  }, [signature])

  return <div ref={ref} className="notation h-full w-full" aria-label="Rhythm notation" />
}
