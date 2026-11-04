/** Keys that only change other keys, or that the keyboard hasn't settled on yet. */
const NOT_SHORTCUT_KEYS = ['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'OS', 'CapsLock', 'NumLock', 'Fn', 'FnLock', 'Dead', 'Process', 'Unidentified'];

/**
 * The Shortcut key a keydown is for: its `key`, letters in lower case so
 * Caps Lock doesn't matter. Undefined for a key combination with Shift,
 * Ctrl, Alt or Meta, which belong to the browser, the system and YouTube
 * (a Shortcut is a single key), and for a key that can't be a Shortcut on
 * its own.
 */
export function shortcutKey(event: KeyboardEvent): string | undefined {
  if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return undefined;
  if (NOT_SHORTCUT_KEYS.includes(event.key)) return undefined;
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

const KEY_NAMES: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ' ': 'Space',
};

/** How a Shortcut key is shown to the viewer: `a` as A, `ArrowDown` as ↓. */
export function shortcutKeyName(key: string): string {
  return KEY_NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}
