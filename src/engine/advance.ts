import type { Feed } from './feed';
import { createStallNotice } from './stall';
import { advanceFeed, currentShortId } from './youtube';

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
 * If the feed is still on the same Short when the wait runs out, that is a
 * Stall: the Stall notice offers the viewer a retry. Nothing reloads or
 * scrolls the page. A later Advance from that Short may try again.
 */
export function createAdvance(
  feed: Pick<Feed, 'document' | 'signal' | 'setTimeout' | 'clearTimeout' | 'getMessage'>,
): () => void {
  const stallNotice = createStallNotice(feed);
  let pending: { from: string | undefined; timer: number } | undefined;

  const advance = ({ retry = false } = {}) => {
    const from = currentShortId(feed.document);
    if (pending && pending.from === from && !retry) return;
    if (pending) feed.clearTimeout(pending.timer);
    const timer = feed.setTimeout(() => {
      if (pending?.timer !== timer) return;
      pending = undefined;
      if (currentShortId(feed.document) === from) stallNotice.show(() => advance({ retry: true }));
    }, ADVANCE_WAIT);
    pending = { from, timer };
    advanceFeed(feed.document);
  };

  return () => advance();
}
