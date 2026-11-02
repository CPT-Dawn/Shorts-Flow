import type { Settings, ShortcutAction, SwitchSetting } from '@/settings/settings';
import { shortcutKey } from '@/settings/shortcut-key';
import { toggleSetting, type Feature, type Feed } from './feed';
import { isTyping } from './holds';
import { createToast } from './toast';

/** How long a Shortcut's confirmation shows, in ms: about as long as YouTube's own. */
const CONFIRMATION_MS = 2000;

/**
 * Shortcuts: single keys on the Shorts Feed, A for Auto-Scroll and S for
 * Speed unless the viewer rebound them in the Popup. Each switches its
 * setting for every tab and shows a brief confirmation in YouTube's style.
 *
 * A key is left alone, for YouTube and the browser, while the viewer types
 * (search, comments), with Shift, Ctrl, Alt or Meta held, while it is held down
 * (repeats), and when a script made it up rather than the viewer's keyboard
 * (Shorts Flow's own ArrowDown fallback among them). YouTube's own keys can't
 * be bound (the Popup refuses them), so its navigation is never touched.
 * Off the Shorts Feed this feature isn't mounted at all.
 */
export const shortcuts: Feature = (feed) => {
  const window = feed.document.defaultView!;
  const confirmation = createToast(feed, 'shortcut-confirmation');

  const onKeyDown = (event: KeyboardEvent) => {
    if (!event.isTrusted || event.isComposing || isTyping(feed.document)) return;
    const settings = feed.settings();
    const key = shortcutKey(event);
    if (!settings || !key) return;
    const action = (Object.keys(settings.shortcuts) as ShortcutAction[]).find((name) => settings.shortcuts[name] === key);
    if (!action) return;
    // The key is Shorts Flow's alone now, so nothing of YouTube's acts on it too.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    const switched = toggleSetting(feed, SWITCHES[action]);
    if (switched) confirmation.show(confirm(feed, switched, action), { duration: CONFIRMATION_MS });
  };

  window.addEventListener('keydown', onKeyDown, { capture: true, signal: feed.signal });
};

/** The setting each Shortcut switches. */
const SWITCHES: Record<ShortcutAction, SwitchSetting> = {
  toggleAutoScroll: 'autoScroll',
  toggleSpeed: 'speedOn',
};

/** What the confirmation says once `action` has changed the settings to `settings`. */
function confirm({ getMessage }: Pick<Feed, 'getMessage'>, settings: Settings, action: ShortcutAction): string {
  if (action === 'toggleAutoScroll') return getMessage(settings.autoScroll ? 'shortcutAutoScrollOn' : 'shortcutAutoScrollOff');
  return settings.speedOn ? getMessage('shortcutSpeedOn', String(settings.preferredSpeed)) : getMessage('shortcutSpeedOff');
}
