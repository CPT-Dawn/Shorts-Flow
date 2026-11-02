import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { WhatsNew } from '@/lifecycle/whats-new';
import { type HostAccess, mountPopup, type PopupOptions, type PopupRow } from '@/popup/popup';
import type { SettingsStore } from '@/settings/settings';
import { getMessage } from './support/messages';
import { createTestSessionStore, createTestSettingsStore } from './support/stores';

let unmount: (() => void) | undefined;

// The Popup's links open new tabs; a test only checks where they lead.
const stayHere = (event: Event) => {
  if ((event.target as Element).closest('a')) event.preventDefault();
};
beforeEach(() => document.addEventListener('click', stayHere));

afterEach(() => {
  document.removeEventListener('click', stayHere);
  unmount?.();
  unmount = undefined;
  document.body.replaceChildren();
});

/** Opens the Popup as the toolbar button would, with test stand-ins for the browser. */
function openPopup(options: Partial<PopupOptions> & { settings?: SettingsStore } = {}) {
  unmount = mountPopup(document, {
    settings: createTestSettingsStore(),
    session: createTestSessionStore(),
    getMessage,
    version: '3.0.0',
    whatsNew: whatsNewFlag(false),
    readBrowser: async () => ({ browser: 'chrome', browserVersion: '142' }),
    isOnShortsFeed: async () => false,
    ...options,
  });
}

/** An in-memory What's new flag, as an update would leave it. */
function whatsNewFlag(unread: boolean): WhatsNew {
  return {
    isUnread: async () => unread,
    markUnread: async () => void (unread = true),
    markRead: async () => void (unread = false),
  };
}

describe('Auto-Scroll', () => {
  it('shows the setting as the viewer left it', async () => {
    openPopup({ settings: createTestSettingsStore({ autoScroll: false }) });

    await expect.element(page.getByRole('switch', { name: 'Auto-Scroll' })).not.toBeChecked();
  });

  it('switches Auto-Scroll for every Shorts tab at once', async () => {
    const settings = createTestSettingsStore({ autoScroll: true });
    openPopup({ settings });
    const autoScroll = page.getByRole('switch', { name: 'Auto-Scroll' });
    await expect.element(autoScroll).toBeChecked();

    await autoScroll.click();

    await expect.poll(async () => (await settings.get()).autoScroll).toBe(false);
    await expect.element(autoScroll).not.toBeChecked();
  });

  it('follows a change made elsewhere while the Popup is open', async () => {
    const settings = createTestSettingsStore({ autoScroll: true });
    openPopup({ settings });
    const autoScroll = page.getByRole('switch', { name: 'Auto-Scroll' });
    await expect.element(autoScroll).toBeChecked();

    await settings.set({ autoScroll: false });

    await expect.element(autoScroll).not.toBeChecked();
  });
});

describe('Skip Sponsored Shorts', () => {
  const skipSponsored = () => page.getByRole('list', { name: 'Settings' }).getByRole('switch', { name: 'Skip Sponsored Shorts' });

  it('is on from the start, and says it skips rather than blocks', async () => {
    openPopup();

    await expect.element(skipSponsored()).toBeChecked();
    await expect.element(skipSponsored()).toHaveAccessibleDescription('Moves past them as soon as one comes up');
  });

  it('switches skipping for every Shorts tab at once, and stays in step with changes made elsewhere', async () => {
    const settings = createTestSettingsStore({ skipSponsoredShorts: true });
    openPopup({ settings });
    await expect.element(skipSponsored()).toBeChecked();

    await skipSponsored().click();
    await expect.poll(async () => (await settings.get()).skipSponsoredShorts).toBe(false);
    await expect.element(skipSponsored()).toHaveAccessibleDescription('They play like any other Short');

    await settings.set({ skipSponsoredShorts: true });
    await expect.element(skipSponsored()).toBeChecked();
  });

  it('leaves Auto-Scroll alone', async () => {
    const settings = createTestSettingsStore({ autoScroll: true, skipSponsoredShorts: true });
    openPopup({ settings });

    await skipSponsored().click();

    await expect.poll(async () => (await settings.get()).skipSponsoredShorts).toBe(false);
    expect((await settings.get()).autoScroll).toBe(true);
  });
});

