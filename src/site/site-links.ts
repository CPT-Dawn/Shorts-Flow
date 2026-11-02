// The one place that builds a URL Shorts Flow opens outside the extension.
// Every link goes to a fixed path on Shorts Flow's own site, so what's behind
// it can change without shipping an update (Reels Flow ADR 0002 is the
// precedent). Installed copies keep these URLs for good: paths may be added
// here, and to the site, but never renamed or removed.

const SITE = 'https://shortsflow.cptdawn.dev';

/** The id of the Welcome Page's "What's new in 3.0" section. */
const V3_ANCHOR = 'whats-new';

/** The values each page on the site takes. Nothing else gets into its URL. */
interface Params {
  home: Record<never, never>;
  /** `v3` opens the page at its "What's new in 3.0" section. */
  welcome: { v3?: boolean };
  report: { version: string; browser?: string; browserVersion?: string };
  goodbye: { version: string };
  support: Record<never, never>;
  privacy: Record<never, never>;
}

/** A page on Shorts Flow's site. */
export type SitePage = keyof Params;

/** Each page's path, and the query parameters it takes, in order. */
const PAGES = {
  home: { path: '/', query: [] },
  welcome: { path: '/welcome', query: [] },
  report: { path: '/report', query: ['version', 'browser', 'browserVersion'] },
  goodbye: { path: '/goodbye', query: ['version'] },
  support: { path: '/support', query: [] },
  privacy: { path: '/privacy', query: [] },
} as const satisfies { [P in SitePage]: { path: string; query: readonly (keyof Params[P])[] } };

/**
 * Every path the site must serve for the extension's links to work. The
 * shortsflow site's routes match this list exactly.
 */
export const SITE_PAGE_PATHS: readonly string[] = Object.values(PAGES).map(({ path }) => path);

/** The URL of `page` on Shorts Flow's site, carrying only the parameters it takes. */
export function siteUrl<P extends SitePage>(page: P, params: Params[P]): string {
  const { path, query } = PAGES[page];
  const url = new URL(path, SITE);
  for (const name of query as readonly (keyof Params[P])[]) {
    const value = params[name];
    if (value !== undefined && value !== '') url.searchParams.set(String(name), String(value));
  }
  if (page === 'welcome' && (params as Params['welcome']).v3) url.hash = V3_ANCHOR;
  return url.href;
}

/**
 * Shorts Flow's store listings. Edge, Brave, Opera and Vivaldi install from
 * the Chrome Web Store (ADR 0004). An empty URL means not listed yet.
 */
export const STORE_PAGES: Readonly<Record<'chrome' | 'firefox', string>> = {
  chrome: 'https://chromewebstore.google.com/detail/shorts-flow-auto-scroll-a/kfkkpgeijmfhmdhlcnoecidgceljccdf',
  firefox: '',
};
