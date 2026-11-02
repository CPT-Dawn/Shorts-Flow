import type { Feed } from './feed';
import { followTheme } from './youtube-look';

/** Something of Shorts Flow's own placed on YouTube's page. */
export type OnPage = {
  /** The element in YouTube's page. */
  host: HTMLElement;
  /** Where its content and styles go, apart from YouTube's. */
  root: ShadowRoot;
};

/**
 * Places an element of Shorts Flow's own on the Shorts Feed (a toast, a
 * notice over the player, ...) and takes it away again when the visit ends.
 *
 * Its content lives in a shadow root, so YouTube's styles never reach it and
 * its own never leak into YouTube's page. The host's `data-theme` follows
 * YouTube's theme (`dark` or `light`), so its styles pick their Native Look
 * colours with `:host([data-theme="dark"])`.
 *
 * Keys and clicks inside it stop at the host: YouTube's own shortcuts (Space
 * to pause, ArrowDown to move on) never see a key meant for Shorts Flow.
 */
export function placeOnPage(
  feed: Pick<Feed, 'document' | 'signal'>,
  name: string,
  { parent = feed.document.body, css }: { parent?: Element; css: string },
): OnPage {
  const { document, signal } = feed;
  const host = document.createElement('div');
  host.dataset.shortsFlow = name;
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  root.append(style);

  followTheme(document, host, signal);

  for (const type of ['keydown', 'keyup', 'keypress', 'click', 'dblclick']) {
    host.addEventListener(type, (event) => event.stopPropagation(), { signal });
  }

  parent.append(host);
  signal.addEventListener('abort', () => host.remove(), { once: true });
  return { host, root };
}
