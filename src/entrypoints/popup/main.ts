import { browser } from 'wxt/browser';
import { createWhatsNew } from '@/lifecycle/whats-new';
import { isActiveTabOnShortsFeed } from '@/messaging/feed-status';
import { createHostAccess } from '@/popup/host-access';
import { mountPopup } from '@/popup/popup';
import { createSessionStore } from '@/settings/session';
import { createSettingsStore } from '@/settings/settings';
import { readBrowser } from '@/site/browser-info';

mountPopup(document, {
  settings: createSettingsStore(),
  session: createSessionStore(),
  message: (key, substitutions) => browser.i18n.getMessage(key, substitutions),
  version: browser.runtime.getManifest().version,
  whatsNew: createWhatsNew(),
  readBrowser: () => readBrowser(),
  isOnShortsFeed: isActiveTabOnShortsFeed,
  hostAccess: createHostAccess(),
});
