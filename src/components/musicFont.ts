let vexflow: Promise<typeof import('vexflow/bravura')> | null = null

/**
 * The sheet-music library, with its music font (Bravura) ready to draw with. It loads the first
 * time a staff is drawn rather than with the app, so screens without sheet music open faster;
 * every staff after that shares the one load.
 */
export function loadVexFlow() {
  vexflow ??= import('vexflow/bravura').then(async (vf) => {
    await globalThis.document?.fonts?.load('30px Bravura')
    return vf
  })
  return vexflow
}

/** For the extra marks (labels, arrows, tap areas) drawn into notation's SVG. */
export const SVG_NS = 'http://www.w3.org/2000/svg'
