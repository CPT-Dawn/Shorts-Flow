import type { SessionStore } from '@/settings/session';
import type { Settings, SettingsStore } from '@/settings/settings';
import { createAdvance } from './advance';
import { autoScroll } from './auto-scroll';
import { watchSession } from './session';
import { shortcuts } from './shortcuts';
import { speed } from './speed';
import type { Feature, Feed } from './feed';
import { whileOnShortsFeed } from './route';
import { skipSponsoredShorts } from './skip-sponsored';
import { shortsControl } from './shorts-control';

/** Time as the engine sees it, so tests can move it forward by hand. */
export interface Clock {
  /**
   * Wall-clock time, in ms since the epoch: for anything stored or compared
   * with other tabs, later page loads and the Popup (which reads `Date.now()`),
   * such as when the viewer was last watching. It moves on while the computer
   * sleeps, and may jump when the system clock is set.
   */
  now(): number;
  /**
   * Time in ms from some fixed point in this page's life: for how long
   * something took here, such as playing time or a Hold. It never jumps with
   * the system clock, and stands still while the computer sleeps (in most
   * browsers), so it means nothing outside this page.
   */
  monotonic(): number;
  setTimeout(callback: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

/**
 * The keys in the locale files (public/_locales) of the text the engine shows
 * on the Shorts Feed. Features that show text add their keys here.
 */
export type EngineMessage =
  /** The translation's language, for writing numbers (not shown). */
  | 'localeCode'
  /** The Stall notice. */
  | 'stallNotice'
  /** Its retry button. */
  | 'stallRetry'
  /** The Break Nudge's title, text and button. */
  | 'breakNudgeTitle'
  | 'breakNudgeText'
  | 'breakNudgeKeepWatching'
  /** The Shorts Control's accessible name and the text under it. */
  | 'shortsControlName'
  /** Its tooltip while Auto-Scroll is on. */
  | 'shortsControlTurnOff'
  /** Its tooltip while Auto-Scroll is off. */
  | 'shortsControlTurnOn'
  /** The Shorts Control's quick-settings menu: its name (and its opener's), and its items. */
  | 'quickSettingsName'
  | 'quickSettingsSkipSponsored'
  | 'quickSettingsSpeed'
  | 'quickSettingsPreferredSpeed'
  | 'quickSettingsSpeedValue'
  | 'quickSettingsBack'
  /** The confirmations of the Shortcuts. */
  | 'shortcutAutoScrollOn'
  | 'shortcutAutoScrollOff'
  | 'shortcutSpeedOn'
  | 'shortcutSpeedOff';

/** Looks up user-facing text in the locale files: `browser.i18n.getMessage` in the extension. */
export type GetMessage = (name: EngineMessage, substitutions?: string | string[]) => string;

export type EngineOptions = {
  settings: SettingsStore;
  /** The current Session, shared with the other tabs and the Popup. */
  session: SessionStore;
  getMessage: GetMessage;
  /** Defaults to the document's window's clock. The content script passes one whose timers check WXT's context. */
  clock?: Clock;
  /** Tears the engine down when it aborts: WXT's content-script context signal in the extension. */
  signal?: AbortSignal;
};

/**
 * Every feature, each mounted once per visit to the Shorts Feed. A new
 * feature is a module exporting a `Feature`, added to this list.
 */
const FEATURES: Feature[] = [autoScroll, skipSponsoredShorts, shortsControl, speed, shortcuts, watchSession];

/**
 * Mounts the Shorts Flow engine onto `document` and returns its teardown.
 *
 * The engine acts only while the page is on the Shorts Feed, following
 * YouTube as it navigates without a page load. Off the Shorts Feed it keeps
 * just two things running: the Route watcher's polling timer, and its watch
 * on the settings, so it knows them the moment the viewer arrives. (The
 * content script also answers the Popup's question about the Shorts Feed.)
 * Everything it does flows from the page and the collaborators passed in, so
 * tests drive it exactly as the content script does.
 *
 * The document may belong to another window than the engine's code (tests
 * mount it onto a test page in an iframe), so the engine reaches everything
 * through `document.defaultView` and never uses `instanceof` on DOM classes.
 */
export function mountEngine(
  document: Document,
  { settings, session, getMessage, clock = windowClock(document.defaultView!), signal }: EngineOptions,
): () => void {
  const engine = new AbortController();
  const teardown = () => engine.abort();
  if (signal?.aborted) return teardown;
  signal?.addEventListener('abort', teardown, { once: true, signal: engine.signal });

  // Unknown until the settings arrive, so nothing moves on a guess.
  let current: Settings | undefined;
  const settingsListeners = new Set<(settings: Settings) => void>();
  const apply = (next: Settings) => {
    current = next;
    for (const listener of settingsListeners) listener(next);
  };
  let changedSinceRead = false;
  const unwatchSettings = settings.watch((changed) => {
    changedSinceRead = true;
    apply(changed);
  });
  engine.signal.addEventListener('abort', unwatchSettings, { once: true });
  settings
    .get()
    .then((read) => {
      if (!changedSinceRead && !engine.signal.aborted) apply(read);
    })
    // Fails only once the extension's context is gone (updated or removed),
    // when the engine is being torn down anyway: nothing left to tell.
    .catch(() => {});

  whileOnShortsFeed(document.defaultView!, clock, engine.signal, () => {
    const visit = new AbortController();
    try {
      mountFeatures(visit);
    } catch (error) {
      // Whatever did mount goes with the visit, which the Route watcher will
      // try afresh on its next check.
      visit.abort();
      throw error;
    }
    return () => visit.abort();
  });

  /** Builds this visit's Feed and mounts every feature onto it. */
  function mountFeatures(visit: AbortController) {
    const timers = new Set<number>();
    visit.signal.addEventListener('abort', () => {
      for (const id of timers) clock.clearTimeout(id);
      timers.clear();
    });

    const setTimeout: Feed['setTimeout'] = (callback, ms) => {
      const id = clock.setTimeout(() => {
        timers.delete(id);
        callback();
      }, ms);
      timers.add(id);
      return id;
    };
    const clearTimeout: Feed['clearTimeout'] = (id) => {
      timers.delete(id);
      clock.clearTimeout(id);
    };
    const advance = createAdvance({ document, signal: visit.signal, setTimeout, clearTimeout, getMessage });

    const feed: Feed = {
      document,
      clock,
      signal: visit.signal,
      settings: () => current,
      watchSettings(listener) {
        settingsListeners.add(listener);
        visit.signal.addEventListener('abort', () => settingsListeners.delete(listener));
        if (current) listener(current);
      },
      changeSettings(changes) {
        // Applied here at once, not when the store reports back: a second
        // switch a moment later (a double click) must flip what the first
        // left, not what was stored before it. The store's own report
        // follows, with the same settings.
        if (current) apply({ ...current, ...changes });
        // Fails only once the extension's context is gone: see above.
        settings.set(changes).catch(() => {});
      },
      session,
      getMessage,
      advance,
      setTimeout,
      clearTimeout,
    };

    for (const feature of FEATURES) {
      // One feature failing to mount (YouTube changed something it relies on)
      // leaves the others running; what it did set up ends with the visit.
      try {
        feature(feed);
      } catch (error) {
        console.error('Shorts Flow: a feature failed to mount on the Shorts Feed', error);
      }
    }
  }

  return teardown;
}

/** The clock of `window`: its wall clock, its monotonic clock, and its own timers. */
export function windowClock(window: Window): Clock {
  return {
    now: () => Date.now(),
    monotonic: () => window.performance.now(),
    setTimeout: (callback, ms) => window.setTimeout(callback, ms),
    clearTimeout: (id) => window.clearTimeout(id),
  };
}
