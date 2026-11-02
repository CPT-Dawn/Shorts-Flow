import type { Feature } from './feed';
import { isSponsoredShort, watchShortsFeed } from './youtube';

/**
 * Skip Sponsored Shorts: a Sponsored Short is Advanced past as soon as it
 * becomes the Current Short, while the setting is on, whether Auto-Scroll is
 * on or off. It skips the Short; it blocks nothing, and the ad is still
 * YouTube's to show.
 *
 * Switching the setting on while a Sponsored Short is current skips it too.
 */
export const skipSponsoredShorts: Feature = (feed) => {
  const check = () => {
    if (feed.settings()?.skipSponsoredShorts && isSponsoredShort(feed.document)) feed.advance();
  };
  watchShortsFeed(feed.document, check, feed.signal);
  feed.watchSettings(check);
};
