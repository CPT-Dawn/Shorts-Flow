import { describe, expect, it } from 'vitest';
import { aMomentLater, expectTimeline, mountShortsFeed } from './support/shorts-feed';
import { createTestSettingsStore } from './support/stores';
import { feedPages, hasNextShort, testPages } from './support/test-pages';

describe.each(testPages)('on $name', (page) => {
  async function withQuickSettings(settings = createTestSettingsStore()) {
    const shortsFeed = await mountShortsFeed(page, { settings });
    await expect.poll(() => shortsFeed.railControl('Auto-Scroll')).toBeDefined();
    return shortsFeed;
  }

  it('opens from the Shorts Control without switching Auto-Scroll', async () => {
    const settings = createTestSettingsStore({ autoScroll: true });
    const shortsFeed = await withQuickSettings(settings);

    await shortsFeed.openQuickSettings();

    await expect.poll(() => shortsFeed.quickSettings()?.name).toBe('Quick settings');
    await aMomentLater();
    expect((await settings.get()).autoScroll).toBe(true);
  });

  it('has an opener a pointer can hit 24 px across, though it looks 22 px', async () => {
    const shortsFeed = await withQuickSettings();
    const opener = shortsFeed.quickSettingsButton()!;
    const box = opener.getBoundingClientRect();
    expect([box.width, box.height]).toEqual([22, 22]);

    const middle = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    // Just outside what the eye sees, just inside 24 px.
    for (const [x, y] of [[11.6, 0], [-11.6, 0], [0, 11.6], [0, -11.6]] as const) {
      expect(shortsFeed.document.elementFromPoint(middle.x + x, middle.y + y)).toBe(opener);
    }
  });

  it('lists Skip Sponsored Shorts, Speed and the Preferred Speed, as they are set', async () => {
    const shortsFeed = await withQuickSettings(
      createTestSettingsStore({ skipSponsoredShorts: true, speedOn: false, preferredSpeed: 1.5 }),
    );

    await shortsFeed.openQuickSettings();

    await expect.poll(() => shortsFeed.quickSettings()?.items).toEqual([
      { role: 'menuitemcheckbox', name: 'Skip Sponsored Shorts', checked: true },
      { role: 'menuitemcheckbox', name: 'Speed', checked: false },
      { role: 'menuitem', name: 'Preferred Speed 1.5×', expanded: false },
    ]);
  });

  it('switches Skip Sponsored Shorts and Speed, for every tab and the Popup', async () => {
    const settings = createTestSettingsStore({ skipSponsoredShorts: true, speedOn: false, preferredSpeed: 2 });
    const shortsFeed = await withQuickSettings(settings);
    await shortsFeed.openQuickSettings();

    await shortsFeed.chooseQuickSetting('Skip Sponsored Shorts');
    await shortsFeed.chooseQuickSetting('Speed');

    await expect.poll(async () => await settings.get()).toMatchObject({ skipSponsoredShorts: false, speedOn: true });
    await expect.poll(() => shortsFeed.playbackSpeed()).toBe(2);
    expect(shortsFeed.quickSettings()?.items.slice(0, 2).map((item) => item.checked)).toEqual([false, true]);
  });

  it('picks the Preferred Speed from a list of speeds, then goes back', async () => {
    const settings = createTestSettingsStore({ speedOn: true, preferredSpeed: 1.5 });
    const shortsFeed = await withQuickSettings(settings);
    await shortsFeed.openQuickSettings();

    await shortsFeed.chooseQuickSetting('Preferred Speed');

    await expect.poll(() => shortsFeed.quickSettings()?.name).toBe('Preferred Speed');
    const speeds = shortsFeed.quickSettings()!.items.filter((item) => item.role === 'menuitemradio');
    expect(speeds.map((item) => item.name)).toEqual(
      ['0.5', '0.75', '1', '1.25', '1.5', '1.75', '2', '2.25', '2.5', '2.75', '3'].map((speed) => `${speed}×`),
    );
    expect(speeds.filter((item) => item.checked).map((item) => item.name)).toEqual(['1.5×']);

    await shortsFeed.chooseQuickSetting('2.5×');

    await expect.poll(async () => (await settings.get()).preferredSpeed).toBe(2.5);
    await expect.poll(() => shortsFeed.playbackSpeed()).toBe(2.5);
    await expect.poll(() => shortsFeed.quickSettings()?.name).toBe('Quick settings');
    await expect.poll(() => shortsFeed.quickSettings()?.items[2]?.name).toBe('Preferred Speed 2.5×');
  });

  it('shows changes made in the Popup or another tab while it is open', async () => {
    const settings = createTestSettingsStore({ skipSponsoredShorts: true, speedOn: false, preferredSpeed: 1.5 });
    const shortsFeed = await withQuickSettings(settings);
    await shortsFeed.openQuickSettings();

    await settings.set({ skipSponsoredShorts: false, speedOn: true, preferredSpeed: 3 });

    await expect.poll(() => shortsFeed.quickSettings()?.items).toEqual([
      { role: 'menuitemcheckbox', name: 'Skip Sponsored Shorts', checked: false },
      { role: 'menuitemcheckbox', name: 'Speed', checked: true },
      { role: 'menuitem', name: 'Preferred Speed 3×', expanded: false },
    ]);
  });

  it('opens and works from the keyboard, and gives the focus back on Escape', async () => {
    const settings = createTestSettingsStore({ speedOn: false, preferredSpeed: 1.5 });
    const shortsFeed = await withQuickSettings(settings);
    const opener = shortsFeed.quickSettingsButton()!;
    expect(opener.getAttribute('aria-haspopup')).toBe('menu');
    expect(opener.getAttribute('aria-expanded')).toBe('false');

    opener.focus();
    await shortsFeed.pressKey('Enter');
    await expect.poll(() => shortsFeed.quickSettings()?.focused).toBe('Skip Sponsored Shorts');
    expect(opener.getAttribute('aria-expanded')).toBe('true');

    await shortsFeed.pressKey('ArrowDown');
    expect(shortsFeed.quickSettings()?.focused).toBe('Speed');
    await shortsFeed.pressKey(' ');
    await expect.poll(async () => (await settings.get()).speedOn).toBe(true);

    await shortsFeed.pressKey('End');
    expect(shortsFeed.quickSettings()?.focused).toBe('Preferred Speed 1.5×');
    await shortsFeed.pressKey('ArrowRight');
    await expect.poll(() => shortsFeed.quickSettings()?.focused).toBe('1.5×');
    await shortsFeed.pressKey('ArrowDown');
    await shortsFeed.pressKey('Enter');
    await expect.poll(async () => (await settings.get()).preferredSpeed).toBe(1.75);
    await expect.poll(() => shortsFeed.quickSettings()?.focused).toBe('Preferred Speed 1.75×');

    await shortsFeed.pressKey('Escape');

    expect(shortsFeed.quickSettings()).toBeUndefined();
    expect(shortsFeed.document.activeElement).toBe(opener);
    expect(opener.getAttribute('aria-expanded')).toBe('false');
    expect(await settings.get()).toMatchObject({ autoScroll: true, speedOn: true });
  });

  it('goes back from the list of speeds with Escape before closing', async () => {
    const shortsFeed = await withQuickSettings();
    shortsFeed.quickSettingsButton()!.focus();
    await shortsFeed.pressKey('Enter');
    await shortsFeed.pressKey('ArrowUp');
    await shortsFeed.pressKey('Enter');
    await expect.poll(() => shortsFeed.quickSettings()?.name).toBe('Preferred Speed');

    await shortsFeed.pressKey('Escape');

    expect(shortsFeed.quickSettings()?.name).toBe('Quick settings');
    expect(shortsFeed.quickSettings()?.focused).toMatch(/^Preferred Speed/);
  });

  it('works a Shortcut typed while it has the focus once, and stays open', async () => {
    const settings = createTestSettingsStore({ autoScroll: true, speedOn: false });
    const shortsFeed = await withQuickSettings(settings);
    shortsFeed.quickSettingsButton()!.focus();
    await shortsFeed.pressKey('Enter');
    await expect.poll(() => shortsFeed.quickSettings()?.focused).toBe('Skip Sponsored Shorts');

    await shortsFeed.pressKey('s');
    await shortsFeed.pressKey('a');
    await aMomentLater();

    expect(await settings.get()).toMatchObject({ autoScroll: false, speedOn: true });
    expect(shortsFeed.quickSettings()?.items[1]).toMatchObject({ name: 'Speed', checked: true });
    expect(shortsFeed.quickSettings()?.focused).toBe('Skip Sponsored Shorts');
  });

  it('closes on a click elsewhere, changing nothing', async () => {
    const settings = createTestSettingsStore();
    const shortsFeed = await withQuickSettings(settings);
    await shortsFeed.openQuickSettings();
    await expect.poll(() => shortsFeed.quickSettings()).toBeDefined();

    await shortsFeed.clickElsewhere();

    await expect.poll(() => shortsFeed.quickSettings()).toBeUndefined();
    expect(await settings.get()).toEqual(await createTestSettingsStore().get());
  });

  it('closes when its opener is clicked again', async () => {
    const shortsFeed = await withQuickSettings();
    await shortsFeed.openQuickSettings();
    await expect.poll(() => shortsFeed.quickSettings()).toBeDefined();

    await shortsFeed.openQuickSettings();

    await expect.poll(() => shortsFeed.quickSettings()).toBeUndefined();
  });

  it('opens with a right-click on the Shorts Control, which switches nothing', async () => {
    const settings = createTestSettingsStore({ autoScroll: true });
    const shortsFeed = await withQuickSettings(settings);

    await shortsFeed.rightClickShortsControl();

    await expect.poll(() => shortsFeed.quickSettings()?.name).toBe('Quick settings');
    expect((await settings.get()).autoScroll).toBe(true);
  });

  it("looks like YouTube's menus in both themes, beside the Shorts Control", async () => {
    const shortsFeed = await withQuickSettings();
    await shortsFeed.openQuickSettings();
    await expect.poll(() => shortsFeed.quickSettings()).toBeDefined();

    for (const [theme, background, color] of [
      ['dark', 'rgb(40, 40, 40)', 'rgb(241, 241, 241)'],
      ['light', 'rgb(255, 255, 255)', 'rgb(15, 15, 15)'],
    ] as const) {
      shortsFeed.setTheme(theme);
      const menu = shortsFeed.quickSettings()!.element;
      await expect.poll(() => getComputedStyle(menu).backgroundColor).toBe(background);
      const style = getComputedStyle(menu);
      expect([style.color, style.borderRadius, style.fontSize]).toEqual([color, '12px', '14px']);
      expect(style.fontFamily).toMatch(/^Roboto/);
      const item = menu.querySelector('[role^="menuitem"]')!.getBoundingClientRect();
      expect(item.height).toBe(40);
    }

    const box = shortsFeed.quickSettings()!.element.getBoundingClientRect();
    const control = shortsFeed.railControl('Auto-Scroll')!.getBoundingClientRect();
    expect(box.right).toBeLessThanOrEqual(control.left);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(shortsFeed.window.innerHeight);
  });

  it('goes with the Shorts Control when it is hidden from the Popup', async () => {
    const settings = createTestSettingsStore();
    const shortsFeed = await withQuickSettings(settings);
    await shortsFeed.openQuickSettings();
    await expect.poll(() => shortsFeed.quickSettings()).toBeDefined();

    await settings.set({ shortsControlShown: false });

    await expect.poll(() => shortsFeed.quickSettings()).toBeUndefined();
    expect(shortsFeed.quickSettingsButton()).toBeUndefined();
  });

  it('goes with the engine when it is torn down', async () => {
    const shortsFeed = await withQuickSettings();
    await shortsFeed.openQuickSettings();
    await expect.poll(() => shortsFeed.quickSettings()).toBeDefined();

    shortsFeed.unmountEngine();

    expect(shortsFeed.quickSettings()).toBeUndefined();
    expect(shortsFeed.quickSettingsButton()).toBeUndefined();
  });
});

