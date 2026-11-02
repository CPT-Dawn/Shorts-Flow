// How the Popup learns whether the tab it opened over is on the Shorts Feed.
// Without the `tabs` permission the Popup can't read a tab's address, but it
// can find the active tab and ask it: only Shorts Flow's own content script,
// which runs on youtube.com alone, can answer. No answer means no.
import { browser } from 'wxt/browser';
import { isShortsFeed } from '@/engine/youtube';

interface FeedStatusRequest {
  type: 'shorts-flow:feed-status';
}

const REQUEST: FeedStatusRequest = { type: 'shorts-flow:feed-status' };

/** Whether the active tab of the Popup's window is on the Shorts Feed. Runs in the Popup. */
export async function isActiveTabOnShortsFeed(): Promise<boolean> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return false;
    return (await browser.tabs.sendMessage(tab.id, REQUEST)) === true;
  } catch {
    // No content script of Shorts Flow's is listening there: not youtube.com,
    // a tab opened before Shorts Flow was installed, or access turned off.
    return false;
  }
}

/** Answers the Popup's question from `window`'s address until `signal` aborts. Runs in the content script. */
export function answerFeedStatus(window: Window, signal: AbortSignal): void {
  const listener = (message: unknown, _sender: unknown, sendResponse: (response: boolean) => void) => {
    if ((message as Partial<FeedStatusRequest> | null)?.type !== REQUEST.type) return;
    sendResponse(isShortsFeed(window.location.pathname));
  };
  browser.runtime.onMessage.addListener(listener);
  signal.addEventListener(
    'abort',
    () => {
      try {
        browser.runtime.onMessage.removeListener(listener);
      } catch {
        // The extension was updated or removed: its listeners are gone already.
      }
    },
    { once: true },
  );
}
