import { describe, expect, it } from 'vitest';
import { aMomentLater, expectTimeline, mountShortsFeed, TWO_SHORTS } from './support/shorts-feed';
import { createTestSettingsStore } from './support/stores';
import { hasNextShort, testPages } from './support/test-pages';

describe.each(testPages.filter(hasNextShort))('on $name', (page) => {
  it('Advances from the first Short to the next one when it ends', async () => {
    const shortsFeed = await mountShortsFeed(page);

    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 2 is current']);
  });

  it('keeps Advancing, one Short at a time, each at its own end', async () => {
    const shortsFeed = await mountShortsFeed(page);

    await expectTimeline(
      shortsFeed,
      ['Short 1 started over', 'Short 2 is current', 'Short 2 started over', 'Short 3 is current'],
      { timeout: 15_000 },
    );
  });

  it('Advances at the true end at 2× speed too', async () => {
    const shortsFeed = await mountShortsFeed(page);
    shortsFeed.setPlaybackSpeed(2);

    await expectTimeline(shortsFeed, [
      'Short 1 started over',
      'Short 2 is current',
      'Short 2 started over',
      'Short 3 is current',
    ]);
  });

  it('never scrolls or reloads the page itself: YouTube moves the feed', async () => {
    const shortsFeed = await mountShortsFeed(page);

    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 2 is current']);
    await aMomentLater();

    expect(shortsFeed.timeline).not.toContain('page scrolled by script');
    expect(shortsFeed.timeline).not.toContain('page reloaded');
  });

  it('lets the Current Short loop while Auto-Scroll is off', async () => {
    const shortsFeed = await mountShortsFeed(page, { settings: createTestSettingsStore({ autoScroll: false }) });

    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 1 started over']);
    expect(shortsFeed.timeline).not.toContain('Short 2 is current');
  });

  it('applies Auto-Scroll being switched off and on at once, in every open tab', async () => {
    const settings = createTestSettingsStore();
    const tabs = [await mountShortsFeed(page, { settings }), await mountShortsFeed(page, { settings })];
    const timelines = () => tabs.map((tab) => tab.timeline.slice(0, 2));

    await settings.set({ autoScroll: false });
    await expect.poll(timelines, TWO_SHORTS).toEqual([
      ['Short 1 started over', 'Short 1 started over'],
      ['Short 1 started over', 'Short 1 started over'],
    ]);
    await settings.set({ autoScroll: true });

    for (const tab of tabs) {
      await expectTimeline(tab, ['Short 1 started over', 'Short 1 started over', 'Short 1 started over', 'Short 2 is current']);
    }
  });

  it('pays no attention to the hidden watch-page player behind the Shorts Feed', async () => {
    const shortsFeed = await mountShortsFeed(page);
    shortsFeed.pause();

    await shortsFeed.playHiddenWatchPlayer();
    await aMomentLater();

    expect(shortsFeed.timeline).toEqual([]);
  });
});
