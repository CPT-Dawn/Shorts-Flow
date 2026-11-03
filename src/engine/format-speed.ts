/**
 * The Preferred Speed as the viewer reads it, for the `$1` of messages such
 * as "$1×": in the browser's own number format, so 1.5 reads "1,5" where a
 * comma is the decimal mark. Up to two decimals, enough for 1.25 and 1.75.
 */
export function formatSpeed(speed: number): string {
  return SPEED_FORMAT.format(speed);
}

const SPEED_FORMAT = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
