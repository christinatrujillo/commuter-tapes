/** "an" before a word that starts with a vowel ("an octave"), "a" before the rest. */
export const aOrAn = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a')

/** "major 3rd" → "Major 3rd". */
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "C, D and E": a list in a sentence. */
export const andList = (items: string[]) => (items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)
