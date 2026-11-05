/** Resolves once the music font (Bravura) has loaded, so notation draws with the right symbols. */
export const musicFontReady: Promise<unknown> = globalThis.document?.fonts?.load('30px Bravura') ?? Promise.resolve()

/** For the extra marks (labels, arrows, tap areas) drawn into notation's SVG. */
export const SVG_NS = 'http://www.w3.org/2000/svg'