describe.each(feedPages.filter(hasNextShort))('on $name', (page) => {
  async function withQuickSettings(settings = createTestSettingsStore()) {
    const shortsFeed = await mountShortsFeed(page, { settings });
    await expect.poll(() => shortsFeed.quickSettingsButton()).toBeDefined();
    return shortsFeed;
  }

  it('is a Hold: the Current Short loops while it is open', async () => {
    const shortsFeed = await withQuickSettings();

    await shortsFeed.openQuickSettings();

    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 1 started over']);
    await aMomentLater();
    expect(shortsFeed.timeline).not.toContain('Short 2 is current');
  });

  it('Advances again at the next end once it is closed', async () => {
    const shortsFeed = await withQuickSettings();
    await shortsFeed.openQuickSettings();
    await expectTimeline(shortsFeed, ['Short 1 started over']);

    await shortsFeed.pressKey('Escape');

    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 1 started over', 'Short 2 is current']);
  });

  it("keeps the arrow keys in the menu, so YouTube doesn't move the feed", async () => {
    const shortsFeed = await withQuickSettings(createTestSettingsStore({ autoScroll: false }));
    await shortsFeed.openQuickSettings();
    await expect.poll(() => shortsFeed.quickSettings()?.focused).toBe('Skip Sponsored Shorts');

    await shortsFeed.pressKey('ArrowDown');
    await aMomentLater();

    expect(shortsFeed.quickSettings()?.focused).toBe('Speed');
    expect(shortsFeed.timeline).not.toContain('Short 2 is current');
  });
});
