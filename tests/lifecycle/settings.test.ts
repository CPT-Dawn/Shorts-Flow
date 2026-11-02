import { beforeEach, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createSettingsStore, DEFAULT_SETTINGS, type Settings } from '@/settings/settings';

beforeEach(() => {
  fakeBrowser.reset();
});

it('has Auto-Scroll on after a fresh install', async () => {
  const settings = await createSettingsStore().get();

  expect(settings.autoScroll).toBe(true);
  expect(DEFAULT_SETTINGS.autoScroll).toBe(true);
});

it('remembers Auto-Scroll across a browser restart, in local storage', async () => {
  await createSettingsStore().set({ autoScroll: false });

  // A restart keeps local storage and starts every page afresh.
  const afterRestart = createSettingsStore();
  expect((await afterRestart.get()).autoScroll).toBe(false);
  expect(await fakeBrowser.storage.local.get(null)).toEqual({ autoScroll: false });
  expect(await fakeBrowser.storage.sync.get(null)).toEqual({});
});

it('tells every open page when a setting changes anywhere', async () => {
  const thisTab = createSettingsStore();
  const otherTab = createSettingsStore();
  const seen: Settings[] = [];
  const unwatch = thisTab.watch((settings) => seen.push(settings));

  await otherTab.set({ autoScroll: false });
  await expect.poll(() => seen).toEqual([{ ...DEFAULT_SETTINGS, autoScroll: false }]);

  unwatch();
  await otherTab.set({ autoScroll: true });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(seen).toHaveLength(1);
});

it('has Speed off after a fresh install, with a Preferred Speed of 1.5×', async () => {
  const settings = await createSettingsStore().get();

  expect(settings.speedOn).toBe(false);
  expect(settings.preferredSpeed).toBe(1.5);
});

it('remembers Speed and the Preferred Speed across a browser restart', async () => {
  await createSettingsStore().set({ speedOn: true, preferredSpeed: 2.25 });

  const afterRestart = await createSettingsStore().get();
  expect(afterRestart.speedOn).toBe(true);
  expect(afterRestart.preferredSpeed).toBe(2.25);
});

it('has A for Auto-Scroll and S for Speed after a fresh install, and remembers a rebinding', async () => {
  expect((await createSettingsStore().get()).shortcuts).toEqual({ toggleAutoScroll: 'a', toggleSpeed: 's' });

  await createSettingsStore().set({ shortcuts: { toggleAutoScroll: 'x', toggleSpeed: 's' } });

  const afterRestart = await createSettingsStore().get();
  expect(afterRestart.shortcuts).toEqual({ toggleAutoScroll: 'x', toggleSpeed: 's' });
});
