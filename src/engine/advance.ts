import type { Feed } from './feed';
import { advanceFeed, currentShortId } from './youtube';

/**
 * How long YouTube gets to move the feed off a Short after an Advance, in ms,
 * before another Advance from that same Short may be asked for. Stall (#10)
 * belongs where this wait runs out with the feed still on that Short.
 */
const ADVANCE_WAIT = 3000;

/**
 * Makes `feed.advance`: one Advance per Short, through YouTube's own
 * navigation (see `advanceFeed`). YouTube takes a moment to move on, and the
 * Short may loop in the meantime; asking again from the same Short within
 * `ADVANCE_WAIT` does nothing, so it never skips a Short.
 */
export function createAdvance(feed: Pick<Feed, 'document' | 'setTimeout' | 'clearTimeout'>): () => void {
  let pending: { from: string | undefined; timer: number } | undefined;

  return () => {
    const from = currentShortId(feed.document);
    if (pending && pending.from === from) return;
    if (pending) feed.clearTimeout(pending.timer);
    const timer = feed.setTimeout(() => {
      if (pending?.timer === timer) pending = undefined;
    }, ADVANCE_WAIT);
    pending = { from, timer };
    advanceFeed(feed.document);
  };
}
