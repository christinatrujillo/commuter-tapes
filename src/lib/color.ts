/** Amber ink for pointing out notes on the cream staff paper. */
export const PAPER_HIGHLIGHT = '#b8862e'

/** Rust-red ink on the cream paper: diminished chords, notes a scale leaves out, a ringed dot. */
export const PAPER_RUST = '#b5473a'

/** Colors for a scale on the staff (`count` notes and the octave), with the notes at these indexes in `color`. */
export const marked = (count: number, color: string, ...indexes: number[]) => Array.from({ length: count + 1 }, (_, i) => (indexes.includes(i) ? color : undefined))

/** LED colors: red (0) → amber → green (1). */
export const heatColor = (accuracy: number) => `hsl(${Math.round(accuracy * 120)}, 80%, 56%)`
