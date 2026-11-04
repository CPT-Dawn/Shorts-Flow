import { describe, expect, it, vi } from 'vitest';
import { whileOnShortsFeed } from '@/engine/route';
import { createTestClock } from './support/clock';
import { aMomentLater, expectTimeline, mountShortsFeed } from './support/shorts-feed';
import { createTestSettingsStore } from './support/stores';
import { feedPages, hasNextShort, testPages } from './support/test-pages';

// Longer than Shorts Flow takes to notice YouTube has changed pages.
const A_SECOND = 1000;

describe.each(feedPages.filter(hasNextShort))('on $name', (page) => {
  it.each([
    ['Home', '/'],
    ['a watch page', '/watch'],
    ['Search', '/results'],
    ['a channel', '/@channel1'],
    ['a channel’s Shorts tab', '/@channel1/shorts'],
    ['Subscriptions', '/feed/subscriptions'],
  ])('does nothing on %s', async (_, path) => {
    const shortsFeed = await mountShortsFeed(page, { path });

    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 1 started over']);
    expect(shortsFeed.timeline).not.toContain('Short 2 is current');
  });

  it('starts when the viewer reaches the Shorts Feed inside YouTube', async () => {
    const shortsFeed = await mountShortsFeed(page, { path: '/' });

    shortsFeed.navigate(page.path);
    shortsFeed.clock.advance(A_SECOND);

    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 2 is current']);
  });

  it('stops when the viewer leaves the Shorts Feed, and starts again on return', async () => {
    const shortsFeed = await mountShortsFeed(page);

    shortsFeed.navigate('/');
    shortsFeed.clock.advance(A_SECOND);
    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 1 started over']);
    shortsFeed.navigate(page.path);
    shortsFeed.clock.advance(A_SECOND);

    await expectTimeline(shortsFeed, [
      'Short 1 started over',
      'Short 1 started over',
      'Short 1 started over',
      'Short 2 is current',
    ]);
  });
});

describe.each(testPages)('teardown on $name', (page) => {
  it('leaves nothing acting once torn down', async () => {
    const settings = createTestSettingsStore();
    const shortsFeed = await mountShortsFeed(page, { settings });

    shortsFeed.unmountEngine();
    await settings.set({ autoScroll: true });
    shortsFeed.clock.advance(10 * A_SECOND);

    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 1 started over']);
    expect(shortsFeed.timeline).not.toContain('Short 2 is current');
    expect(shortsFeed.clock.pending).toBe(0);
  });

  it('tears down when the extension’s content-script context goes away', async () => {
    const context = new AbortController();
    const shortsFeed = await mountShortsFeed(page, { signal: context.signal });

    context.abort();
    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 1 started over']);
    await aMomentLater();

    expect(shortsFeed.timeline).not.toContain('Short 2 is current');
    expect(shortsFeed.clock.pending).toBe(0);
  });
});

describe('the Route watcher', () => {
  it('keeps watching, and tries again, when a visit throws as it starts', () => {
    const clock = createTestClock();
    const page = { location: { pathname: '/shorts/vid00000001' } } as Window;
    const leave = vi.fn();
    const visit = vi.fn().mockImplementationOnce(() => {
      throw new Error('YouTube changed something');
    });
    visit.mockReturnValue(leave);

    expect(() => whileOnShortsFeed(page, clock, new AbortController().signal, visit)).toThrow();
    expect(clock.pending).toBe(1);
    clock.advance(A_SECOND);
    expect(visit).toHaveBeenCalledTimes(2);

    page.location.pathname = '/';
    clock.advance(A_SECOND);
    expect(leave).toHaveBeenCalledOnce();
  });
});
