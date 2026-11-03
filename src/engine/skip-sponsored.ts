import type { Feature } from './feed';
import { isSponsoredShort, slotIndex, watchFeedPosition, type FeedPosition } from './youtube';

/**
 * Skip Sponsored Shorts: a Sponsored Short is Advanced past as soon as it
 * becomes the Current Short on the way down the Shorts Feed, while the
 * setting is on, whether Auto-Scroll is on or off. It skips the Short
 * through YouTube's own Next video control; it hides and blocks nothing, and
 * the ad is still YouTube's to show.
 *
 * Only on the way down. A viewer who goes back up onto a Sponsored Short
 * (from the Short after it, towards the one before) is left on it: an
 * Advance would push them straight back down where they came from, and the
 * Short before it could never be reached. Their next move up passes it, as
 * it would any Short. Going back is the viewer's own choice, and Shorts Flow
 * never moves the feed up.
 *
 * Switching the setting on while a Sponsored Short is current skips it too,
 * whichever way the viewer came: they have just asked for it.
 *
 * It asks for one Advance per arrival at a slot. YouTube may update the
 * address, the renderer and the scroll at different moments as it moves on,
 * and each would look like a fresh arrival to Advance; should that one
 * Advance Stall, the Stall notice's Retry is the way on.
 */
export const skipSponsoredShorts: Feature = (feed) => {
  let position: FeedPosition | undefined;
  // Which way the feed last moved between slots: down until known otherwise.
  let cameUp = false;
  // The slot a skip was asked from, until the feed moves to another.
  let skippedAt: number | undefined;
  // Only switching this setting on, not a change to any other, overrides the way up.
  let wasOn: boolean | undefined;

  const skip = () => {
    if (!position || !isSponsoredShort(position)) return;
    skippedAt = slotIndex(position);
    feed.advance();
  };

  /** Skips the Current Short if it is sponsored, reached on the way down, and not skipped from already. */
  const check = () => {
    if (!feed.settings()?.skipSponsoredShorts || cameUp) return;
    const at = position && slotIndex(position);
    if (at === undefined || at !== skippedAt) skip();
  };

  watchFeedPosition(
    feed.document,
    (now) => {
      const from = position && slotIndex(position);
      const to = slotIndex(now);
      if (from !== undefined && to !== undefined && from !== to) {
        cameUp = to < from;
        skippedAt = undefined;
      }
      position = now;
      check();
    },
    feed.signal,
  );
  feed.watchSettings((settings) => {
    const switchedOn = settings.skipSponsoredShorts && wasOn === false;
    const firstKnown = wasOn === undefined;
    wasOn = settings.skipSponsoredShorts;
    if (switchedOn) skip();
    else if (firstKnown) check();
  });
};
