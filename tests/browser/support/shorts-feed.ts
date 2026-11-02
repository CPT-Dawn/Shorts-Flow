import { expect, onTestFinished } from 'vitest';
import { userEvent } from 'vitest/browser';
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
  /** How fast the Current Short plays, as the viewer sees it: 1 is normal speed. */
  playbackSpeed(): number;
  /** How fast the hidden watch-page player behind the Shorts Feed would play. */
  hiddenPlayerSpeed(): number;
  /** Pauses the Current Short where it is, as YouTube's pause control does. */
  pause(): void;
  /** Plays the Current Short on from where it was paused, as YouTube's play control does. */
  resume(): void;
  /**
   * Plays a clip to its end in the hidden watch-page player YouTube keeps
   * behind the Shorts Feed. Resolves once it has ended.
   */
  playHiddenWatchPlayer(): Promise<void>;
  /** YouTube fetches one more Short onto the end of the feed, which is how a Stall ends. */
  loadNextShort(): void;
  /** Clicks YouTube's Next video control, as the viewer does to move on by hand. */
  pressNextVideo(): void;
  /** Switches YouTube between its dark and light themes, as its Appearance setting does. */
  setTheme(theme: 'dark' | 'light'): void;
  /**
   * The notice Shorts Flow shows on the page, if one is showing: what it
   * says, its buttons, and the element a viewer sees (for its looks).
   */
  notice(): { text: string; actions: string[]; element: HTMLElement } | undefined;
  /** Presses the notice's button labelled `label`, as the viewer does. */
  pressNoticeAction(label: string): void;
  /**
   * Presses `key` (a `KeyboardEvent.key` value) on the page as the viewer
   * does on a real keyboard, optionally while holding `holding` down. The
   * key goes wherever the focus is on the page.
   */
  pressKey(key: string, options?: { holding?: 'Control' | 'Alt' | 'Meta' | 'Shift' }): Promise<void>;
  /** Clicks into YouTube's search box and types `text` there, leaving the focus in it. */
  typeInSearch(text: string): Promise<void>;
  /** A script on the page makes up a keydown of `key`, as Shorts Flow's own ArrowDown fallback does. */
  pressKeyByScript(key: string): void;
  /**
   * The accessible names of the controls in YouTube's action rail beside the
   * Current Short, top to bottom, as a screen reader would list them.
   */
  railLabels(): string[];
  /** The rail control named `label`, as the viewer finds it, if the rail has one. */
  railControl(label: string): HTMLElement | undefined;
  /**
   * The rail item whose control is named `label`: the control, the whole
   * item (control and caption), and the caption under the control, if any.
   */
  railItem(label: string): { button: HTMLElement; item: Element; caption: HTMLElement | undefined } | undefined;
  /**
   * The tooltip showing on the page, if one is: its text and the element a
   * viewer sees.
   */
  tooltip(): { text: string; element: HTMLElement } | undefined;
  /**
   * Takes away every style YouTube's page has, as if YouTube had renamed all
   * its classes, leaving only what Shorts Flow brings.
   */
  dropYouTubeStyles(): void;
  /** Points at `element` with the mouse, as the viewer does before clicking. */
  hover(element: Element): void;
  /** Moves the mouse away from `element` again. */
  unhover(element: Element): void;
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
    playbackSpeed: () => youtube.video.playbackRate,
    hiddenPlayerSpeed: () => document.querySelector<HTMLVideoElement>('#movie_player video')!.playbackRate,
    pause() {
      youtube.video.pause();
    },
    resume() {
      void youtube.video.play().catch(() => {});
    },
    playHiddenWatchPlayer: youtube.playHiddenWatchPlayer,
    loadNextShort: youtube.loadNextShort,
    pressNextVideo() {
      document.querySelector<HTMLButtonElement>('#navigation-button-down button')!.click();
    },
    setTheme(theme) {
      document.documentElement.toggleAttribute('dark', theme === 'dark');
    },
    notice: () => findNotice(document),
    pressNoticeAction(label) {
      const notice = findNotice(document);
      const button = notice && [...notice.element.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);
      if (!button) throw new Error(`No notice with a "${label}" button is showing`);
      button.click();
    },
    async pressKey(key, { holding } = {}) {
      focusPage(window);
      const name = key === ' ' ? '{Space}' : key.length === 1 ? key : `{${key}}`;
      await userEvent.keyboard(holding ? `{${holding}>}${name}{/${holding}}` : name);
    },
    async typeInSearch(text) {
      focusPage(window);
      document.querySelector<HTMLInputElement>('input[name="search_query"]')!.focus();
      await userEvent.keyboard(text);
    },
    pressKeyByScript(key) {
      (document.activeElement ?? document.body).dispatchEvent(
        new (window as Window & typeof globalThis).KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }),
      );
    },
    railLabels: () => railControls(document).map(({ label }) => label),
    railControl: (label) => railControls(document).find((control) => control.label === label)?.element,
    railItem(label) {
      const control = railControls(document).find((control) => control.label === label);
      if (!control) return undefined;
      const caption = control.item.querySelector<HTMLElement>('.ytSpecButtonShapeWithLabelLabel') ?? undefined;
      return { button: control.element, item: control.item, caption };
    },
    tooltip() {
      const tooltip = [...document.querySelectorAll<HTMLElement>('[role="tooltip"]')].find(
        (element) =>
          element.getBoundingClientRect().width > 0 && element.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
      );
      return tooltip && { text: (tooltip.textContent ?? '').trim(), element: tooltip };
    },
    dropYouTubeStyles() {
      for (const style of document.querySelectorAll('style, link[rel="stylesheet"]')) {
        if (!style.closest('[data-shorts-flow]') && !(style as HTMLElement).dataset.shortsFlow) style.remove();
      }
    },
    hover(element) {
      for (const type of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter']) {
        element.dispatchEvent(new (window as Window & typeof globalThis).PointerEvent(type, { bubbles: !type.endsWith('enter'), composed: true }));
      }
    },
    unhover(element) {
      for (const type of ['pointerout', 'pointerleave', 'mouseout', 'mouseleave']) {
        element.dispatchEvent(new (window as Window & typeof globalThis).PointerEvent(type, { bubbles: !type.endsWith('leave'), composed: true }));
      }
    },
    unmountEngine,
  };
}

