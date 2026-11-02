import type { Feed } from './feed';
import { watchManualNavigation } from './holds';
import { createToast } from './toast';
import { currentShortId, isShortsVideo } from './youtube';

/** The Stall notice: shown when an Advance found no next Short. */
export type StallNotice = {
  /** Shows the notice; its Retry button calls `retry`. */
  show(retry: () => void): void;
  hide(): void;
};

/**
 * The quiet notice of a Stall: a toast in YouTube's style saying the next
 * Short couldn't be found, with a Retry button. Nothing else happens: the
 * page is never reloaded or scrolled, and the Current Short plays on.
 *
 * It clears itself as soon as the feed is on another Short, whether a later
 * Advance got there or the viewer moved by hand; as soon as the viewer
 * navigates by hand at all, even with no Short to move to; and when the
 * visit ends.
 */
export function createStallNotice(
  feed: Pick<Feed, 'document' | 'signal' | 'setTimeout' | 'clearTimeout' | 'getMessage'>,
): StallNotice {
  const toast = createToast(feed, 'stall-notice');
  let stalledOn: string | undefined;

  const hide = () => toast.hide();

  // The Shorts video reports as it plays and as it loads another Short, so
  // these see the feed move on however it does.
  const checkStillStalled = (event: Event) => {
    if (toast.shown && isShortsVideo(event.target) && currentShortId(feed.document) !== stalledOn) hide();
  };
  for (const type of ['loadstart', 'playing', 'timeupdate']) {
    feed.document.addEventListener(type, checkStillStalled, { capture: true, signal: feed.signal });
  }
  // The viewer has taken over: the notice has said its piece.
  watchManualNavigation(feed, () => {
    if (toast.shown) hide();
  });

  return {
    show(retry) {
      stalledOn = currentShortId(feed.document);
      toast.show(feed.getMessage('stallNotice'), {
        action: {
          label: feed.getMessage('stallRetry'),
          onPress: () => {
            hide();
            retry();
          },
        },
      });
    },
    hide,
  };
}