describe('status line', () => {
  it('says so when the tab the Popup opened over is on the Shorts Feed', async () => {
    openPopup({ isOnShortsFeed: async () => true });

    await expect.element(page.getByRole('status')).toMatchTextContent(/^On the Shorts Feed/);
  });

  it('says so when that tab is anywhere else', async () => {
    openPopup({ isOnShortsFeed: async () => false });

    await expect.element(page.getByRole('status')).toMatchTextContent(/^Not on the Shorts Feed/);
  });
});

describe("Firefox's access to youtube.com", () => {
  const notice = () => page.getByRole('alert');
  const restore = () => page.getByRole('button', { name: 'Allow on YouTube' });

  /** Firefox's host permission for youtube.com, which the viewer can turn off in about:addons. */
  function youtubeAccess(granted: boolean, { grantsOnRequest = true } = {}) {
    const listeners = new Set<(granted: boolean) => void>();
    const access: HostAccess & { requests: number; set(granted: boolean): void } = {
      requests: 0,
      /** The viewer turns the access on or off in Firefox. */
      set(next: boolean) {
        granted = next;
        for (const listener of listeners) listener(next);
      },
      isGranted: async () => granted,
      async request() {
        access.requests++;
        if (grantsOnRequest) access.set(true);
        return granted;
      },
      watch(listener: (granted: boolean) => void) {
        listeners.add(listener);
        return () => void listeners.delete(listener);
      },
    };
    return access;
  }

  it('says nothing while Shorts Flow has its access', async () => {
    openPopup({ hostAccess: youtubeAccess(true) });
    await expect.element(page.getByRole('switch', { name: 'Auto-Scroll' })).toBeEnabled();

    await expect.element(notice()).not.toBeInTheDocument();
  });

  it('says so when the viewer took the access away, and gives it back on request', async () => {
    const access = youtubeAccess(false);
    openPopup({ hostAccess: access });
    await expect.element(notice().getByText("Shorts Flow can't reach YouTube")).toBeVisible();

    await restore().click();

    expect(access.requests).toBe(1);
    await expect.element(notice()).not.toBeInTheDocument();
  });

  it('keeps saying so when the viewer turns the request down', async () => {
    const access = youtubeAccess(false, { grantsOnRequest: false });
    openPopup({ hostAccess: access });

    await restore().click();

    expect(access.requests).toBe(1);
    await expect.element(notice()).toBeVisible();
  });

  it('notices the access going away while the Popup is open', async () => {
    const access = youtubeAccess(true);
    openPopup({ hostAccess: access });
    await expect.element(page.getByRole('switch', { name: 'Auto-Scroll' })).toBeEnabled();

    access.set(false);

    await expect.element(notice()).toBeVisible();
  });
});

