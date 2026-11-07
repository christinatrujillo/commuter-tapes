/** Amber ink for pointing out notes on the cream staff paper. */
export const PAPER_HIGHLIGHT = '#b8862e'

/** Rust-red ink on the cream paper: diminished chords, notes a scale leaves out, a ringed dot. */
export const PAPER_RUST = '#b5473a'

/** LED colors: red (0) → amber → green (1). */
export const heatColor = (accuracy: number) => `hsl(${Math.round(accuracy * 120)}, 80%, 56%)`
