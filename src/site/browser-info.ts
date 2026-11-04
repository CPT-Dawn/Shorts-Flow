// The browser's name and version, which the Report link pre-fills so a viewer
// doesn't have to look them up. Nothing else about the browser or the viewer.
// Only the Popup and the background script can read this; content scripts
// can't call Firefox's getBrowserInfo.
import { browser as webext } from 'wxt/browser';

export interface BrowserInfo {
  /** In lower case, e.g. "chrome", "edge" or "firefox". */
  browser?: string;
  browserVersion?: string;
}

interface UserAgentBrand {
  brand: string;
  version: string;
}

/** Where the name and version come from: injectable so tests can stand in. */
export interface BrowserSources {
  /** Firefox's runtime has getBrowserInfo; Chromium's doesn't. */
  runtime: { getBrowserInfo?(): Promise<{ name: string; version: string }> };
  navigator: { userAgentData?: { brands: readonly UserAgentBrand[] } };
}

/**
 * The Chromium browsers that install from the Chrome Web Store, by the brand
 * each reports. Vivaldi reports only Chromium's.
 */
const CHROMIUM_BRANDS: Record<string, string> = {
  'Google Chrome': 'chrome',
  'Microsoft Edge': 'edge',
  Brave: 'brave',
  Opera: 'opera',
};

const defaultSources = (): BrowserSources => ({
  runtime: webext.runtime as BrowserSources['runtime'],
  navigator: globalThis.navigator as BrowserSources['navigator'],
});

/** The browser's name and version, or neither when the browser won't say. */
export async function readBrowser(sources: BrowserSources = defaultSources()): Promise<BrowserInfo> {
  const { runtime, navigator } = sources;
  if (runtime.getBrowserInfo) {
    const { name, version } = await runtime.getBrowserInfo();
    return { browser: name.toLowerCase(), browserVersion: version };
  }
  const brands = navigator.userAgentData?.brands ?? [];
  const known = brands.find(({ brand }) => brand in CHROMIUM_BRANDS);
  if (known) return { browser: CHROMIUM_BRANDS[known.brand], browserVersion: known.version };
  const chromium = brands.find(({ brand }) => brand === 'Chromium');
  if (chromium) return { browser: 'chromium', browserVersion: chromium.version };
  return {};
}
