import type { Feed } from './feed';
import { createStallNotice } from './stall';
import { advanceFeed, feedPosition, hasMoved, watchFeedPosition, type FeedPosition } from './youtube';

/**
 * How long YouTube gets to move the feed off a Short after an Advance, in ms.
 * Still on that Short when it runs out, the Advance has Stalled.
 */
const ADVANCE_WAIT = 3000;

/**
 * Makes `feed.advance`: one Advance per Short, through YouTube's own
 * navigation (see `advanceFeed`). YouTube takes a moment to move on, and the
 * Short may loop in the meantime; asking again from the same Short within
 * `ADVANCE_WAIT` does nothing, so it never skips a Short.
 *
 * "The same Short" is the feed's whole position (see `FeedPosition`): its
 * address, the slot holding YouTube's renderer, and the slot on screen.
 * The address alone won't do, since whether it changes for a Sponsored Short
 * is unconfirmed: keyed on it, the skip asked from a Sponsored Short reached
 * by an Advance would be taken for that Advance again and dropped, and the
 * wait would end in a false Stall.
 *
 * If the feed is still in the same position when the wait runs out, that is
 * a Stall: the Stall notice offers the viewer a retry. Nothing reloads or
 * scrolls the page. A later Advance from that Short may try again.
 */
export function createAdvance(
  feed: Pick<Feed, 'document' | 'signal' | 'setTimeout' | 'clearTimeout' | 'getMessage'>,
): () => void {
  const stallNotice = createStallNotice(feed);
  let pending: { from: FeedPosition; timer: number } | undefined;

  const advance = ({ retry = false } = {}) => {
    const from = feedPosition(feed.document);
    if (pending && !hasMoved(pending.from, from) && !retry) return;
    if (pending) feed.clearTimeout(pending.timer);
    const timer = feed.setTimeout(() => {
      if (pending?.timer !== timer) return;
      pending = undefined;
      if (!hasMoved(from, feedPosition(feed.document))) stallNotice.show(() => advance({ retry: true }));
    }, ADVANCE_WAIT);
    pending = { from, timer };
    advanceFeed(feed.document);
  };

  // The moment the feed moves, the Advance has done its job, and the wait is
  // over. Left waiting, a viewer who comes back to the same Short in the
  // meantime (down past it, then up again) would find their next Advance
  // dropped, and the wait would end in a false Stall.
  watchFeedPosition(
    feed.document,
    (now) => {
      if (!pending || !hasMoved(pending.from, now)) return;
      feed.clearTimeout(pending.timer);
      pending = undefined;
    },
    feed.signal,
  );

  return () => advance();
}
