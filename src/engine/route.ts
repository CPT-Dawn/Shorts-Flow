import type { Clock } from './engine';
import { isShortsFeed } from './youtube';

/**
 * How often to check which page YouTube is on, in ms. It changes pages
 * without a page load; polling the address on the engine's clock catches
 * every way it does so, and lets tests step through it.
 */
const CHECK_INTERVAL = 500;

/**
 * The Route watcher: calls `visit` whenever the page becomes the Shorts Feed,
 * and the function it returns when the page leaves it. Stops watching, and
 * ends any visit, when `signal` aborts. Off the Shorts Feed nothing but this
 * one timer runs.
 */
export function whileOnShortsFeed(window: Window, clock: Clock, signal: AbortSignal, visit: () => () => void): void {
  let leave: (() => void) | undefined;
  let timer: number | undefined;

  const check = () => {
    const onShortsFeed = isShortsFeed(window.location.pathname);
    if (onShortsFeed && !leave) {
      leave = visit();
    } else if (!onShortsFeed && leave) {
      leave();
      leave = undefined;
    }
    timer = clock.setTimeout(check, CHECK_INTERVAL);
  };

  signal.addEventListener(
    'abort',
    () => {
      if (timer !== undefined) clock.clearTimeout(timer);
      leave?.();
      leave = undefined;
    },
    { once: true },
  );
  check();
}
