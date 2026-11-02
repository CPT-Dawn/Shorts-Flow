import { describe, expect, it } from 'vitest';
import { aMomentLater, expectTimeline, mountShortsFeed } from './support/shorts-feed';
import { createTestSettingsStore } from './support/stores';
import { feedPages, hasNextShort } from './support/test-pages';

describe.each(feedPages.filter(hasNextShort))('on $name', (page) => {
  it('plays the Current Short at the Preferred Speed while Speed is on', async () => {
    const shortsFeed = await mountShortsFeed(page, {
      settings: createTestSettingsStore({ speedOn: true, preferredSpeed: 1.75 }),
    });

    await expect.poll(() => shortsFeed.playbackSpeed()).toBe(1.75);
  });

  it('keeps the Preferred Speed after a reload, where YouTube itself goes back to 1×', async () => {
    const settings = createTestSettingsStore();
    const before = await mountShortsFeed(page, { settings });
    await settings.set({ speedOn: true, preferredSpeed: 2.5 });
    await expect.poll(() => before.playbackSpeed()).toBe(2.5);
    before.unmountEngine();

    const afterReload = await mountShortsFeed(page, { settings });

    await expect.poll(() => afterReload.playbackSpeed()).toBe(2.5);
  });

  it('plays every new Short at the Preferred Speed', async () => {
    const shortsFeed = await mountShortsFeed(page, {
      settings: createTestSettingsStore({ speedOn: true, preferredSpeed: 2 }),
    });

    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 2 is current']);
    await expect.poll(() => shortsFeed.playbackSpeed()).toBe(2);
    await aMomentLater();
    expect(shortsFeed.playbackSpeed()).toBe(2);
  });

  it('goes back to 1× when Speed is turned off', async () => {
    const settings = createTestSettingsStore({ speedOn: true, preferredSpeed: 2 });
    const shortsFeed = await mountShortsFeed(page, { settings });
    await expect.poll(() => shortsFeed.playbackSpeed()).toBe(2);

    await settings.set({ speedOn: false });

    await expect.poll(() => shortsFeed.playbackSpeed()).toBe(1);
  });

  it('plays at a new Preferred Speed as soon as it is picked', async () => {
    const settings = createTestSettingsStore({ speedOn: true, preferredSpeed: 2 });
    const shortsFeed = await mountShortsFeed(page, { settings });
    await expect.poll(() => shortsFeed.playbackSpeed()).toBe(2);

    await settings.set({ preferredSpeed: 0.75 });

    await expect.poll(() => shortsFeed.playbackSpeed()).toBe(0.75);
  });

  it('leaves the speed to YouTube while Speed is off', async () => {
    const shortsFeed = await mountShortsFeed(page, { settings: createTestSettingsStore({ speedOn: false }) });
    shortsFeed.setPlaybackSpeed(1.25);

    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 2 is current']);
    await aMomentLater();

    expect(shortsFeed.playbackSpeed()).toBe(1.25);
  });

  it("lets a speed picked in YouTube's menu win for the Current Short only", async () => {
    const settings = createTestSettingsStore({ speedOn: true, preferredSpeed: 1.5 });
    const shortsFeed = await mountShortsFeed(page, { settings });
    await expect.poll(() => shortsFeed.playbackSpeed()).toBe(1.5);
    await aMomentLater();

    shortsFeed.setPlaybackSpeed(0.75);
    // Pausing and playing on, or another setting changing, does not take the viewer's pick away.
    shortsFeed.pause();
    shortsFeed.resume();
    await settings.set({ autoScroll: true });
    await aMomentLater();
    expect(shortsFeed.playbackSpeed()).toBe(0.75);

    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 2 is current']);
    await expect.poll(() => shortsFeed.playbackSpeed()).toBe(1.5);
  });

  it.each([0.5, 3])('Advances at the true end at %s×', async (preferredSpeed) => {
    const shortsFeed = await mountShortsFeed(page, {
      settings: createTestSettingsStore({ speedOn: true, preferredSpeed }),
    });

    await expectTimeline(
      shortsFeed,
      ['Short 1 started over', 'Short 2 is current', 'Short 2 started over', 'Short 3 is current'],
      { timeout: 25_000 },
    );
  });

  it('never touches the hidden watch-page player behind the Shorts Feed', async () => {
    const shortsFeed = await mountShortsFeed(page, {
      settings: createTestSettingsStore({ speedOn: true, preferredSpeed: 2 }),
    });

    await expect.poll(() => shortsFeed.playbackSpeed()).toBe(2);
    expect(shortsFeed.hiddenPlayerSpeed()).toBe(1);
  });

  it('stops changing the speed once torn down', async () => {
    const settings = createTestSettingsStore({ speedOn: true, preferredSpeed: 2 });
    const shortsFeed = await mountShortsFeed(page, { settings });
    await expect.poll(() => shortsFeed.playbackSpeed()).toBe(2);

    shortsFeed.unmountEngine();
    await settings.set({ preferredSpeed: 3 });
    await aMomentLater();

    expect(shortsFeed.playbackSpeed()).toBe(2);
  });
});
