import { useEffect, useRef } from 'react'
import { loadVexFlow, SVG_NS } from './musicFont'
import { METER_QUARTERS, type Meter } from '../music/rhythm'
import { KEYS, scoreKey, signSymbol, staffDegree, type KeyId, type RoadMark, type RoadSigns, type ScoreMeasure } from '../music/score'

/** Roughly how wide one letter of a 10pt label is, with a little air between neighbors. */
const LABEL_CHAR_PX = 8

export interface ScoreProps {
  measures: ScoreMeasure[]
  /** Key signature drawn after the clef (C draws none). */
  keySig?: KeyId
  /** Time signature at the start, or none. */
  meter?: Meter | null
  /** Per-note colors, counting across all measures. */
  colors?: (string | undefined)[]
  /** Per-note text under the staff (note names after answering). */
  labels?: string[]
  /** Points a small arrow at this note (counting across all measures). */
  marker?: number | null
  /** Repeat signs, 1st and 2nd endings, and jumps, by measure. */
  signs?: (RoadSigns | undefined)[]
  /** Numbers each measure underneath, for following the order it's played in. */
  numbered?: boolean
}

/** A short melody at real pitch: clef, key signature, printed accidentals and bar lines, on a cream page. */
export function Score({ measures, keySig = 'C', meter = null, colors, labels, marker = null, signs, numbered = false }: ScoreProps) {
  const ref = useRef<HTMLDivElement>(null)
  const signature = JSON.stringify([measures, keySig, meter, colors, labels, marker, signs, numbered])

  useEffect(() => {
    let cancelled = false
    void loadVexFlow().then(({ Accidental, BarlineType, Dot, Formatter, Renderer, Repetition, Stave, StaveNote, Voice, VoiceMode, VoltaType }) => {
      const el = ref.current
      if (cancelled || !el) return
      el.innerHTML = ''
      const lead = 44 + Object.keys(KEYS[keySig].altered).length * 12 + (meter ? 28 : 0)
      // Each note gets room for its label underneath too, so long words like "diminished" don't run together.
      let at = 0
      const widths = measures.map((m, i) => {
        const slots = m.map(() => Math.max(46, (labels?.[at++]?.length ?? 0) * LABEL_CHAR_PX))
        // A repeat sign at the start takes a little room of its own, and words like "D.S. al Coda" need theirs.
        const mark = signs?.[i]?.mark
        const words = mark && mark !== 'segno' && mark !== 'coda' ? 36 : 0
        return (i === 0 ? lead : 0) + (signs?.[i]?.repeatStart ? 12 : 0) + words + Math.max(70, 28 + slots.reduce((a, b) => a + b, 0))
      })
      const width = widths.reduce((a, b) => a + b, 0) + 4
      const height = 140 + (labels ? 20 : 0) + (numbered ? 20 : 0)
      const REPETITION: Record<RoadMark, number> = {
        segno: Repetition.type.SEGNO_LEFT,
        coda: Repetition.type.CODA_LEFT,
        fine: Repetition.type.FINE,
        'to-coda': Repetition.type.TO_CODA,
        dc: Repetition.type.DC,
        'dc-al-fine': Repetition.type.DC_AL_FINE,
        'dc-al-coda': Repetition.type.DC_AL_CODA,
        'ds-al-fine': Repetition.type.DS_AL_FINE,
        'ds-al-coda': Repetition.type.DS_AL_CODA,
      }
      const renderer = new Renderer(el, Renderer.Backends.SVG)
      renderer.resize(width, height)
      const ctx = renderer.getContext()
      const centers: number[] = []
      const middles: number[] = []
      let x = 2
      let top = 0

      measures.forEach((measure, i) => {
        const stave = new Stave(x, 6, widths[i])
        if (i === 0) {
          stave.addClef('treble')
          if (keySig !== 'C') stave.addKeySignature(keySig)
          if (meter) stave.addTimeSignature(meter === '2/2' ? 'C|' : meter)
        }
        const sign = signs?.[i]
        if (sign?.repeatStart) stave.setBegBarType(BarlineType.REPEAT_BEGIN)
        if (sign?.repeatEnd) stave.setEndBarType(BarlineType.REPEAT_END)
        else if (sign?.final) stave.setEndBarType(BarlineType.END)
        if (sign?.ending) stave.setVoltaType(VoltaType.BEGIN_END, `${sign.ending}.`, -5)
        if (sign?.mark) stave.setRepetitionType(REPETITION[sign.mark])
        stave.setContext(ctx).draw()
        top = stave.getYForLine(0)
        middles.push((stave.getNoteStartX() + stave.getNoteEndX()) / 2)
        x += widths[i]
        if (!measure.length) return
        const notes = measure.map((n, k) => {
          // A stacked note shares the stem, written bottom to top.
          const heads = [n, ...(n.with ?? [])].sort((a, b) => staffDegree(a) - staffDegree(b))
          const note = new StaveNote({ keys: heads.map(scoreKey), duration: n.dur, clef: 'treble' })
          heads.forEach((h, i) => h.sign !== undefined && note.addModifier(new Accidental(signSymbol(h.sign)), i))
          if (n.dots) Dot.buildAndAttach([note], { all: true })
          const color = colors?.[centers.length + k]
          if (color) note.setStyle({ fillStyle: color, strokeStyle: color })
          return note
        })
        const voice = new Voice({ numBeats: meter ? METER_QUARTERS[meter] : 4, beatValue: 4 }).setMode(VoiceMode.SOFT).addTickables(notes)
        new Formatter().joinVoices([voice]).format([voice], Math.max(30, stave.getNoteEndX() - stave.getNoteStartX() - 20))
        voice.draw(ctx, stave)
        for (const note of notes) centers.push((note.getNoteHeadBeginX() + note.getNoteHeadEndX()) / 2)
      })

      const svg = el.querySelector('svg')
      if (!svg) return
      if (numbered) {
        // Under the staff, below any note labels: one number per measure.
        middles.forEach((mx, i) => {
          const number = document.createElementNS(SVG_NS, 'text')
          number.setAttribute('x', String(mx))
          number.setAttribute('y', String(height - 10))
          number.setAttribute('font-size', '10pt')
          number.setAttribute('font-weight', '600')
          number.setAttribute('text-anchor', 'middle')
          number.setAttribute('stroke', 'none')
          number.setAttribute('data-measure', String(i + 1))
          number.textContent = String(i + 1)
          svg.appendChild(number)
        })
      }
      labels?.forEach((label, i) => {
        if (!label || centers[i] === undefined) return
        const text = document.createElementNS(SVG_NS, 'text')
        text.setAttribute('x', String(centers[i]))
        text.setAttribute('y', String(height - (numbered ? 30 : 10)))
        text.setAttribute('font-size', '10pt')
        text.setAttribute('text-anchor', 'middle')
        text.setAttribute('stroke', 'none')
        if (colors?.[i]) text.setAttribute('fill', colors[i]!)
        text.textContent = label
        svg.appendChild(text)
      })
      if (marker !== null && centers[marker] !== undefined) {
        // Above even the highest ledger-line notes these exercises use.
        const arrow = document.createElementNS(SVG_NS, 'path')
        const ax = centers[marker]
        const ay = Math.max(2, top - 40)
        arrow.setAttribute('d', `M ${ax - 6} ${ay} L ${ax + 6} ${ay} L ${ax} ${ay + 9} Z`)
        arrow.setAttribute('fill', 'var(--color-amber-dim)')
        arrow.setAttribute('stroke', 'none')
        arrow.setAttribute('data-marker', String(marker))
        svg.appendChild(arrow)
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

  return <div ref={ref} className="score h-full w-full" aria-label="Sheet music" />
}
