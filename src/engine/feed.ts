import type { SessionStore } from '@/settings/session';
import type { Settings } from '@/settings/settings';
import type { Clock, GetMessage } from './engine';

/**
 * What a feature gets while the page is on the Shorts Feed. The engine builds
 * one each time the viewer arrives there and ends it when they leave, or when
 * the engine is torn down: `signal` aborts then, and every timer set through
 * `setTimeout` is cleared. A feature passes `signal` to each listener it adds
 * and disconnects its observers on its `abort`, so nothing it set up outlives
 * its visit.
 */
export type Feed = {
  document: Document;
  clock: Clock;
  /** Aborts when the page leaves the Shorts Feed or the engine is torn down. */
  signal: AbortSignal;
  /** The settings as last read, or undefined until the first read arrives: act on nothing until then. */
  settings(): Settings | undefined;
  /**
   * Calls `listener` with the settings as soon as they are known, and again
   * on every change from anywhere, for as long as this visit lasts.
   */
  watchSettings(listener: (settings: Settings) => void): void;
  /** Saves a settings change; every tab and the Popup hear of it, this one included. */
  changeSettings(changes: Partial<Settings>): void;
  session: SessionStore;
  getMessage: GetMessage;
  /**
   * Advances the Shorts Feed to the next Short through YouTube's own
   * navigation. Asking again before the feed has moved off the same Short
   * does nothing, so features may ask freely.
   */
  advance(): void;
  /** `clock.setTimeout`, cleared when the visit ends. */
  setTimeout(callback: () => void, ms: number): number;
  clearTimeout(id: number): void;
};

/**
 * One feature of the engine on the Shorts Feed (Auto-Scroll, the Shorts
 * Control, Speed, ...). Called once per visit to the Shorts Feed; it cleans up
 * through `feed.signal`.
 */
export type Feature = (feed: Feed) => void;
