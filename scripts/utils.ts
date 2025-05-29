/**
 * Random integer between min and max, inclusive.
 */
export function r(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
