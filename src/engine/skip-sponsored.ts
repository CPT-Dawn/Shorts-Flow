import type { Feature } from './feed';
import { isSponsoredShort, watchFeedPosition, type FeedPosition } from './youtube';

/**
 * Skip Sponsored Shorts: a Sponsored Short is Advanced past as soon as it
 * becomes the Current Short, while the setting is on, whether Auto-Scroll is
 * on or off. It skips the Short; it blocks nothing, and the ad is still
 * YouTube's to show.
 *
 * Switching the setting on while a Sponsored Short is current skips it too.
 */
export const skipSponsoredShorts: Feature = (feed) => {
  let position: FeedPosition | undefined;
  const check = () => {
    if (feed.settings()?.skipSponsoredShorts && position && isSponsoredShort(position)) feed.advance();
  };
  watchFeedPosition(
    feed.document,
    (now) => {
      position = now;
      check();
    },
    feed.signal,
  );
  feed.watchSettings(check);
};
