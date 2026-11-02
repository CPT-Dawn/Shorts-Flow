import type { Feature } from './feed';
import { watchHolds } from './holds';
import { watchShortEnds } from './short-end';

/**
 * Auto-Scroll: when the Current Short ends, Advance to the next one, while
 * the setting is on and no Hold applies. Both are read at that moment, so
 * switching the setting in any tab or the Popup, or a Hold ending, takes
 * effect at the very next end. A Short that ends during a Hold simply plays
 * again.
 */
export const autoScroll: Feature = (feed) => {
  const isHeld = watchHolds(feed);
  watchShortEnds(feed, () => {
    if (feed.settings()?.autoScroll && !isHeld()) feed.advance();
  });
};
