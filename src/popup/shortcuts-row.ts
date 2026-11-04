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
 * A new key is announced in the hint, which is a polite live region.
 */
export const shortcutsRow: PopupRow = (popup) => {
  const { document, signal, getMessage } = popup;
  const id = 'sf-setting-shortcuts';
  let listening: ShortcutAction | undefined;
  let refusal: string | undefined;
  /** The Shortcut the viewer just gave a new key, to say so in the hint. */
  let rebound: ShortcutAction | undefined;

  const keys = SHORTCUTS.map(({ action, name }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sf-shortcut';
    button.setAttribute('aria-describedby', `${id}-hint`);
    const label = document.createElement('span');
    label.textContent = getMessage(name);
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

  const { item, hint } = popup.row({ id, label: getMessage('popupShortcuts'), control: controls });
  hint.setAttribute('aria-live', 'polite');

  const show = () => {
    const shortcuts = popup.settings()?.shortcuts;
    if (!shortcuts) return;
    for (const { action, name, button, keycap } of keys) {
      const waiting = listening === action;
      const keycapText = waiting ? getMessage('popupPressKey') : shortcutKeyName(shortcuts[action]);
      keycap.textContent = keycapText;
      // The name starts with what the button shows (WCAG 2.5.3, Label in Name).
      button.setAttribute('aria-label', getMessage('popupShortcutKey', [getMessage(name), keycapText]));
      button.setAttribute('aria-pressed', String(waiting));
      button.disabled = false;
    }
    hint.textContent =
      refusal ??
      (rebound && reboundMessage(shortcuts, rebound)) ??
      getMessage(listening ? 'popupShortcutsListening' : 'popupShortcutsHint');
  };

  const reboundMessage = (shortcuts: Shortcuts, action: ShortcutAction) => {
    const { name } = SHORTCUTS.find((shortcut) => shortcut.action === action)!;
    return getMessage('popupShortcutChanged', [getMessage(name), shortcutKeyName(shortcuts[action])]);
  };

  const listen = (action: ShortcutAction | undefined) => {
    listening = action;
    refusal = undefined;
    rebound = undefined;
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
    // The hint says so once the new key is saved and shown.
    rebound = action;
    listening = undefined;
    popup.changeSettings({ shortcuts: { ...shortcuts, [action]: key } });
  };

  /** Why `key` can't be `action`'s Shortcut, if it can't. */
  const clash = (shortcuts: Shortcuts, action: ShortcutAction, key: string): string | undefined => {
    const keyName = shortcutKeyName(key);
    if (isYouTubeKey(key)) return getMessage('popupKeyYouTube', [keyName]);
    const other = SHORTCUTS.find((shortcut) => shortcut.action !== action && shortcuts[shortcut.action] === key);
    return other && getMessage('popupKeyTaken', [keyName, getMessage(other.name)]);
  };

  popup.watchSettings(show);
  return item;
};
