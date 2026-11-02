import { describe, expect, it } from 'vitest';
import { aMomentLater, expectTimeline, mountShortsFeed } from './support/shorts-feed';
import { createTestSettingsStore } from './support/stores';
import { hasNextShort, testPages } from './support/test-pages';

describe.each(testPages.filter(hasNextShort))('on $name', (page) => {
  it('A switches Auto-Scroll off and on, with a confirmation each time', async () => {
    const settings = createTestSettingsStore({ autoScroll: true });
    const shortsFeed = await mountShortsFeed(page, { settings });

    await shortsFeed.pressKey('a');
    await expect.poll(async () => (await settings.get()).autoScroll).toBe(false);
    await expect.poll(() => shortsFeed.notice()?.text).toBe('Auto-Scroll off');

    await shortsFeed.pressKey('a');
    await expect.poll(async () => (await settings.get()).autoScroll).toBe(true);
    await expect.poll(() => shortsFeed.notice()?.text).toBe('Auto-Scroll on');
  });

  it('S switches Speed on at the Preferred Speed and off again, with a confirmation each time', async () => {
    const settings = createTestSettingsStore({ speedOn: false, preferredSpeed: 2 });
    const shortsFeed = await mountShortsFeed(page, { settings });

    await shortsFeed.pressKey('s');
    await expect.poll(() => shortsFeed.playbackSpeed()).toBe(2);
    await expect.poll(() => shortsFeed.notice()?.text).toBe('Speed on · 2×');

    await shortsFeed.pressKey('s');
    await expect.poll(() => shortsFeed.playbackSpeed()).toBe(1);
    await expect.poll(() => shortsFeed.notice()?.text).toBe('Speed off');
    expect((await settings.get()).speedOn).toBe(false);
  });

  it('works with Shift held, as capital A', async () => {
    const settings = createTestSettingsStore({ autoScroll: true });
    const shortsFeed = await mountShortsFeed(page, { settings });

    await shortsFeed.pressKey('A', { holding: 'Shift' });

    await expect.poll(async () => (await settings.get()).autoScroll).toBe(false);
  });

  it('lets the confirmation go after a moment', async () => {
    const shortsFeed = await mountShortsFeed(page);
    await shortsFeed.pressKey('a');
    await expect.poll(() => shortsFeed.notice()).toBeDefined();

    shortsFeed.clock.advance(5000);

    await expect.poll(() => shortsFeed.notice()).toBeUndefined();
  });

  it("does nothing while the viewer types in YouTube's search box", async () => {
    const settings = createTestSettingsStore({ autoScroll: true, speedOn: false });
    const shortsFeed = await mountShortsFeed(page, { settings });

    await shortsFeed.typeInSearch('a sad story');
    await aMomentLater();

    expect(await settings.get()).toMatchObject({ autoScroll: true, speedOn: false });
    expect(shortsFeed.notice()).toBeUndefined();
    expect(shortsFeed.document.querySelector<HTMLInputElement>('input[name="search_query"]')!.value).toBe('a sad story');
  });

  it.each(['Control', 'Alt', 'Meta'] as const)('does nothing with %s held', async (holding) => {
    const settings = createTestSettingsStore({ autoScroll: true });
    const shortsFeed = await mountShortsFeed(page, { settings });

    await shortsFeed.pressKey('a', { holding });
    await aMomentLater();

    expect((await settings.get()).autoScroll).toBe(true);
    expect(shortsFeed.notice()).toBeUndefined();
  });

  it('does nothing off the Shorts Feed', async () => {
    const settings = createTestSettingsStore({ autoScroll: true });
    const shortsFeed = await mountShortsFeed(page, { settings, path: '/' });

    await shortsFeed.pressKey('a');
    await aMomentLater();

    expect((await settings.get()).autoScroll).toBe(true);
    expect(shortsFeed.notice()).toBeUndefined();
  });

  it('ignores keys a script makes up, which no viewer pressed', async () => {
    const settings = createTestSettingsStore({ autoScroll: true });
    const shortsFeed = await mountShortsFeed(page, { settings });

    shortsFeed.pressKeyByScript('a');
    await aMomentLater();

    expect((await settings.get()).autoScroll).toBe(true);
  });

  it('answers to a rebound key, and no longer to the old one', async () => {
    const settings = createTestSettingsStore({
      autoScroll: true,
      shortcuts: { toggleAutoScroll: 'x', toggleSpeed: 's' },
    });
    const shortsFeed = await mountShortsFeed(page, { settings });

    await shortsFeed.pressKey('a');
    await aMomentLater();
    expect((await settings.get()).autoScroll).toBe(true);

    await shortsFeed.pressKey('x');
    await expect.poll(async () => (await settings.get()).autoScroll).toBe(false);
  });

  it("leaves YouTube's own up and down navigation to YouTube", async () => {
    const shortsFeed = await mountShortsFeed(page, { settings: createTestSettingsStore({ autoScroll: false }) });

    await shortsFeed.pressKey('ArrowDown');

    await expectTimeline(shortsFeed, ['Short 2 is current']);
    expect(shortsFeed.notice()).toBeUndefined();
  });

  it('stops answering once torn down', async () => {
    const settings = createTestSettingsStore({ autoScroll: true });
    const shortsFeed = await mountShortsFeed(page, { settings });

    shortsFeed.unmountEngine();
    await shortsFeed.pressKey('a');
    await aMomentLater();

    expect((await settings.get()).autoScroll).toBe(true);
  });
});
