import { browser } from 'wxt/browser';

/**
 * Shorts Flow's access to youtube.com. Firefox lets the viewer turn it off in
 * about:addons, after which the content script never runs and nothing happens
 * on Shorts; the Popup says so and offers to turn it back on.
 */
export interface HostAccess {
  isGranted(): Promise<boolean>;
  /**
   * Asks the browser to turn the access back on. Call it straight from the
   * viewer's click, with nothing awaited first, or the browser refuses.
   * Resolves to whether the access is on now.
   */
  request(): Promise<boolean>;
  /** Calls `listener` whenever the access is turned on or off. Returns a function that stops watching. */
  watch(listener: (granted: boolean) => void): () => void;
}

/** The content script's match, which is all the host access Shorts Flow asks for. */
const YOUTUBE = { origins: ['https://www.youtube.com/*'] };

/**
 * The browser's own record of the access, in the Firefox build. Undefined in
 * the Chrome build: Chromium browsers grant the content script's match at
 * install, and the viewer limiting it there is a choice the Popup leaves be.
 */
export function createHostAccess(): HostAccess | undefined {
  if (import.meta.env.BROWSER !== 'firefox') return undefined;
  return {
    isGranted: () => browser.permissions.contains(YOUTUBE),
    request: () => browser.permissions.request(YOUTUBE),
    watch(listener) {
      const changed = () => void browser.permissions.contains(YOUTUBE).then(listener);
      browser.permissions.onAdded.addListener(changed);
      browser.permissions.onRemoved.addListener(changed);
      return () => {
        browser.permissions.onAdded.removeListener(changed);
        browser.permissions.onRemoved.removeListener(changed);
      };
    },
  };
}