describe('keyboard', () => {
  it('reaches Auto-Scroll first, switches it with Space, then moves on to the settings and links', async () => {
    const settings = createTestSettingsStore({ autoScroll: true });
    openPopup({ settings });
    await expect.element(page.getByRole('switch', { name: 'Auto-Scroll' })).toBeEnabled();

    await userEvent.tab();
    await expect.element(page.getByRole('switch', { name: 'Auto-Scroll' })).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect.poll(async () => (await settings.get()).autoScroll).toBe(false);

    await userEvent.tab();
    await expect.element(page.getByRole('switch', { name: 'Skip Sponsored Shorts' })).toHaveFocus();
    await userEvent.tab();
    await expect.element(page.getByRole('switch', { name: 'Show button on Shorts' })).toHaveFocus();
    await userEvent.tab();
    await expect.element(page.getByRole('combobox', { name: 'Preferred Speed' })).toHaveFocus();
    await userEvent.tab();
    await expect.element(page.getByRole('switch', { name: 'Speed' })).toHaveFocus();
    await userEvent.tab();
    await expect.element(page.getByRole('combobox', { name: 'Session Limit' })).toHaveFocus();
    await userEvent.tab();
    await expect.element(page.getByRole('button', { name: 'Auto-Scroll Shortcut: A' })).toHaveFocus();
    await userEvent.tab();
    await expect.element(page.getByRole('button', { name: 'Speed Shortcut: S' })).toHaveFocus();
    await userEvent.tab();
    await expect.element(page.getByRole('link', { name: "What's new" })).toHaveFocus();
    await userEvent.tab();
    await expect.element(page.getByRole('link', { name: 'Report a problem' })).toHaveFocus();
    await userEvent.tab();
    await expect.element(page.getByRole('link', { name: 'Support' })).toHaveFocus();
  });

  it('shows where the focus is', async () => {
    openPopup();
    await expect.element(page.getByRole('switch', { name: 'Auto-Scroll' })).toBeEnabled();

    for (const name of [
      'Auto-Scroll',
      'Skip Sponsored Shorts',
      'Show button on Shorts',
      'Preferred Speed',
      'Speed',
      'Session Limit',
      'Auto-Scroll Shortcut',
      'Speed Shortcut',
      "What's new",
      'Report a problem',
      'Support',
    ]) {
      await userEvent.tab();
      const focused = document.activeElement!;
      expect(focused.matches(':focus-visible'), name).toBe(true);
      expect(getComputedStyle(focused).outlineStyle, name).not.toBe('none');
      expect(getComputedStyle(focused).outlineWidth, name).not.toBe('0px');
    }
  });
});

describe('privacy', () => {
  it('draws in its own bundled fonts and fetches nothing from anywhere else', async () => {
    openPopup({ isOnShortsFeed: async () => true });
    await expect.element(page.getByRole('status')).toMatchTextContent(/^On the Shorts Feed/);
    await document.fonts.ready;

    const loaded = [...document.fonts].filter((face) => face.status === 'loaded').map((face) => face.family.replaceAll('"', ''));
    expect(loaded).toEqual(expect.arrayContaining(['Sora', 'Instrument Sans']));
    const elsewhere = performance
      .getEntriesByType('resource')
      .map(({ name }) => new URL(name))
      .filter(({ origin }) => origin !== location.origin);
    expect(elsewhere).toEqual([]);
  });
});

describe('Show button on Shorts', () => {
  it('is on from the start', async () => {
    openPopup();

    await expect.element(page.getByRole('switch', { name: 'Show button on Shorts' })).toBeChecked();
  });

  it('hides the Shorts Control from every Shorts tab, and shows it again', async () => {
    const settings = createTestSettingsStore();
    openPopup({ settings });
    const shown = page.getByRole('list', { name: 'Settings' }).getByRole('switch', { name: 'Show button on Shorts' });
    await expect.element(shown).toBeChecked();

    await shown.click();
    await expect.poll(async () => (await settings.get()).shortsControlShown).toBe(false);

    await shown.click();
    await expect.poll(async () => (await settings.get()).shortsControlShown).toBe(true);
  });
});

