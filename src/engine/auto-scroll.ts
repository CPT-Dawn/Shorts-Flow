import type { Feature } from './feed';
import { watchShortEnds } from './short-end';

/**
 * Auto-Scroll: when the Current Short ends, Advance to the next one, while
 * the setting is on. The setting is read at that moment, so switching it in
 * any tab or the Popup takes effect at the very next end.
 *
 * Holds (#8) slot in here: a Short that ends while one applies is not
 * Advanced, and simply plays again.
 */
export const autoScroll: Feature = (feed) => {
  watchShortEnds(feed, () => {
    if (feed.settings()?.autoScroll) feed.advance();
  });
};