/** Puts the keyboard focus into the test page's frame, where a viewer's keys would go. */
function focusPage(window: Window) {
  (window.frameElement as HTMLIFrameElement).focus();
  window.focus();
}

/**
 * The controls in the action rail of the Current Short, as a screen reader
 * finds them: each rail item's button (or link acting as one), named by its
 * aria-label.
 */
function railControls(document: Document) {
  const rail = document.querySelector('ytd-reel-video-renderer reel-action-bar-view-model');
  if (!rail) return [];
  return [...rail.children].flatMap((item) => {
    const element = item.querySelector<HTMLElement>('button, [role="button"]');
    const label = element?.getAttribute('aria-label');
    return element && label ? [{ label, element, item }] : [];
  });
}

/**
 * Stands in for YouTube's Shorts player and feed. The Shorts Feed keeps one
 * renderer and one looping `<video>` for every Short: moving on puts the
 * renderer into the next slot, builds its action rail afresh, gives the video
 * the next Short's clip, and changes the address to the next Short's. YouTube never moves on by itself.
 */
function playLikeYouTube(window: Window, page: TestPage, push: (entry: string) => void) {
  const { document } = window;
  const shorts = document.querySelector('ytd-shorts')!;
  const video = shorts.querySelector<HTMLVideoElement>('#shorts-player video')!;
  const renderer = shorts.querySelector('#reel-overlay-container')!;
  const container = shorts.querySelector('#shorts-container')!;
  // YouTube builds the action rail afresh for every Short.
  const freshRail = shorts.querySelector('reel-action-bar-view-model')!.cloneNode(true);
  // YouTube adds Shorts to the end of the feed as it fetches them.
  const feed = [...page.shorts];
  let current = feed.findIndex((short) => page.path.endsWith(short.id));

  video.muted = true;
  video.play().catch(() => {});
  video.addEventListener('seeking', () => {
    if (video.currentTime < 0.5) push(`Short ${current + 1} started over`);
  });

  const next = () => {
    // YouTube takes a moment to fetch and swap in the next Short.
    setTimeout(() => {
      const following = feed[current + 1];
      if (!following) return;
      current += 1;
      const slot = shorts.querySelector(`.reel-video-in-sequence-new[id="${current}"]`)!;
      slot.append(renderer);
      renderer.querySelector('reel-action-bar-view-model')!.replaceWith(freshRail.cloneNode(true));
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
    loadNextShort() {
      const slots = shorts.querySelectorAll('.reel-video-in-sequence-new');
      const last = slots[slots.length - 1]!;
      const slot = last.cloneNode(false) as Element;
      slot.id = String(slots.length);
      last.after(slot);
      const id = `vid${String(feed.length + 1).padStart(8, '0')}`;
      feed.push({ id, clip: page.shorts[feed.length % page.shorts.length]?.clip ?? page.shorts[0]!.clip });
    },
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

/**
 * A notice on the page as the viewer finds it: a visible status message,
 * whether in the page itself or inside an element's shadow root.
 */
function findNotice(document: Document) {
  const roots: (Document | ShadowRoot)[] = [document];
  for (const element of document.querySelectorAll('*')) if (element.shadowRoot) roots.push(element.shadowRoot);
  for (const root of roots) {
    for (const element of root.querySelectorAll<HTMLElement>('[role="status"]')) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || !element.checkVisibility({ visibilityProperty: true })) continue;
      const actions = [...element.querySelectorAll('button')].map((button) => button.textContent?.trim() ?? '');
      const withoutButtons = element.cloneNode(true) as HTMLElement;
      for (const button of withoutButtons.querySelectorAll('button')) button.remove();
      const text = (withoutButtons.textContent ?? '').replace(/\s+/g, ' ').trim();
      return { text, actions, element };
    }
  }
  return undefined;
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
