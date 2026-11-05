/**
 * Whether `value` is one of `options`. For names read back from saved progress, where a plain
 * lookup (`TABLE[value]`) would also accept names every object has, like "constructor".
 */
export const isOneOf = <T extends string>(value: string, options: readonly T[]): value is T => (options as readonly string[]).includes(value)
