import messages from '../../../public/_locales/en/messages.json';

type Message = { message: string; placeholders?: Record<string, { content: string }> };

/**
 * `browser.i18n.getMessage` for engine tests, which run without the extension:
 * the English strings from the locale file, with `$NAME$` placeholders and
 * `$1`… substitutions filled in the way the browser does.
 */
export function getMessage(name: string, substitutions: string | string[] = []): string {
  const entry = (messages as Record<string, Message | undefined>)[name];
  if (!entry) return '';
  const values = typeof substitutions === 'string' ? [substitutions] : substitutions;
  return entry.message
    .replace(/\$(\w+)\$/g, (_, placeholder: string) => entry.placeholders?.[placeholder.toLowerCase()]?.content ?? '')
    .replace(/\$(\d)/g, (_, n: string) => values[Number(n) - 1] ?? '');
}
