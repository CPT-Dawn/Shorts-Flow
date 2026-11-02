import { afterEach, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { mountPopup } from '@/popup/popup';
import type { SettingsStore } from '@/settings/settings';
import { getMessage } from './support/messages';
import { createTestSessionStore, createTestSettingsStore } from './support/stores';

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  document.body.replaceChildren();
});

/** Opens the Popup with its own settings list, as the toolbar button would. */
function openPopup(settings: SettingsStore) {
  unmount = mountPopup(document, {
    settings,
    session: createTestSessionStore(),
    getMessage,
    version: '3.0.0',
    whatsNew: { isUnread: async () => false, markUnread: async () => {}, markRead: async () => {} },
    readBrowser: async () => ({}),
    isOnShortsFeed: async () => false,
  });
}

const autoScrollKey = () => page.getByRole('button', { name: /^Auto-Scroll Shortcut/ });
const speedKey = () => page.getByRole('button', { name: /^Speed Shortcut/ });
const shortcuts = async (settings: SettingsStore) => (await settings.get()).shortcuts;

it('shows each Shortcut with its key, A and S from the start', async () => {
  openPopup(createTestSettingsStore());

  await expect.element(autoScrollKey()).toHaveAccessibleName('Auto-Scroll Shortcut: A');
  await expect.element(speedKey()).toHaveAccessibleName('Speed Shortcut: S');
});

it('rebinds a Shortcut to the next key the viewer presses, for every Shorts tab', async () => {
  const settings = createTestSettingsStore();
  openPopup(settings);
  await expect.element(autoScrollKey()).toBeEnabled();

  await autoScrollKey().click();
  await expect.element(autoScrollKey().getByText('Press a key')).toBeVisible();
  await userEvent.keyboard('x');

  await expect.poll(() => shortcuts(settings)).toEqual({ toggleAutoScroll: 'x', toggleSpeed: 's' });
  await expect.element(autoScrollKey()).toHaveAccessibleName('Auto-Scroll Shortcut: X');
});

it('refuses the key of the other Shortcut, and says why', async () => {
  const settings = createTestSettingsStore();
  openPopup(settings);
  await expect.element(autoScrollKey()).toBeEnabled();

  await autoScrollKey().click();
  await userEvent.keyboard('s');

  await expect.element(page.getByText('S is already the Speed Shortcut')).toBeVisible();
  expect(await shortcuts(settings)).toEqual({ toggleAutoScroll: 'a', toggleSpeed: 's' });

  // Still listening: another key goes through.
  await userEvent.keyboard('q');
  await expect.poll(() => shortcuts(settings)).toEqual({ toggleAutoScroll: 'q', toggleSpeed: 's' });
  await expect.element(page.getByText('S is already the Speed Shortcut')).not.toBeInTheDocument();
});

it.each([
  ['k', 'K'],
  ['ArrowDown', '↓'],
  ['ArrowUp', '↑'],
  ['m', 'M'],
  ['/', '/'],
])("refuses YouTube's own key %s, and says why", async (key, name) => {
  const settings = createTestSettingsStore();
  openPopup(settings);
  await expect.element(speedKey()).toBeEnabled();

  await speedKey().click();
  await userEvent.keyboard(key.length === 1 ? key : `{${key}}`);

  await expect.element(page.getByText(`${name} is one of YouTube's own keys`)).toBeVisible();
  expect(await shortcuts(settings)).toEqual({ toggleAutoScroll: 'a', toggleSpeed: 's' });
});

it('takes no key combinations, waiting for a single key instead', async () => {
  const settings = createTestSettingsStore();
  openPopup(settings);
  await expect.element(speedKey()).toBeEnabled();

  await speedKey().click();
  await userEvent.keyboard('{Control>}d{/Control}');
  expect(await shortcuts(settings)).toEqual({ toggleAutoScroll: 'a', toggleSpeed: 's' });
  await expect.element(speedKey().getByText('Press a key')).toBeVisible();

  await userEvent.keyboard('d');
  await expect.poll(() => shortcuts(settings)).toEqual({ toggleAutoScroll: 'a', toggleSpeed: 'd' });
});

it('rebinds from the keyboard alone', async () => {
  const settings = createTestSettingsStore();
  openPopup(settings);
  await expect.element(speedKey()).toBeEnabled();
  speedKey().element().focus();

  await userEvent.keyboard('{Enter}');
  await expect.element(speedKey().getByText('Press a key')).toBeVisible();
  await userEvent.keyboard('v');

  await expect.poll(() => shortcuts(settings)).toEqual({ toggleAutoScroll: 'a', toggleSpeed: 'v' });
  await expect.element(speedKey()).toHaveFocus();
});

it('stops waiting for a key once the viewer tabs away', async () => {
  const settings = createTestSettingsStore();
  openPopup(settings);
  await expect.element(autoScrollKey()).toBeEnabled();

  await autoScrollKey().click();
  await userEvent.tab();

  await expect.element(autoScrollKey().getByText('Press a key')).not.toBeInTheDocument();
  await expect.element(speedKey()).toHaveFocus();
});

it('keeps the old key when the viewer presses Escape', async () => {
  const settings = createTestSettingsStore();
  openPopup(settings);
  await expect.element(speedKey()).toBeEnabled();

  await speedKey().click();
  await userEvent.keyboard('{Escape}');

  await expect.element(speedKey()).toHaveAccessibleName('Speed Shortcut: S');
  await expect.element(speedKey().getByText('Press a key')).not.toBeInTheDocument();
  expect(await shortcuts(settings)).toEqual({ toggleAutoScroll: 'a', toggleSpeed: 's' });
});

it('shows Shortcuts as the viewer left them, and follows a change made elsewhere', async () => {
  const settings = createTestSettingsStore({ shortcuts: { toggleAutoScroll: 'g', toggleSpeed: 'h' } });
  openPopup(settings);
  await expect.element(autoScrollKey()).toHaveAccessibleName('Auto-Scroll Shortcut: G');

  await settings.set({ shortcuts: { toggleAutoScroll: 'g', toggleSpeed: 'v' } });

  await expect.element(speedKey()).toHaveAccessibleName('Speed Shortcut: V');
});
