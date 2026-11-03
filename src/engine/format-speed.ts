/**
 * The Preferred Speed as the viewer reads it, for the `$1` of messages such
 * as "$1×": in the number format of `locale`, the translation's own language
 * (its `localeCode` message), so 1.5 reads "1,5" only in a translation whose
 * language writes it that way, never inside English text. Up to two decimals,
 * enough for 1.25 and 1.75.
 */
export function formatSpeed(speed: number, locale: string): string {
  let format = FORMATS.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale || 'en', { maximumFractionDigits: 2 });
    FORMATS.set(locale, format);
  }
  return format.format(speed);
}

const FORMATS = new Map<string, Intl.NumberFormat>();
