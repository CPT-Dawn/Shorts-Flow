import { describe, expect, it } from 'vitest';
import { aMomentLater, expectTimeline, mountShortsFeed, type ShortsFeed } from './support/shorts-feed';
import { feedPages, hasNextShort, panelOpenPages } from './support/test-pages';

describe.each(feedPages.filter(hasNextShort))('on $name', (page) => {
  it('stays on a paused Short dragged to its end', async () => {
    const shortsFeed = await mountShortsFeed(page);
    shortsFeed.pause();

    shortsFeed.scrubToEnd();
    await aMomentLater();
    await aMomentLater();

    expect(shortsFeed.timeline).not.toContain('Short 2 is current');
  });

  it('Advances again at the next end once the Short plays on', async () => {
    const shortsFeed = await mountShortsFeed(page);
    shortsFeed.pause();
    shortsFeed.scrubToEnd();
    await aMomentLater();

    shortsFeed.play();

    // It plays again from the start, and Advances at the end of that playthrough.
    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 1 started over', 'Short 2 is current']);
  });
});

const VIEWER_STEPS_IN: [string, (shortsFeed: ShortsFeed) => unknown, (shortsFeed: ShortsFeed) => unknown][] = [
  ['a YouTube menu is open', (feed) => feed.openMenu(), (feed) => feed.closeMenu()],
  ['the Share dialog is open', (feed) => feed.openShareDialog(), (feed) => feed.closeShareDialog()],
  ['the viewer is in the search box', (feed) => feed.clickSearchBox(), (feed) => feed.leaveSearchBox()],
];

describe.each(feedPages.filter(hasNextShort))('on $name', (page) => {
  it.each(VIEWER_STEPS_IN)('lets the Current Short loop while %s', async (_, stepIn) => {
    const shortsFeed = await mountShortsFeed(page);

    await stepIn(shortsFeed);

    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 1 started over']);
    await aMomentLater();
    expect(shortsFeed.timeline).not.toContain('Short 2 is current');
  });

  it.each(VIEWER_STEPS_IN)('Advances again at the next end once no longer %s', async (_, stepIn, stepOut) => {
    const shortsFeed = await mountShortsFeed(page);
    await stepIn(shortsFeed);
    await expectTimeline(shortsFeed, ['Short 1 started over']);

    await stepOut(shortsFeed);

    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 1 started over', 'Short 2 is current']);
  });
});

const BY_HAND: [string, (shortsFeed: ShortsFeed) => Promise<void>][] = [
  ['turned the mouse wheel', (feed) => feed.scrollByHand()],
  ['pressed ArrowDown', (feed) => feed.pressArrowDownByHand()],
  ['clicked Next video', (feed) => feed.clickNextVideoByHand()],
];

/** The few seconds a manual scroll holds the feed for. */
const A_FEW_SECONDS = 3000;

describe.each(feedPages.filter(hasNextShort))('on $name', (page) => {
  it.each(BY_HAND)('gives the viewer a few seconds after they %s', async (_, moveByHand) => {
    const shortsFeed = await mountShortsFeed(page);

    await moveByHand(shortsFeed);

    await expectTimeline(shortsFeed, ['Short 2 is current', 'Short 2 started over', 'Short 2 started over']);
    expect(shortsFeed.timeline).not.toContain('Short 3 is current');
  });

  it.each(BY_HAND)('Advances again at the next end a few seconds after they %s', async (_, moveByHand) => {
    const shortsFeed = await mountShortsFeed(page);
    await moveByHand(shortsFeed);
    await expectTimeline(shortsFeed, ['Short 2 is current', 'Short 2 started over']);

    shortsFeed.clock.advance(A_FEW_SECONDS);

    await expectTimeline(shortsFeed, [
      'Short 2 is current',
      'Short 2 started over',
      'Short 2 started over',
      'Short 3 is current',
    ]);
  });

  it('still Advances right after the viewer presses Space, which plays and pauses, not scrolls', async () => {
    const shortsFeed = await mountShortsFeed(page);

    await shortsFeed.pressKey(' ');

    // No time passes on the engine's clock: a Hold from the key would never end.
    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 2 is current']);
  });

  it('still Advances in a background tab', async () => {
    const shortsFeed = await mountShortsFeed(page);

    shortsFeed.moveToBackground();

    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 2 is current']);
  });
});

describe.each(panelOpenPages)('on $name', (page) => {
  it('lets the Current Short loop while the panel is open', async () => {
    const shortsFeed = await mountShortsFeed(page);

    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 1 started over']);
    await aMomentLater();
    expect(shortsFeed.timeline).not.toContain('Short 2 is current');
  });

  it('Advances again at the next end once the panel is closed', async () => {
    const shortsFeed = await mountShortsFeed(page);
    await expectTimeline(shortsFeed, ['Short 1 started over']);

    shortsFeed.closePanel();

    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 1 started over', 'Short 2 is current']);
  });
});
