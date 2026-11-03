import type { Feed } from './feed';
import { isFeedNavigation, isMenuOrDialogOpen, isPanelOpen, shortsVideo } from './youtube';

/**
 * Holds: the moments the viewer has stepped in, when Auto-Scroll must not
 * Advance a Short that ends. The Short simply plays again, and Advancing
 * resumes at the first end after the Hold is over. They are:
 * - the Short is paused;
 * - the comments or description panel is open;
 * - a YouTube menu or dialog is open (and anything Shorts Flow adds with
 *   `holdWhile`, such as the Shorts Control's own menu);
 * - focus is in a field the viewer types into;
 * - the viewer moved the feed by hand a few seconds ago.
 *
 * A background tab is not a Hold: a Short playing there Advances as usual.
 *
 * Each is read from the page when a Short ends. Only a manual scroll needs
 * remembering, for one visit to the Shorts Feed.
 */

/** Something the viewer is doing: true while it should hold the feed. */
export type Hold = () => boolean;

/** How long a manual scroll holds the feed, in ms on the engine's monotonic clock. */
const MANUAL_SCROLL_HOLD = 3000;

/**
 * Keys that move the Shorts Feed or scroll the page. Not Space: on the Shorts
 * Feed it plays and pauses the Current Short, and a pause is a Hold of its
 * own, while playing on must not hold anything.
 */
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']);

/** Inputs that take a click or a choice, not typing. */
const NOT_TYPED = new Set(['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit']);

const holdsByFeed = new WeakMap<Feed, Set<Hold>>();

/**
 * Starts watching for Holds on this visit to the Shorts Feed (a manual scroll
 * must be seen as it happens to be remembered), and returns the check:
 * whether a Hold applies right now. A feature that checks Holds calls this
 * once as it mounts, and the check as often as it likes.
 */
export function watchHolds(feed: Feed): () => boolean {
  const holds = holdsOf(feed);
  return () => {
    for (const hold of holds) if (hold()) return true;
    return false;
  };
}

/**
 * Adds a Hold for this visit to the Shorts Feed: while `hold` returns true, no
 * Short Advances. For Shorts Flow's own interface, such as the Shorts
 * Control's menu, which lives in a shadow root the menu check can't see.
 * Returns a function that removes it; it goes anyway when the visit ends.
 */
export function holdWhile(feed: Feed, hold: Hold): () => void {
  const holds = holdsOf(feed);
  holds.add(hold);
  return () => holds.delete(hold);
}

function holdsOf(feed: Feed): Set<Hold> {
  let holds = holdsByFeed.get(feed);
  if (!holds) {
    const { document } = feed;
    let scrolledByHandAt: number | undefined;
    watchManualNavigation(feed, () => (scrolledByHandAt = feed.clock.monotonic()));
    holds = new Set<Hold>([
      // YouTube loops Shorts, so a paused one was paused by the viewer.
      () => isPaused(shortsVideo(document)),
      () => isPanelOpen(document),
      () => isMenuOrDialogOpen(document),
      () => isTyping(document),
      () => scrolledByHandAt !== undefined && feed.clock.monotonic() - scrolledByHandAt < MANUAL_SCROLL_HOLD,
    ]);
    holdsByFeed.set(feed, holds);
  }
  return holds;
}

/**
 * Calls `moved` whenever the viewer moves the feed by hand, for as long as
 * the visit lasts: the wheel, a swipe, a scroll key, or YouTube's Previous
 * and Next video controls, whether or not there is a Short to move to. Only
 * the viewer's own (trusted) events count, so Shorts Flow's own Advance,
 * which clicks Next video or sends ArrowDown from script, never does; nor
 * does a key pressed in Shorts Flow's own interface (ArrowDown in its menu).
 */
export function watchManualNavigation(feed: Pick<Feed, 'document' | 'signal'>, moved: () => void): void {
  const onEvent = (event: Event) => {
    if (!event.isTrusted) return;
    if (event.type === 'keydown' && !isScrollKey(event as KeyboardEvent, feed.document)) return;
    if (event.type === 'click' && !isFeedNavigation(event.target)) return;
    moved();
  };
  for (const type of ['wheel', 'touchmove', 'keydown', 'click']) {
    feed.document.addEventListener(type, onEvent, { capture: true, passive: true, signal: feed.signal });
  }
}

function isScrollKey(event: KeyboardEvent, document: Document) {
  if (event.ctrlKey || event.altKey || event.metaKey) return false;
  if (isShortsFlowOwn(event.target)) return false;
  return SCROLL_KEYS.has(event.key) && !isTyping(document);
}

/** Whether `target` is part of Shorts Flow's own interface on the page (it carries `data-shorts-flow`). */
function isShortsFlowOwn(target: EventTarget | null) {
  const element = target as Element | null;
  return typeof element?.closest === 'function' && element.closest('[data-shorts-flow]') !== null;
}

function isPaused(video: HTMLVideoElement | undefined) {
  return video !== undefined && video.paused && !video.ended;
}

/**
 * Whether focus is in a field the viewer types into, inside shadow roots too.
 * Shortcuts ask it as well, so a key typed into a comment never toggles anything.
 */
export function isTyping(document: Document) {
  let focused = document.activeElement;
  while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
  if (!focused) return false;
  if ((focused as HTMLElement).isContentEditable || focused.localName === 'textarea') return true;
  return focused.localName === 'input' && !NOT_TYPED.has((focused as HTMLInputElement).type);
}
