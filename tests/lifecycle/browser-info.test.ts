import { describe, expect, it } from 'vitest';
import { readBrowser } from '@/site/browser-info';

const brands = (...list: [string, string][]) => ({
  userAgentData: { brands: list.map(([brand, version]) => ({ brand, version })) },
});

describe('the browser a Report link names', () => {
  it('is Firefox and its version, as Firefox reports them', async () => {
    const runtime = { getBrowserInfo: async () => ({ name: 'Firefox', version: '157.0', vendor: 'Mozilla' }) };

    expect(await readBrowser({ runtime, navigator: {} })).toEqual({ browser: 'firefox', browserVersion: '157.0' });
  });

  it('is the Chromium browser the viewer runs, by its brand', async () => {
    const navigator = brands(['Not)A;Brand', '24'], ['Chromium', '156'], ['Microsoft Edge', '156']);

    expect(await readBrowser({ runtime: {}, navigator })).toEqual({ browser: 'edge', browserVersion: '156' });
  });

  it('is plain Chromium when the browser names no brand of its own', async () => {
    const navigator = brands(['Not)A;Brand', '24'], ['Chromium', '156']);

    expect(await readBrowser({ runtime: {}, navigator })).toEqual({ browser: 'chromium', browserVersion: '156' });
  });

  it('is left out when the browser says nothing', async () => {
    expect(await readBrowser({ runtime: {}, navigator: {} })).toEqual({});
  });
});
