/** "an" before a word that starts with a vowel ("an octave"), "a" before the rest. */
export const aOrAn = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a')

/** "major 3rd" → "Major 3rd". */
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
