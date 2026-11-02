import { onTestFinished } from 'vitest';

/** One anonymised Shorts Feed page in tests/pages/, as tests/pages/<name>/test-page.json describes it. */
export type TestPage = {
  name: string;
  description: string;
  /** Its own Shorts address, where it opens. */
  path: string;
  /** The window size it was captured in. */
  viewport: { width: number; height: number };
  /** Every Short slot, top to bottom, with the clip it plays, and `sponsored` on a Sponsored Short. */
  shorts: { id: string; clip: string; sponsored?: true }[];
};

export const testPages: TestPage[] = Object.entries(
  import.meta.glob<Omit<TestPage, 'name'>>('../../pages/*/test-page.json', { eager: true, import: 'default' }),
).map(([file, page]) => ({ ...page, name: file.split('/').at(-2)! }));

/** Whether YouTube has a next Short to move on to from where `page` opens (not so on the Stall page). */
export function hasNextShort(page: TestPage): boolean {
  const current = page.shorts.findIndex((short) => page.path.endsWith(short.id));
  return current >= 0 && current < page.shorts.length - 1;
}

/** The number (from 1) of the first Sponsored Short on `page`, or undefined if it has none. */
export function sponsoredShort(page: TestPage): number | undefined {
  const index = page.shorts.findIndex((short) => short.sponsored);
  return index >= 0 ? index + 1 : undefined;
}

/** The page exactly as committed, for scanning. */
export async function pageSource(page: TestPage) {
  const response = await fetch(`${page.path}?test-page=${page.name}`);
  return response.text();
}

/**
 * Opens a test page at its own Shorts address, in a frame the size of the
 * window it was captured in. The frame is removed when the test finishes.
 */
export async function openTestPage(page: TestPage) {
  const frame = document.createElement('iframe');
  frame.style.cssText = `border: 0; width: ${page.viewport.width}px; height: ${page.viewport.height}px;`;
  const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
  frame.src = `${page.path}?test-page=${page.name}`;
  document.body.append(frame);
  await loaded;
  const window = frame.contentWindow!;
  // The address bar shows the Shorts address, as on YouTube.
  window.history.replaceState(null, '', page.path);
  const close = () => frame.remove();
  onTestFinished(close);
  return { window, document: window.document, close };
}
