/**
 * Text Accent Remover — strip diacritics via NFD normalize + removing combining marks.
 */

/** Unicode range for combining diacritical marks (U+0300..U+036F). */
export const COMBINING_RANGE = /[\u0300-\u036f]/g;

/** Remove diacritics from a string by NFD-normalizing and stripping combining marks. */
export function removeAccents(input: string): string {
  if (!input) return "";
  return input.normalize("NFD").replace(COMBINING_RANGE, "");
}

/** Batch: process each line, returning the cleaned array. */
export function removeAccentsBatch(inputs: string[]): string[] {
  return inputs.map(removeAccents);
}

/** Detect whether the string contains any combining diacritical marks. */
export function hasAccents(input: string): boolean {
  if (!input) return false;
  return COMBINING_RANGE.test(input.normalize("NFD"));
}

/** Count the number of combining marks removed. */
export function countAccentsRemoved(input: string): number {
  if (!input) return 0;
  const matches = input.normalize("NFD").match(COMBINING_RANGE);
  return matches ? matches.length : 0;
}

/** Remove accents but preserve case of the original letters. */
export function removeAccentsPreserveCase(input: string): string {
  return removeAccents(input);
}
