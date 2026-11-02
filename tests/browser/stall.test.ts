import { describe, expect, it } from 'vitest';
import { aMomentLater, expectTimeline, mountShortsFeed, type ShortsFeed } from './support/shorts-feed';
import { feedPages, hasNextShort, testPages } from './support/test-pages';

/** How long Shorts Flow gives YouTube to move on before it calls it a Stall. */
const BOUNDED_WAIT = 3000;

const stallPages = testPages.filter((page) => !hasNextShort(page));

it('has a test page with no next Short', () => {
  expect(stallPages.length).toBeGreaterThan(0);
});

describe.each(stallPages)('on $name', (page) => {
  it('shows a quiet notice with a retry once the bounded wait runs out without a next Short', async () => {
    const shortsFeed = await mountShortsFeed(page);
    await expectTimeline(shortsFeed, ['Short 1 started over']);

    expect(shortsFeed.notice()).toBeUndefined();
    shortsFeed.clock.advance(BOUNDED_WAIT);

    await expect.poll(() => shortsFeed.notice()?.text).toBe("Couldn't find the next Short");
    expect(shortsFeed.notice()?.actions).toEqual(['Retry']);
  });

  async function stalled() {
    const shortsFeed = await mountShortsFeed(page);
    await expectTimeline(shortsFeed, ['Short 1 started over']);
    shortsFeed.clock.advance(BOUNDED_WAIT);
    await expect.poll(() => shortsFeed.notice()).toBeDefined();
    return shortsFeed;
  }

  it('never reloads or scrolls the page, and the Current Short plays on', async () => {
    const shortsFeed = await stalled();
    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 1 started over']);

    expect(shortsFeed.timeline).not.toContain('page scrolled by script');
    expect(shortsFeed.timeline).not.toContain('page reloaded');
    expect(shortsFeed.timeline).not.toContain('Short 2 is current');
  });

  it('Retry Advances once a next Short exists, and the notice goes', async () => {
    const shortsFeed = await stalled();
    shortsFeed.loadNextShort();

    shortsFeed.pressNoticeAction('Retry');

    await expect.poll(() => shortsFeed.timeline).toContain('Short 2 is current');
    expect(shortsFeed.notice()).toBeUndefined();
  });

  it('shows the notice again when Retry still finds no next Short', async () => {
    const shortsFeed = await stalled();

    shortsFeed.pressNoticeAction('Retry');
    expect(shortsFeed.notice()).toBeUndefined();
    shortsFeed.clock.advance(BOUNDED_WAIT);

    await expect.poll(() => shortsFeed.notice()?.actions).toEqual(['Retry']);
  });

  it('clears once a later Advance succeeds', async () => {
    const shortsFeed = await stalled();
    shortsFeed.loadNextShort();

    await expect.poll(() => shortsFeed.timeline, { timeout: 8000 }).toContain('Short 2 is current');
    await expect.poll(() => shortsFeed.notice()).toBeUndefined();
  });

  it('clears when the viewer moves on by hand', async () => {
    const shortsFeed = await stalled();
    shortsFeed.loadNextShort();

    shortsFeed.pressNextVideo();

    await expect.poll(() => shortsFeed.timeline).toContain('Short 2 is current');
    await expect.poll(() => shortsFeed.notice()).toBeUndefined();
  });

  it.each([
    ['turns the mouse wheel', (shortsFeed: ShortsFeed) => shortsFeed.scrollByHand()],
    ['presses ArrowDown', (shortsFeed: ShortsFeed) => shortsFeed.pressArrowDownByHand()],
  ])('clears when the viewer %s by hand, though there is still no next Short', async (_, moveByHand) => {
    const shortsFeed = await stalled();

    await moveByHand(shortsFeed);

    await expect.poll(() => shortsFeed.notice()).toBeUndefined();
    expect(shortsFeed.timeline).not.toContain('Short 2 is current');
  });

  it('clears when the viewer leaves the Shorts Feed', async () => {
    const shortsFeed = await stalled();

    shortsFeed.navigate('/feed/subscriptions');
    shortsFeed.clock.advance(500);

    expect(shortsFeed.notice()).toBeUndefined();
  });

  it('goes with the engine when it is torn down', async () => {
    const shortsFeed = await stalled();

    shortsFeed.unmountEngine();

    expect(shortsFeed.notice()).toBeUndefined();
  });

  it("looks like YouTube's toast in the dark theme: light, with dark text", async () => {
    const shortsFeed = await stalled();
    shortsFeed.setTheme('dark');
    const style = getComputedStyle(shortsFeed.notice()!.element);

    expect(style.backgroundColor).toBe('rgb(241, 241, 241)');
    expect(style.color).toBe('rgb(15, 15, 15)');
    expect(style.borderRadius).toBe('8px');
  });

  it("looks like YouTube's toast in the light theme: dark, with white text", async () => {
    const shortsFeed = await stalled();
    shortsFeed.setTheme('light');

    await expect.poll(() => getComputedStyle(shortsFeed.notice()!.element).backgroundColor).toBe('rgb(15, 15, 15)');
    expect(getComputedStyle(shortsFeed.notice()!.element).color).toBe('rgb(255, 255, 255)');
  });

  it('sits at the bottom left of the window, clear of the Short', async () => {
    const shortsFeed = await stalled();
    const notice = () => shortsFeed.notice()!.element.getBoundingClientRect();
    const short = shortsFeed.document.querySelector('video[src]')!.getBoundingClientRect();

    // Once it has slid in, as YouTube's toasts do.
    await expect.poll(() => notice().bottom).toBeLessThanOrEqual(shortsFeed.window.innerHeight - 30);
    expect(notice().left).toBeGreaterThan(0);
    expect(notice().right).toBeLessThanOrEqual(short.left);
  });
});

describe.each(feedPages.filter(hasNextShort))('on $name', (page) => {
  it('shows no notice when the Advance found the next Short', async () => {
    const shortsFeed = await mountShortsFeed(page);
    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 2 is current']);

    shortsFeed.clock.advance(BOUNDED_WAIT);
    await aMomentLater();

    expect(shortsFeed.notice()).toBeUndefined();
  });
});