describe('rows added by later features', () => {
  // Stands in for a feature's row; the only on/off setting so far is Auto-Scroll.
  const testRow: PopupRow = (popup) =>
    popup.switchRow({
      setting: 'autoScroll',
      label: 'Test setting',
      hint: (settings) => (settings.autoScroll ? 'Is on' : 'Is off'),
    });

  it('shows no settings list while no feature has a row', async () => {
    openPopup({ rows: [] });
    await expect.element(page.getByRole('switch', { name: 'Auto-Scroll' })).toBeVisible();

    await expect.element(page.getByRole('list', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('lists each row under Settings, its switch kept in step with the setting both ways', async () => {
    const settings = createTestSettingsStore({ autoScroll: true });
    openPopup({ settings, rows: [testRow] });
    const list = page.getByRole('list', { name: 'Settings' });
    const testSwitch = list.getByRole('switch', { name: 'Test setting' });
    await expect.element(testSwitch).toBeChecked();
    await expect.element(testSwitch).toHaveAccessibleDescription('Is on');

    await testSwitch.click();
    await expect.poll(async () => (await settings.get()).autoScroll).toBe(false);
    await expect.element(testSwitch).toHaveAccessibleDescription('Is off');

    await settings.set({ autoScroll: true });
    await expect.element(testSwitch).toBeChecked();
  });

  it('adds what a status part says after the Shorts Feed, set off by a middle dot', async () => {
    openPopup({
      isOnShortsFeed: async () => true,
      statusParts: [(popup) => popup.document.createTextNode('14 Shorts this Session')],
    });

    await expect.element(page.getByRole('status')).toHaveTextContent('On the Shorts Feed · 14 Shorts this Session');
  });
});

describe('header', () => {
  it('names Shorts Flow in its heading and title, from the locale files', async () => {
    openPopup();

    await expect.element(page.getByRole('heading', { name: 'Shorts Flow' })).toBeVisible();
    expect(document.title).toBe('Shorts Flow');
  });

  it('shows the version, short when it is a .0 release', async () => {
    openPopup({ version: '3.0.0' });

    await expect.element(page.getByLabelText('Version 3.0', { exact: true })).toHaveTextContent('3.0');
  });

  it('shows the full version of a patch release', async () => {
    openPopup({ version: '3.1.2' });

    await expect.element(page.getByLabelText('Version 3.1.2', { exact: true })).toHaveTextContent('3.1.2');
  });
});

describe("What's new", () => {
  const dot = () => page.getByRole('img', { name: 'New in this version' });

  it('shows a dot on the version after an update', async () => {
    openPopup({ whatsNew: whatsNewFlag(true) });

    await expect.element(dot()).toBeVisible();
  });

  it('shows no dot when there is nothing new', async () => {
    openPopup({ whatsNew: whatsNewFlag(false) });
    await expect.element(page.getByRole('link', { name: "What's new" })).toBeVisible();

    await expect.element(dot()).not.toBeInTheDocument();
  });

  it("clears the dot for good once the viewer opens What's new", async () => {
    const whatsNew = whatsNewFlag(true);
    openPopup({ whatsNew });
    await expect.element(dot()).toBeVisible();

    await page.getByRole('link', { name: "What's new" }).click();

    await expect.element(dot()).not.toBeInTheDocument();
    expect(await whatsNew.isUnread()).toBe(false);
  });

  it("opens the Welcome Page at its What's new section", async () => {
    openPopup();

    await expect
      .element(page.getByRole('link', { name: "What's new" }))
      .toHaveAttribute('href', 'https://shortsflow.cptdawn.dev/welcome#whats-new');
  });
});

describe('help links', () => {
  it('reports a problem with the version and browser filled in', async () => {
    openPopup({
      version: '3.1.2',
      readBrowser: async () => ({ browser: 'firefox', browserVersion: '146.0' }),
    });

    await expect
      .element(page.getByRole('link', { name: 'Report a problem' }))
      .toHaveAttribute('href', 'https://shortsflow.cptdawn.dev/report?version=3.1.2&browser=firefox&browserVersion=146.0');
  });

  it('reports a problem with the version alone when the browser will not say', async () => {
    openPopup({ version: '3.0.0', readBrowser: async () => ({}) });

    await expect
      .element(page.getByRole('link', { name: 'Report a problem' }))
      .toHaveAttribute('href', 'https://shortsflow.cptdawn.dev/report?version=3.0.0');
  });

  it('links to the Support Page', async () => {
    openPopup();

    await expect
      .element(page.getByRole('link', { name: 'Support' }))
      .toHaveAttribute('href', 'https://shortsflow.cptdawn.dev/support');
  });

  it('opens every link in a new tab', async () => {
    openPopup();
    await expect.element(page.getByRole('link', { name: 'Support' })).toBeVisible();

    for (const link of document.querySelectorAll('a')) {
      expect(link.target).toBe('_blank');
      expect(link.rel).toContain('noopener');
    }
  });
});
