import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startLifecycle } from '@/lifecycle/lifecycle';
import { createWhatsNew } from '@/lifecycle/whats-new';

/** The pages the browser has opened in new tabs. */
async function openedPages() {
  const tabs = await fakeBrowser.tabs.query({});
  return tabs.flatMap((tab) => (tab.url ? [tab.url] : []));
}

// WXT's fake browser leaves the manifest and the uninstall URL unimplemented:
// the installed version is given here, and the uninstall URL remembered.
const INSTALLED_VERSION = '3.0.1';
let uninstallUrl: string | undefined;

beforeEach(() => {
  fakeBrowser.reset();
  uninstallUrl = undefined;
  fakeBrowser.runtime.getManifest = () => ({ manifest_version: 3, name: 'Shorts Flow', version: INSTALLED_VERSION });
  fakeBrowser.runtime.setUninstallURL = async (url?: string) => {
    uninstallUrl = url;
  };
  startLifecycle();
});

describe('every startup', () => {
  it('sets the uninstall page to the Goodbye Page with the version', () => {
    expect(uninstallUrl).toBe('https://shortsflow.cptdawn.dev/goodbye?version=3.0.1');
  });
});

describe('fresh install', () => {
  it('opens the Welcome Page once', async () => {
    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install' });

    expect(await openedPages()).toEqual(['https://shortsflow.cptdawn.dev/welcome']);
  });
});

describe('upgrade from 2.x', () => {
  beforeEach(async () => {
    // What Shorts Flow 2.x kept on the device.
    await fakeBrowser.storage.local.set({ applicationIsOn: true, scrollOnComments: true, showOnScreenButton: false });
  });

  const upgrade = () =>
    fakeBrowser.runtime.onInstalled.trigger({ reason: 'update', previousVersion: '2.2.0' });

  it('forgets the 2.x settings', async () => {
    await upgrade();

    expect(await fakeBrowser.storage.local.get(['applicationIsOn', 'scrollOnComments', 'showOnScreenButton'])).toEqual(
      {},
    );
  });

  it('opens the Welcome Page once, at its 3.0 section', async () => {
    await upgrade();

    expect(await openedPages()).toEqual(['https://shortsflow.cptdawn.dev/welcome#whats-new']);
  });

  it('leaves What\'s new read, since the Welcome Page already shows it', async () => {
    await upgrade();

    expect(await createWhatsNew().isUnread()).toBe(false);
  });
});

describe('later update', () => {
  const update = () =>
    fakeBrowser.runtime.onInstalled.trigger({ reason: 'update', previousVersion: '3.0.0' });

  it('opens nothing', async () => {
    await update();

    expect(await openedPages()).toEqual([]);
  });

  it("marks What's new unread for the Popup", async () => {
    const whatsNew = createWhatsNew();
    expect(await whatsNew.isUnread()).toBe(false);

    await update();

    expect(await whatsNew.isUnread()).toBe(true);
  });

  it("clears the What's new dot once the viewer opens it", async () => {
    await update();
    await createWhatsNew().markRead();

    expect(await createWhatsNew().isUnread()).toBe(false);
  });
});

describe('browser update', () => {
  it('opens nothing and leaves What\'s new as it was', async () => {
    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'chrome_update' });

    expect(await openedPages()).toEqual([]);
    expect(await createWhatsNew().isUnread()).toBe(false);
  });
});
