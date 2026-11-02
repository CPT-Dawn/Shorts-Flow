import { expect, onTestFinished } from 'vitest';
import { mountEngine } from '@/engine/engine';
import type { SessionStore } from '@/settings/session';
import type { SettingsStore } from '@/settings/settings';
import { createTestClock, type TestClock } from './clock';
import { getMessage } from './messages';
import { createTestSessionStore, createTestSettingsStore } from './stores';
import { openTestPage, type TestPage } from './test-pages';

/** `expect.poll` options with time for two Shorts (2 to 3 s clips) to play out and the feed to move on. */
export const TWO_SHORTS = { timeout: 12_000 };

/**
 * Waits for the Shorts Feed's timeline to begin with `expected`. Only the
 * start is compared: the feed plays on after the last thing a test looks for.
 */
export function expectTimeline(shortsFeed: ShortsFeed, expected: string[], options = TWO_SHORTS) {
  return expect.poll(() => shortsFeed.timeline.slice(0, expected.length), options).toEqual(expected);
}

/** Long enough for the feed to have moved on had Shorts Flow Advanced, which it does as a Short ends. */
export function aMomentLater() {
  return new Promise((resolve) => setTimeout(resolve, 500));
}

export type ShortsFeed = {
  window: Window;
  document: Document;
  settings: SettingsStore;
  session: SessionStore;
  clock: TestClock;
  /**
   * What the viewer has seen so far, in order:
   * - `Short <n> started over` when the nth Short loops back to its start;
   * - `Short <n> is current` when YouTube has moved the feed on to it;
   * - `page scrolled by script` if anything scrolled the page other than
   *   YouTube's own next-Short navigation;
   * - `page reloaded`.
   */
  timeline: string[];
  /** Moves to `path` inside YouTube, without a page load. */
  navigate(path: string): void;
  /** Sets the playback speed as YouTube's own speed menu does. */
  setPlaybackSpeed(rate: number): void;
  /** Pauses the Current Short where it is, as YouTube's pause control does. */
  pause(): void;
  /**
   * Plays a clip to its end in the hidden watch-page player YouTube keeps
   * behind the Shorts Feed. Resolves once it has ended.
   */
  playHiddenWatchPlayer(): Promise<void>;
  /** Tears the engine down, leaving the page playing. */
  unmountEngine(): void;
};

/**
 * Opens `page`, stands in for the parts of YouTube the scriptless test page
 * lacks (playing the Current Short, and moving to the next one when its
 * Next video control is pressed or ArrowDown is typed), and mounts the
 * engine onto it the way the content script does.
 */
export async function mountShortsFeed(
  page: TestPage,
  {
    settings = createTestSettingsStore(),
    session = createTestSessionStore(),
    clock = createTestClock(),
    path = page.path,
    signal,
  }: {
    settings?: SettingsStore;
    session?: SessionStore;
    clock?: TestClock;
    /** Where on YouTube the page is when the engine starts. */
    path?: string;
    /** Stands in for WXT's content-script context: the engine tears down when it aborts. */
    signal?: AbortSignal;
  } = {},
): Promise<ShortsFeed> {
  const { window, document } = await openTestPage(page);
  window.history.replaceState(null, '', path);

  const timeline: string[] = [];
  const push = (entry: string) => timeline.push(entry);
  watchForScriptedScrolls(window, () => push('page scrolled by script'));
  window.frameElement!.addEventListener('load', () => push('page reloaded'));
  const youtube = playLikeYouTube(window, page, push);

  const unmount = mountEngine(document, { settings, session, getMessage, clock, signal });
  let mounted = true;
  const unmountEngine = () => {
    if (!mounted) return;
    mounted = false;
    unmount();
  };
  onTestFinished(unmountEngine);

  return {
    window,
    document,
    settings,
    session,
    clock,
    timeline,
    navigate(path) {
      // How YouTube moves between its pages: no load.
      window.history.pushState(null, '', path);
    },
    setPlaybackSpeed(rate) {
      youtube.video.defaultPlaybackRate = rate;
      youtube.video.playbackRate = rate;
    },
    pause() {
      youtube.video.pause();
    },
    playHiddenWatchPlayer: youtube.playHiddenWatchPlayer,
    unmountEngine,
  };
}

/**
 * Stands in for YouTube's Shorts player and feed. The Shorts Feed keeps one
 * renderer and one looping `<video>` for every Short: moving on puts the
 * renderer into the next slot, gives the video the next Short's clip, and
 * changes the address to the next Short's. YouTube never moves on by itself.
 */
function playLikeYouTube(window: Window, page: TestPage, push: (entry: string) => void) {
  const { document } = window;
  const shorts = document.querySelector('ytd-shorts')!;
  const video = shorts.querySelector<HTMLVideoElement>('#shorts-player video')!;
  const renderer = shorts.querySelector('#reel-overlay-container')!;
  const container = shorts.querySelector('#shorts-container')!;
  let current = page.shorts.findIndex((short) => page.path.endsWith(short.id));

  video.muted = true;
  video.play().catch(() => {});
  video.addEventListener('seeking', () => {
    if (video.currentTime < 0.5) push(`Short ${current + 1} started over`);
  });

  const next = () => {
    // YouTube takes a moment to fetch and swap in the next Short.
    setTimeout(() => {
      const following = page.shorts[current + 1];
      if (!following) return;
      current += 1;
      const slot = shorts.querySelector(`.reel-video-in-sequence-new[id="${current}"]`)!;
      slot.append(renderer);
      container.scrollTop = (slot as HTMLElement).offsetTop;
      shorts.removeAttribute('is-up-arrow-hidden');
      shorts.querySelector('#navigation-button-up')?.removeAttribute('aria-hidden');
      window.history.pushState(null, '', `/shorts/${following.id}`);
      video.src = following.clip;
      video.play().catch(() => {});
      push(`Short ${current + 1} is current`);
    }, 100);
  };
  shorts.querySelector('#navigation-button-down button')!.addEventListener('click', next);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' && !event.defaultPrevented) next();
  });

  return {
    video,
    playHiddenWatchPlayer() {
      const hidden = document.querySelector<HTMLVideoElement>('#movie_player video')!;
      hidden.muted = true;
      hidden.src = page.shorts[0]!.clip;
      const ended = new Promise<void>((resolve) => hidden.addEventListener('ended', () => resolve(), { once: true }));
      hidden.play().catch(() => {});
      return ended;
    },
  };
}

/** Calls `scrolled` whenever script asks the page to scroll: Shorts Flow never should. */
function watchForScriptedScrolls(window: Window, scrolled: () => void) {
  const frameWindow = window as Window & typeof globalThis;
  const targets: object[] = [frameWindow.Element.prototype, frameWindow];
  for (const target of targets) {
    for (const name of ['scrollIntoView', 'scrollTo', 'scrollBy', 'scroll'] as const) {
      const original = (target as Record<string, unknown>)[name];
      if (typeof original !== 'function') continue;
      Object.defineProperty(target, name, {
        configurable: true,
        value(this: unknown, ...args: unknown[]) {
          scrolled();
          return original.apply(this, args);
        },
      });
    }
  }
}
