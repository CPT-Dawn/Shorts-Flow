import type { SessionStore } from '@/settings/session';
import type { Settings, SettingsStore } from '@/settings/settings';
import { createAdvance } from './advance';
import { autoScroll } from './auto-scroll';
import type { Feature, Feed } from './feed';
import { whileOnShortsFeed } from './route';

/** Time as the engine sees it, so tests can move it forward by hand. */
export interface Clock {
  /**
   * Time in ms. In the browser it is ms since the epoch, so other tabs and
   * later page loads can compare it, yet it never jumps with the system clock
   * while the page is open.
   */
  now(): number;
  setTimeout(callback: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

/**
 * The keys in the locale files (public/_locales) of the text the engine shows
 * on the Shorts Feed. None yet: features that show text add their keys here.
 */
export type EngineMessage = never;

/** Looks up user-facing text in the locale files: `browser.i18n.getMessage` in the extension. */
export type GetMessage = (name: EngineMessage, substitutions?: string | string[]) => string;

export type EngineOptions = {
  settings: SettingsStore;
  /** The current Session, shared with the other tabs and the Popup. */
  session: SessionStore;
  getMessage: GetMessage;
  /** Defaults to the document's window's clock. The content script passes one on WXT's context. */
  clock?: Clock;
  /** Tears the engine down when it aborts: WXT's content-script context signal in the extension. */
  signal?: AbortSignal;
};

/**
 * Every feature, each mounted once per visit to the Shorts Feed. A new
 * feature is a module exporting a `Feature`, added to this list.
 */
const FEATURES: Feature[] = [autoScroll];

/**
 * Mounts the Shorts Flow engine onto `document` and returns its teardown.
 *
 * The engine acts only while the page is on the Shorts Feed, following
 * YouTube as it navigates without a page load. Everything it does flows from
 * the page and the collaborators passed in, so tests drive it exactly as the
 * content script does.
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
  void settings.get().then((read) => {
    if (!changedSinceRead && !engine.signal.aborted) apply(read);
  });

  whileOnShortsFeed(document.defaultView!, clock, engine.signal, () => {
    const visit = new AbortController();
    const timers = new Set<number>();
    visit.signal.addEventListener('abort', () => {
      for (const id of timers) clock.clearTimeout(id);
      timers.clear();
    });

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
        void settings.set(changes);
      },
      session,
      getMessage,
      advance: () => {},
      setTimeout(callback, ms) {
        const id = clock.setTimeout(() => {
          timers.delete(id);
          callback();
        }, ms);
        timers.add(id);
        return id;
      },
      clearTimeout(id) {
        timers.delete(id);
        clock.clearTimeout(id);
      },
    };
    feed.advance = createAdvance(feed);

    for (const feature of FEATURES) feature(feed);
    return () => visit.abort();
  });

  return teardown;
}

function windowClock(window: Window): Clock {
  return {
    now: () => window.performance.timeOrigin + window.performance.now(),
    setTimeout: (callback, ms) => window.setTimeout(callback, ms),
    clearTimeout: (id) => window.clearTimeout(id),
  };
}
