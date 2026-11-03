/** LED colors: red (0) → amber → green (1). */
export const heatColor = (accuracy: number) => `hsl(${Math.round(accuracy * 120)}, 80%, 56%)`
