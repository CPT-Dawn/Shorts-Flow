import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { mountPopup, type PopupOptions } from '@/popup/popup';
import type { Session } from '@/settings/session';
import { getMessage } from './support/messages';
import { createTestSessionStore, createTestSettingsStore } from './support/stores';

const MINUTE = 60_000;

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  document.body.replaceChildren();
});

/** Opens the Popup as the toolbar button would, with test stand-ins for the browser. */
function openPopup(options: Partial<PopupOptions> = {}) {
  unmount = mountPopup(document, {
    settings: createTestSettingsStore(),
    session: createTestSessionStore(),
    message: getMessage,
    version: '3.0.0',
    whatsNew: { isUnread: async () => false, markUnread: async () => {}, markRead: async () => {} },
    readBrowser: async () => ({}),
    isOnShortsFeed: async () => true,
    ...options,
  });
}

/** A Session under way: the viewer was watching a moment ago. */
function sessionUnderWay(session: Partial<Session>) {
  return createTestSessionStore({ lastSeenAt: Date.now(), ...session });
}

describe('Shorts Watched', () => {
  it('says how many Shorts the viewer has watched this Session', async () => {
    openPopup({ session: sessionUnderWay({ shortsWatched: 12 }) });

    await expect.element(page.getByRole('status')).toHaveTextContent('On the Shorts Feed · Shorts watched: 12');
  });

  it('starts again from none once the Session has ended', async () => {
    openPopup({ session: createTestSessionStore({ shortsWatched: 12, lastSeenAt: Date.now() - 31 * MINUTE }) });

    await expect.element(page.getByRole('status')).toMatchTextContent(/Shorts watched: 0$/);
  });

  it('counts up live while a Shorts tab plays', async () => {
    const session = sessionUnderWay({ shortsWatched: 12 });
    openPopup({ session });
    await expect.element(page.getByRole('status')).toMatchTextContent(/Shorts watched: 12$/);

    await session.update((stored) => ({ ...stored, shortsWatched: 13 }));

    await expect.element(page.getByRole('status')).toMatchTextContent(/Shorts watched: 13$/);
  });
});
