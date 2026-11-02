/**
 * The YouTube adapter: everything Shorts Flow knows about YouTube's pages and
 * their DOM, and the only module that touches it. When YouTube changes its
 * markup, this is the file to repair; nothing else names a YouTube selector.
 *
 * Facts used, from the 2026-11 capture (docs/reference/youtube-shorts-2026-11):
 * - The Shorts Feed lives at /shorts/ and /shorts/<id>, and the address
 *   follows the Current Short. YouTube reaches it without a page load.
 * - The Shorts Feed keeps one player and one looping `<video>` for every
 *   Short: moving on gives the same video the next Short. `ended` never fires.
 * - A hidden watch-page player (`#movie_player`) with a video of its own sits
 *   in the page too, and must never be taken for the Short.
 * - YouTube never moves the feed on by itself. Its Next video control does,
 *   and so does its own ArrowDown key handling.
 * - The dark theme is `dark` on `<html>`, light is its absence. YouTube's theme
 *   variables are empty, so Native Look colours are fixed values per theme.
 *
 * Every function takes the document, because the engine may be mounted onto a
 * document from another window (tests use an iframe). No `instanceof` on DOM
 * classes, for the same reason.
 */

/** Whether `pathname` is a Shorts Feed address: /shorts/ or /shorts/<id>. */
export function isShortsFeed(pathname: string): boolean {
  return /^\/shorts(\/[^/]+)?\/?$/.test(pathname);
}

/** The Current Short's id, from the address, or undefined off the Shorts Feed. */
export function currentShortId(document: Document): string | undefined {
  const pathname = document.defaultView?.location.pathname ?? '';
  return isShortsFeed(pathname) ? /^\/shorts\/([^/]+)/.exec(pathname)?.[1] : undefined;
}

const SHORTS_VIDEO = 'ytd-shorts #shorts-player video.html5-main-video';

/** The Shorts player's video, which plays the Current Short. Never the hidden watch-page player's. */
export function shortsVideo(document: Document): HTMLVideoElement | undefined {
  return document.querySelector<HTMLVideoElement>(SHORTS_VIDEO) ?? undefined;
}

/** Whether `target` (say, a media event's target) is the Shorts player's video. */
export function isShortsVideo(target: EventTarget | null): target is HTMLVideoElement {
  const element = target as Element | null;
  return typeof element?.matches === 'function' && element.matches(SHORTS_VIDEO);
}

const NEXT_SHORT_CONTROL = 'ytd-shorts #navigation-button-down button';

/**
 * Asks YouTube to move the Shorts Feed on to the next Short, the way the
 * viewer would: through its Next video control, or failing that its own
 * ArrowDown key handling. Never scrolls the page itself.
 *
 * The key is dispatched untrusted (`isTrusted` false), so anything watching
 * for the viewer's own keys (Holds, Shortcuts) can tell it apart.
 */
export function advanceFeed(document: Document): void {
  const control = document.querySelector<HTMLButtonElement>(NEXT_SHORT_CONTROL);
  if (control && !control.disabled) {
    control.click();
    return;
  }
  const view = document.defaultView!;
  const target = document.querySelector('ytd-shorts') ?? document.body;
  target.dispatchEvent(
    new view.KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true, composed: true }),
  );
}

/**
 * What marks a Sponsored Short: YouTube's ad slot inside a slot of the Shorts
 * Feed. UNCONFIRMED: no live capture has met a Sponsored Short yet (see
 * docs/reference/youtube-shorts-sponsored-2026-11). The element name comes
 * from public filter lists, whose rules hide a Shorts slot that holds
 * `.ytd-reel-video-renderer > ytd-ad-slot-renderer`. The test-page tool
 * reads this too, to mark the Sponsored Short in a test page.
 */
export const SPONSORED_SHORT_MARK = 'ytd-ad-slot-renderer';

const SHORT_SLOT = '.reel-video-in-sequence-new';

/**
 * Whether the Current Short is a Sponsored Short. Where YouTube puts an ad
 * in the feed is unconfirmed, so this looks in both places it may be: the slot
 * that holds the Shorts renderer (YouTube moves it to the Current Short), and
 * the slot on screen in the middle of the Shorts Feed, in case an ad brings
 * markup of its own instead.
 */
export function isSponsoredShort(document: Document): boolean {
  const shorts = document.querySelector('ytd-shorts');
  if (!shorts) return false;
  const renderer = shorts.querySelector('ytd-reel-video-renderer');
  const current = new Set<Element>();
  const holding = renderer?.closest(SHORT_SLOT) ?? renderer;
  if (holding) current.add(holding);
  const container = shorts.querySelector('#shorts-container');
  if (container) {
    const box = container.getBoundingClientRect();
    const middle = box.top + box.height / 2;
    for (const slot of container.querySelectorAll(SHORT_SLOT)) {
      const { top, bottom } = slot.getBoundingClientRect();
      if (box.height > 0 && top <= middle && middle < bottom) current.add(slot);
    }
  }
  return [...current].some((slot) => slot.querySelector(SPONSORED_SHORT_MARK) !== null);
}

/**
 * Calls `changed` whenever the Shorts Feed may have moved to another Short or
 * filled one in: something added or moved inside it, or it scrolled. Until
 * YouTube has built the Shorts Feed, it waits for it. Stops when `signal` aborts.
 */
export function watchShortsFeed(document: Document, changed: () => void, signal: AbortSignal): void {
  const view = document.defaultView!;
  let observed: Element | undefined;
  const observer = new view.MutationObserver(() => {
    const shorts = document.querySelector('ytd-shorts') ?? undefined;
    if (shorts !== observed) observe(shorts);
    changed();
  });
  const observe = (shorts: Element | undefined) => {
    observer.disconnect();
    observed = shorts;
    // Until YouTube builds the Shorts Feed, watch the whole page for it.
    observer.observe(shorts ?? document.documentElement, { childList: true, subtree: true });
  };
  observe(document.querySelector('ytd-shorts') ?? undefined);
  document.addEventListener(
    'scroll',
    (event) => {
      if ((event.target as Element | null)?.id === 'shorts-container') changed();
    },
    { capture: true, passive: true, signal },
  );
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });
}

/** Whether YouTube is showing its dark theme. */
export function isDarkTheme(document: Document): boolean {
  return document.documentElement.hasAttribute('dark');
}

/**
 * Calls `changed` whenever YouTube switches between its dark and light themes,
 * until `signal` aborts.
 */
export function watchTheme(document: Document, changed: (dark: boolean) => void, signal: AbortSignal): void {
  const view = document.defaultView!;
  const observer = new view.MutationObserver(() => changed(isDarkTheme(document)));
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dark'] });
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });
}
