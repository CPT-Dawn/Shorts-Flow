import { isYouTubeKey } from '@/engine/youtube';
import type { ShortcutAction, Shortcuts } from '@/settings/settings';
import { shortcutKey, shortcutKeyName } from '@/settings/shortcut-key';
import type { PopupMessage } from './messages';
import type { PopupRow } from './rows';

/** The Shortcuts the row lists, in order, with the name of what each one switches. */
const SHORTCUTS: { action: ShortcutAction; name: PopupMessage }[] = [
  { action: 'toggleAutoScroll', name: 'popupAutoScroll' },
  { action: 'toggleSpeed', name: 'popupSpeed' },
];

/**
 * The Shortcuts row: each Shortcut's key in a keycap button. Pressing one
 * waits for the next key the viewer presses and makes it that Shortcut's
 * key, for every Shorts tab at once. Escape keeps the old key; a key
 * combination or a lone modifier is waited past. A key that clashes is
 * refused with the reason in the hint: the other Shortcut's key, or one of
 * YouTube's own keys (so its navigation and player keys keep working).
 */
export const shortcutsRow: PopupRow = (popup) => {
  const { document, signal, message } = popup;
  const id = 'sf-setting-shortcuts';
  let listening: ShortcutAction | undefined;
  let refusal: string | undefined;

  const keys = SHORTCUTS.map(({ action, name }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sf-shortcut';
    button.setAttribute('aria-describedby', `${id}-hint`);
    const label = document.createElement('span');
    label.textContent = message(name);
    const keycap = document.createElement('kbd');
    keycap.className = 'sf-kbd';
    button.append(label, keycap);
    // Disabled until the settings arrive, so nothing shows a guess.
    button.disabled = true;
    button.addEventListener('click', () => listen(listening === action ? undefined : action), { signal });
    button.addEventListener('keydown', (event) => onKey(action, event), { signal });
    // Tabbing or clicking away stops listening.
    button.addEventListener('blur', () => listening === action && listen(undefined), { signal });
    return { action, name, button, keycap };
  });

  const controls = document.createElement('span');
  controls.className = 'sf-row-value';
  controls.append(...keys.map(({ button }) => button));

  const item = popup.row({ id, label: message('popupShortcuts'), hint: '', control: controls });
  const hint = item.querySelector(`[id="${id}-hint"]`)!;
  hint.setAttribute('aria-live', 'polite');

  const show = () => {
    const shortcuts = popup.settings()?.shortcuts;
    if (!shortcuts) return;
    for (const { action, name, button, keycap } of keys) {
      const keyName = shortcutKeyName(shortcuts[action]);
      const waiting = listening === action;
      keycap.textContent = waiting ? message('popupPressKey') : keyName;
      button.setAttribute('aria-label', message('popupShortcutKey', [message(name), keyName]));
      button.setAttribute('aria-pressed', String(waiting));
      button.disabled = false;
    }
    hint.textContent = refusal ?? message(listening ? 'popupShortcutsListening' : 'popupShortcutsHint');
  };

  const listen = (action: ShortcutAction | undefined) => {
    listening = action;
    refusal = undefined;
    show();
  };

  const onKey = (action: ShortcutAction, event: KeyboardEvent) => {
    const shortcuts = popup.settings()?.shortcuts;
    if (listening !== action || !shortcuts) return;
    // Tab moves on, and the blur that follows stops listening.
    if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      listen(undefined);
      return;
    }
    const key = shortcutKey(event);
    // A combination, or a key like Shift: wait for a key that can be a Shortcut.
    if (!key) return;
    event.preventDefault();
    refusal = clash(shortcuts, action, key);
    if (refusal) {
      show();
      return;
    }
    popup.changeSettings({ shortcuts: { ...shortcuts, [action]: key } });
    listening = undefined;
  };

  /** Why `key` can't be `action`'s Shortcut, if it can't. */
  const clash = (shortcuts: Shortcuts, action: ShortcutAction, key: string): string | undefined => {
    const keyName = shortcutKeyName(key);
    if (isYouTubeKey(key)) return message('popupKeyYouTube', [keyName]);
    const other = SHORTCUTS.find((shortcut) => shortcut.action !== action && shortcuts[shortcut.action] === key);
    return other && message('popupKeyTaken', [keyName, message(other.name)]);
  };

  popup.watchSettings(show);
  return item;
};
