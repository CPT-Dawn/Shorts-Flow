import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'wxt';

// Builds each store package into a temporary folder and reads back what the
// browser would install. Slow-ish (a real WXT build), so one build per browser.
const BUILD_TIMEOUT = 120_000;

type Manifest = Record<string, any>;

async function buildFor(browser: 'chrome' | 'firefox') {
  const outDir = await mkdtemp(join(tmpdir(), `shorts-flow-${browser}-`));
  await build({ browser, outDir, logger: quietLogger });
  const dir = join(outDir, `${browser}-mv3`);
  const manifest: Manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  const messages = JSON.parse(await readFile(join(dir, '_locales/en/messages.json'), 'utf8'));
  const files = await listFiles(dir);
  return { outDir, manifest, messages, files };
}

async function listFiles(dir: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(join(dir, prefix), { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      return entry.isDirectory() ? listFiles(dir, path) : [path];
    }),
  );
  return nested.flat();
}

const silent = () => {};
const quietLogger = {
  debug: silent,
  log: silent,
  info: silent,
  warn: console.warn,
  error: console.error,
  fatal: console.error,
  success: silent,
  level: 0,
};

const localised = (messages: Record<string, { message: string }>, value: string) =>
  messages[/^__MSG_(\w+)__$/.exec(value)?.[1] ?? '']?.message;

describe('the Chrome package', () => {
  let chrome: Awaited<ReturnType<typeof buildFor>>;
  beforeAll(async () => {
    chrome = await buildFor('chrome');
  }, BUILD_TIMEOUT);
  afterAll(() => chrome && rm(chrome.outDir, { recursive: true, force: true }));

  it('runs in an MV3 service worker and asks only for storage', () => {
    expect(chrome.manifest.manifest_version).toBe(3);
    expect(chrome.manifest.background).toEqual({ service_worker: 'background.js' });
    expect(chrome.manifest.permissions).toEqual(['storage']);
    expect(chrome.manifest.minimum_chrome_version).toMatch(/^\d+$/);
    expect(chrome.manifest.homepage_url).toBe('https://shortsflow.cptdawn.dev/');
  });

  it('reaches YouTube only through its content script', () => {
    expect(chrome.manifest.content_scripts).toEqual([
      expect.objectContaining({ matches: ['https://www.youtube.com/*'] }),
    ]);
    expect(chrome.manifest.host_permissions ?? ['https://www.youtube.com/*']).toEqual([
      'https://www.youtube.com/*',
    ]);
  });

  it('takes its name and description from the English locale', () => {
    expect(chrome.manifest.default_locale).toBe('en');
    expect(localised(chrome.messages, chrome.manifest.name)).toBe(
      'Shorts Flow: Auto-Scroll for YouTube Shorts',
    );
    expect(localised(chrome.messages, chrome.manifest.description)).toMatch(/\S/);
    expect(localised(chrome.messages, chrome.manifest.description)!.length).toBeLessThanOrEqual(132);
  });

  it('has PNG icons at every size and no SVGs', () => {
    expect(chrome.manifest.icons).toEqual({
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    });
    expect(chrome.files).toEqual(expect.arrayContaining(Object.values(chrome.manifest.icons)));
    expect(chrome.files.filter((file) => file.endsWith('.svg'))).toEqual([]);
  });

  it('has a Popup', () => {
    expect(chrome.files).toContain(chrome.manifest.action.default_popup);
  });
});

describe('the Firefox package', () => {
  let firefox: Awaited<ReturnType<typeof buildFor>>;
  beforeAll(async () => {
    firefox = await buildFor('firefox');
  }, BUILD_TIMEOUT);
  afterAll(() => firefox && rm(firefox.outDir, { recursive: true, force: true }));

  it('runs background scripts and declares it collects no data', () => {
    expect(firefox.manifest.background).toEqual({ scripts: ['background.js'] });
    expect(firefox.manifest.permissions).toEqual(['storage']);
    expect(firefox.manifest.browser_specific_settings).toEqual({
      gecko: {
        id: 'shorts-flow@cptdawn.dev',
        strict_min_version: '140.0',
        data_collection_permissions: { required: ['none'] },
      },
    });
  });

  it('takes its name from the English locale', () => {
    expect(localised(firefox.messages, firefox.manifest.name)).toBe(
      'Shorts Flow: Auto-Scroll for YouTube Shorts',
    );
  });

  it('has themed toolbar icons for light and dark toolbars', () => {
    const themeIcons: { light: string; dark: string; size: number }[] = firefox.manifest.action.theme_icons;
    expect(themeIcons.map((icon) => icon.size)).toEqual([16, 32]);
    for (const icon of themeIcons) {
      expect(firefox.files).toContain(icon.light);
      expect(firefox.files).toContain(icon.dark);
      expect(icon.light).not.toBe(icon.dark);
    }
  });
});
