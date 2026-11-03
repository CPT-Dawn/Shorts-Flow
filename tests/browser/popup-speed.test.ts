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
  document.documentElement.lang = 'en';
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

const speedSwitch = () => page.getByRole('switch', { name: 'Speed' });
const preferredSpeed = () => page.getByRole('combobox', { name: 'Preferred Speed' });

it('shows Speed and the Preferred Speed as the viewer left them', async () => {
  openPopup(createTestSettingsStore({ speedOn: true, preferredSpeed: 2.25 }));

  await expect.element(speedSwitch()).toBeChecked();
  await expect.element(preferredSpeed()).toHaveValue('2.25');
});

it('switches Speed for every Shorts tab at once', async () => {
  const settings = createTestSettingsStore({ speedOn: false });
  openPopup(settings);
  await expect.element(speedSwitch()).not.toBeChecked();

  await speedSwitch().click();

  await expect.poll(async () => (await settings.get()).speedOn).toBe(true);
  await expect.element(speedSwitch()).toBeChecked();
});

it('switches Speed from a click on its name, as every switch row does', async () => {
  const settings = createTestSettingsStore({ speedOn: false, preferredSpeed: 1.5 });
  openPopup(settings);
  await expect.element(speedSwitch()).toBeEnabled();

  // The row's name, not the Speed Shortcut further down.
  await userEvent.click(document.getElementById('sf-setting-speed')!);

  await expect.poll(async () => (await settings.get()).speedOn).toBe(true);
  await expect.element(speedSwitch()).toBeChecked();
  expect((await settings.get()).preferredSpeed).toBe(1.5);
});

it('leaves Speed alone when the viewer picks a Preferred Speed', async () => {
  const settings = createTestSettingsStore({ speedOn: false, preferredSpeed: 1.5 });
  openPopup(settings);
  await expect.element(preferredSpeed()).toBeEnabled();

  await preferredSpeed().click();
  await userEvent.selectOptions(preferredSpeed(), '2×');

  await expect.poll(async () => (await settings.get()).preferredSpeed).toBe(2);
  expect((await settings.get()).speedOn).toBe(false);
  await expect.element(speedSwitch()).not.toBeChecked();
});

it('writes speeds the way the browser language does', async () => {
  unmount = mountPopup(document, {
    settings: createTestSettingsStore(),
    session: createTestSessionStore(),
    getMessage: (key, substitutions) => (key === '@@ui_locale' ? 'de' : getMessage(key, substitutions)),
    version: '3.0.0',
    whatsNew: { isUnread: async () => false, markUnread: async () => {}, markRead: async () => {} },
    readBrowser: async () => ({}),
    isOnShortsFeed: async () => false,
  });

  await expect.element(preferredSpeed()).toBeEnabled();
  const options = [...preferredSpeed().element().querySelectorAll('option')].map((option) => option.textContent);
  expect(options.slice(0, 2)).toEqual(['0,5×', '0,75×']);
  await expect.element(preferredSpeed()).toHaveValue('1.5');
});

it('offers every Preferred Speed from 0.5× to 3× in steps of 0.25', async () => {
  openPopup(createTestSettingsStore());

  await expect.element(preferredSpeed()).toBeEnabled();
  const options = [...preferredSpeed().element().querySelectorAll('option')].map((option) => option.textContent);
  expect(options).toEqual(['0.5×', '0.75×', '1×', '1.25×', '1.5×', '1.75×', '2×', '2.25×', '2.5×', '2.75×', '3×']);
});

it('saves a Preferred Speed picked from the keyboard', async () => {
  const settings = createTestSettingsStore({ preferredSpeed: 1.5 });
  openPopup(settings);
  await expect.element(preferredSpeed()).toBeEnabled();

  await userEvent.selectOptions(preferredSpeed(), '2×');

  await expect.poll(async () => (await settings.get()).preferredSpeed).toBe(2);
});

it('follows a change made elsewhere while the Popup is open', async () => {
  const settings = createTestSettingsStore({ speedOn: false, preferredSpeed: 1.5 });
  openPopup(settings);
  await expect.element(speedSwitch()).not.toBeChecked();

  await settings.set({ speedOn: true, preferredSpeed: 0.75 });

  await expect.element(speedSwitch()).toBeChecked();
  await expect.element(preferredSpeed()).toHaveValue('0.75');
});
