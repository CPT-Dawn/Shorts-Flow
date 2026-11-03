import { describe, expect, it } from 'vitest';
import { SITE_PAGE_PATHS, siteUrl, STORE_PAGES } from '@/site/site-links';

// The contract with the shortsflow site (CPT-Dawn.dev, apps/shortsflow): the
// paths it serves, which installed copies keep linking to for good.
const SERVED_PATHS = ['/', '/welcome', '/report', '/goodbye', '/support', '/privacy'];

/** One URL for each page, with every parameter and option it takes. */
const EVERY_URL = [
  siteUrl('home', {}),
  siteUrl('welcome', {}),
  siteUrl('welcome', { v3: true }),
  siteUrl('welcome', { v3: true, version: '3.0.0' }),
  siteUrl('report', { version: '3.0.0', browser: 'firefox', browserVersion: '157.0' }),
  siteUrl('report', { version: '3.0.0' }),
  siteUrl('goodbye', { version: '3.0.0' }),
  siteUrl('support', {}),
  siteUrl('privacy', {}),
];

describe('site links', () => {
  it('declares exactly the pages the site serves', () => {
    expect([...SITE_PAGE_PATHS].sort()).toEqual([...SERVED_PATHS].sort());
  });

  it('only ever links to a declared page on shortsflow.cptdawn.dev', () => {
    for (const href of EVERY_URL) {
      const url = new URL(href);
      expect(url.origin).toBe('https://shortsflow.cptdawn.dev');
      expect(SITE_PAGE_PATHS).toContain(url.pathname);
    }
  });

  it('builds each page with only the parameters it takes', () => {
    expect(EVERY_URL).toEqual([
      'https://shortsflow.cptdawn.dev/',
      'https://shortsflow.cptdawn.dev/welcome',
      'https://shortsflow.cptdawn.dev/welcome#whats-new',
      'https://shortsflow.cptdawn.dev/welcome?version=3.0.0#whats-new',
      'https://shortsflow.cptdawn.dev/report?version=3.0.0&browser=firefox&browserVersion=157.0',
      'https://shortsflow.cptdawn.dev/report?version=3.0.0',
      'https://shortsflow.cptdawn.dev/goodbye?version=3.0.0',
      'https://shortsflow.cptdawn.dev/support',
      'https://shortsflow.cptdawn.dev/privacy',
    ]);
  });

  it('keeps out anything a page does not take', () => {
    const smuggled = { version: '3.0.0', video: 'abc123' } as { version: string };
    expect(siteUrl('goodbye', smuggled)).toBe('https://shortsflow.cptdawn.dev/goodbye?version=3.0.0');
  });

  it('links each store to its own listing, or to nothing yet', () => {
    expect(STORE_PAGES.chrome).toBe(
      'https://chromewebstore.google.com/detail/shorts-flow-auto-scroll-a/kfkkpgeijmfhmdhlcnoecidgceljccdf',
    );
    expect(STORE_PAGES.firefox === '' || STORE_PAGES.firefox.startsWith('https://addons.mozilla.org/')).toBe(true);
  });
});
