import { beforeEach, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createSessionStore, NO_SESSION } from '@/settings/session';

beforeEach(() => {
  fakeBrowser.reset();
});

it('starts with no Session', async () => {
  expect(await createSessionStore().get()).toEqual(NO_SESSION);
});

it('keeps the Session in local storage only, never synced', async () => {
  await createSessionStore().update((session) => ({ ...session, shortsWatched: 3 }));

  expect(await fakeBrowser.storage.local.get(null)).toEqual({ session: { ...NO_SESSION, shortsWatched: 3 } });
  expect(await fakeBrowser.storage.sync.get(null)).toEqual({});
});

it('loses no Short when several tabs count at the same moment', async () => {
  const tabs = [createSessionStore(), createSessionStore(), createSessionStore()];

  await Promise.all(
    tabs.flatMap((tab) =>
      Array.from({ length: 10 }, () => tab.update((session) => ({ ...session, shortsWatched: session.shortsWatched + 1 }))),
    ),
  );

  expect((await createSessionStore().get()).shortsWatched).toBe(30);
});

it('tells every open page, the Popup included, when the Session changes', async () => {
  const popup = createSessionStore();
  const seen: number[] = [];
  const unwatch = popup.watch((session) => seen.push(session.shortsWatched));

  await createSessionStore().update((session) => ({ ...session, shortsWatched: 1 }));

  await expect.poll(() => seen).toEqual([1]);
  unwatch();
});
