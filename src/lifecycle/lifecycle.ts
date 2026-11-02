import { browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import { createWhatsNew } from '@/lifecycle/whats-new';
import { siteUrl } from '@/site/site-links';

/** What Shorts Flow 2.x kept in local storage. v3 carries none of it over (ADR 0001). */
const LEGACY_KEYS = ['local:applicationIsOn', 'local:scrollOnComments', 'local:showOnScreenButton'] as const;

/**
 * Wires up what happens when Shorts Flow is installed, updated or removed.
 * Call once, synchronously, each time the background starts, so the browser's
 * install event is never missed.
 */
export function startLifecycle(): void {
  const { version } = browser.runtime.getManifest();
  void browser.runtime.setUninstallURL(siteUrl('goodbye', { version }));

  browser.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
    if (reason === 'install') {
      await openWelcomePage({});
    } else if (reason === 'update' && majorVersion(previousVersion) < 3) {
      // Everyone coming from 2.x starts on the v3 defaults, as if newly installed.
      await storage.removeItems([...LEGACY_KEYS]);
      await openWelcomePage({ v3: true });
    } else if (reason === 'update') {
      // Later updates never open a tab: the Popup shows a dot instead.
      await createWhatsNew().markUnread();
    }
  });
}

async function openWelcomePage(params: { v3?: boolean }) {
  await browser.tabs.create({ url: siteUrl('welcome', params) });
}

function majorVersion(version: string | undefined): number {
  return Number.parseInt(version ?? '', 10);
}
