import { useEffect, useRef } from 'react'
import { Accidental, Annotation, AnnotationVerticalJustify, Formatter, Renderer, Stave, StaveNote, Voice, VoiceMode } from 'vexflow/bravura'

interface Props {
  /** VexFlow keys at written pitch, e.g. ['c/4'] or ['f#/4', 'bb/4']. */
  keys: string[]
  labels?: string[]
  color?: string
}

const fontReady: Promise<unknown> = globalThis.document?.fonts?.load('30px Bravura') ?? Promise.resolve()

/** A treble-clef staff (with the guitar's "8" below the clef) showing one or more whole notes. */
export function Staff({ keys, labels, color }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const signature = `${keys.join(',')}|${labels?.join(',') ?? ''}|${color ?? ''}`

  useEffect(() => {
    let cancelled = false
    void fontReady.then(() => {
      const el = ref.current
      if (cancelled || !el) return
      el.innerHTML = ''

      const width = keys.length > 1 ? 90 + keys.length * 52 : 190
      const height = 150
      const renderer = new Renderer(el, Renderer.Backends.SVG)
      renderer.resize(width, height)
      const ctx = renderer.getContext()

      const stave = new Stave(2, 12, width - 4)
      stave.addClef('treble', 'default', '8vb')
      stave.setContext(ctx).draw()

      const notes = keys.map((key, i) => {
        const note = new StaveNote({ keys: [key], duration: 'w', clef: 'treble' })
        const acc = key.split('/')[0].slice(1)
        if (acc) note.addModifier(new Accidental(acc), 0)
        if (labels?.[i]) {
          note.addModifier(new Annotation(labels[i]).setVerticalJustification(AnnotationVerticalJustify.BOTTOM), 0)
        }
        if (color) note.setStyle({ fillStyle: color, strokeStyle: color })
        return note
      })

      const voice = new Voice({ numBeats: 4 * keys.length, beatValue: 4 }).setMode(VoiceMode.SOFT).addTickables(notes)
      const available = stave.getNoteEndX() - stave.getNoteStartX()
      new Formatter().joinVoices([voice]).format([voice], available - 30)
      // A lone note sits in the middle of the staff instead of hugging the clef.
      if (notes.length === 1) notes[0].setXShift(available / 2 - 28)
      voice.draw(ctx, stave)

      const svg = el.querySelector('svg')
      if (svg) {
        svg.removeAttribute('width')
        svg.removeAttribute('height')
        svg.style.width = '100%'
        svg.style.height = '100%'
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
      }
    })
    return () => {
      cancelled = true
    }
    // `signature` captures everything the drawing depends on.
  }, [signature])

  return <div ref={ref} className="staff h-full w-full" aria-label={`Staff showing ${labels?.join(', ') ?? keys.join(', ')}`} />
}
