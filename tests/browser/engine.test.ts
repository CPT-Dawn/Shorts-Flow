import { describe, expect, it, vi } from 'vitest';
import { aMomentLater, expectTimeline, mountShortsFeed } from './support/shorts-feed';
import { createTestSessionStore, createTestSettingsStore } from './support/stores';
import { feedPages, hasNextShort } from './support/test-pages';

// Longer than Shorts Flow takes to notice YouTube has changed pages.
const A_SECOND = 1000;

describe.each(feedPages.filter(hasNextShort))('on $name', (page) => {
  it('keeps following YouTube when a feature fails to mount', async () => {
    const failing = vi.spyOn(console, 'error').mockImplementation(() => {});
    // The Session is the last feature to mount; Auto-Scroll is already running by then.
    const session = createTestSessionStore();
    session.watch = () => {
      throw new Error('YouTube changed something');
    };
    const shortsFeed = await mountShortsFeed(page, { session });
    expect(failing).toHaveBeenCalled();

    shortsFeed.navigate('/');
    shortsFeed.clock.advance(A_SECOND);

    // Off the Shorts Feed, Auto-Scroll stops with the rest of the visit.
    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 1 started over']);
    expect(shortsFeed.timeline).not.toContain('Short 2 is current');
  });

  it('switches a setting back on a second click straight after the first', async () => {
    const settings = createTestSettingsStore({ autoScroll: true });
    const shortsFeed = await mountShortsFeed(page, { settings });
    await expect.poll(() => shortsFeed.railControl('Auto-Scroll')).toBeDefined();
    const control = shortsFeed.railControl('Auto-Scroll')!;

    // Both before the store reports the first back.
    control.click();
    control.click();
    await aMomentLater();

    expect((await settings.get()).autoScroll).toBe(true);
  });
});
