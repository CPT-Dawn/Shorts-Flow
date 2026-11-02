import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
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

    await expect.element(page.getByRole('status')).toHaveTextContent('On the Shorts Feed · Shorts Watched: 12');
  });

  it('starts again from none once the Session has ended', async () => {
    openPopup({ session: createTestSessionStore({ shortsWatched: 12, lastSeenAt: Date.now() - 31 * MINUTE }) });

    await expect.element(page.getByRole('status')).toMatchTextContent(/Shorts Watched: 0$/);
  });

  it('counts up live while a Shorts tab plays', async () => {
    const session = sessionUnderWay({ shortsWatched: 12 });
    openPopup({ session });
    await expect.element(page.getByRole('status')).toMatchTextContent(/Shorts Watched: 12$/);

    await session.update((stored) => ({ ...stored, shortsWatched: 13 }));

    await expect.element(page.getByRole('status')).toMatchTextContent(/Shorts Watched: 13$/);
  });
});

describe('Session Limit', () => {
  const kind = () => page.getByRole('combobox', { name: 'Session Limit' });

  it('is off by default', async () => {
    openPopup();

    await expect.element(kind()).toHaveDisplayValue('Off');
    await expect.element(page.getByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('sets a limit in Shorts, starting at 30, and takes a new number', async () => {
    const settings = createTestSettingsStore();
    openPopup({ settings });
    await expect.element(kind()).toBeEnabled();

    await kind().selectOptions('Shorts');
    await expect.poll(async () => (await settings.get()).sessionLimit).toEqual({ kind: 'shorts', value: 30 });
    const value = page.getByRole('spinbutton', { name: 'Shorts before a break' });
    await expect.element(value).toHaveValue(30);
    await value.fill('12');
    await userEvent.keyboard('{Enter}');

    await expect.poll(async () => (await settings.get()).sessionLimit).toEqual({ kind: 'shorts', value: 12 });
  });

  it('sets a limit in minutes', async () => {
    const settings = createTestSettingsStore();
    openPopup({ settings });
    await expect.element(kind()).toBeEnabled();

    await kind().selectOptions('Minutes');

    await expect.poll(async () => (await settings.get()).sessionLimit).toEqual({ kind: 'minutes', value: 30 });
    await expect.element(page.getByRole('spinbutton', { name: 'Minutes before a break' })).toHaveValue(30);
  });

  it('turns the limit off again', async () => {
    const settings = createTestSettingsStore({ sessionLimit: { kind: 'minutes', value: 20 } });
    openPopup({ settings });
    await expect.element(kind()).toHaveDisplayValue('Minutes');

    await kind().selectOptions('Off');

    await expect.poll(async () => (await settings.get()).sessionLimit).toEqual({ kind: 'off' });
    await expect.element(page.getByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('keeps a typed limit between 1 and 999', async () => {
    const settings = createTestSettingsStore({ sessionLimit: { kind: 'shorts', value: 30 } });
    openPopup({ settings });
    const value = page.getByRole('spinbutton', { name: 'Shorts before a break' });
    await expect.element(value).toHaveValue(30);

    await value.fill('5000');
    await userEvent.keyboard('{Enter}');
    await expect.poll(async () => (await settings.get()).sessionLimit).toEqual({ kind: 'shorts', value: 999 });
    await value.fill('0');
    await userEvent.keyboard('{Enter}');

    await expect.poll(async () => (await settings.get()).sessionLimit).toEqual({ kind: 'shorts', value: 1 });
  });

  it('shows how far this Session has come since the last Break Nudge', async () => {
    openPopup({
      settings: createTestSettingsStore({ sessionLimit: { kind: 'shorts', value: 10 } }),
      session: sessionUnderWay({ shortsWatched: 25, limitFrom: { shortsWatched: 22, playingMs: 0 } }),
    });

    await expect.element(kind()).toHaveAccessibleDescription('3 of 10 Shorts before a break');
  });

  it('shows minutes played towards a limit in minutes', async () => {
    openPopup({
      settings: createTestSettingsStore({ sessionLimit: { kind: 'minutes', value: 20 } }),
      session: sessionUnderWay({ playingMs: 7.5 * MINUTE }),
    });

    await expect.element(kind()).toHaveAccessibleDescription('7 of 20 minutes before a break');
  });

  it('follows a change made elsewhere while the Popup is open', async () => {
    const settings = createTestSettingsStore();
    openPopup({ settings });
    await expect.element(kind()).toHaveDisplayValue('Off');

    await settings.set({ sessionLimit: { kind: 'shorts', value: 15 } });

    await expect.element(kind()).toHaveDisplayValue('Shorts');
    await expect.element(page.getByRole('spinbutton', { name: 'Shorts before a break' })).toHaveValue(15);
  });

  it('is operable by keyboard: pick a kind, then Tab to its number', async () => {
    const settings = createTestSettingsStore({ sessionLimit: { kind: 'shorts', value: 30 } });
    openPopup({ settings });
    await expect.element(kind()).toBeEnabled();

    (kind().element() as HTMLElement).focus();
    await userEvent.tab();

    await expect.element(page.getByRole('spinbutton', { name: 'Shorts before a break' })).toHaveFocus();
  });
});
