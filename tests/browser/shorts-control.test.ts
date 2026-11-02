import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { aMomentLater, expectTimeline, mountShortsFeed } from './support/shorts-feed';
import { createTestSettingsStore } from './support/stores';
import { hasNextShort, testPages } from './support/test-pages';

const SOUND = 'See more videos using this sound';

describe.each(testPages)('on $name', (page) => {
  it('places the Shorts Control in the rail just before the sound thumbnail', async () => {
    const shortsFeed = await mountShortsFeed(page);

    await expect.poll(() => shortsFeed.railLabels().slice(-2)).toEqual(['Auto-Scroll', SOUND]);
    expect(shortsFeed.railLabels().filter((label) => label === 'Auto-Scroll')).toHaveLength(1);
  });

  async function withControl(settings = createTestSettingsStore()) {
    const shortsFeed = await mountShortsFeed(page, { settings });
    await expect.poll(() => shortsFeed.railControl('Auto-Scroll')).toBeDefined();
    return { shortsFeed, control: () => shortsFeed.railControl('Auto-Scroll')! };
  }

  it('can be reached and pressed from the keyboard', async () => {
    const settings = createTestSettingsStore();
    const { shortsFeed, control } = await withControl(settings);

    control().focus();
    expect(shortsFeed.document.activeElement).toBe(control());
    await userEvent.keyboard(' ');

    await expect.poll(async () => (await settings.get()).autoScroll).toBe(false);
  });

  it("shows a tooltip in YouTube's style under the button while pointed at", async () => {
    const settings = createTestSettingsStore();
    const { shortsFeed, control } = await withControl(settings);
    expect(shortsFeed.tooltip()).toBeUndefined();

    shortsFeed.hover(control());

    await expect.poll(() => shortsFeed.tooltip()?.text).toBe('Turn Auto-Scroll off');
    const tooltip = shortsFeed.tooltip()!.element;
    const style = getComputedStyle(tooltip);
    expect(style.backgroundColor).toBe('rgb(96, 96, 96)');
    expect(style.color).toBe('rgb(255, 255, 255)');
    expect(style.fontSize).toBe('12px');
    expect(style.borderRadius).toBe('4px');
    const button = control().getBoundingClientRect();
    const box = tooltip.getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(button.bottom);
    expect(Math.abs((box.left + box.right) / 2 - (button.left + button.right) / 2)).toBeLessThan(1);

    shortsFeed.unhover(control());
    await expect.poll(() => shortsFeed.tooltip()).toBeUndefined();
  });

  it('says in its tooltip what a click will do', async () => {
    const settings = createTestSettingsStore({ autoScroll: false });
    const { shortsFeed, control } = await withControl(settings);

    shortsFeed.hover(control());

    await expect.poll(() => shortsFeed.tooltip()?.text).toBe('Turn Auto-Scroll on');
  });

  it("is the size and shape of YouTube's rail buttons, with the same label and colours", async () => {
    const { shortsFeed } = await withControl();
    const looks = (name: string) => {
      const { button, item, caption } = shortsFeed.railItem(name)!;
      const style = getComputedStyle(button);
      const label = getComputedStyle(caption!);
      return {
        width: button.getBoundingClientRect().width,
        height: button.getBoundingClientRect().height,
        itemHeight: item.getBoundingClientRect().height,
        borderRadius: style.borderRadius,
        background: style.backgroundColor,
        color: style.color,
        label: [label.fontFamily, label.fontSize, label.fontWeight, label.lineHeight, label.color, label.marginTop],
      };
    };

    expect(looks('Auto-Scroll')).toEqual(looks('Share'));
    expect(looks('Auto-Scroll')).toMatchObject({ width: 48, height: 48, borderRadius: '24px' });
  });

  it('is the same distance from its neighbours as YouTube spaces its own buttons', async () => {
    const { shortsFeed, control } = await withControl();
    const top = (label: string) => shortsFeed.railControl(label)!.getBoundingClientRect().top;

    expect(top('Remix') - top('Share')).toBe(78);
    expect(control().getBoundingClientRect().top - top('Remix')).toBe(78);
  });

  it('keeps the captured Native Look in both themes even if YouTube renames its button classes', async () => {
    const { shortsFeed, control } = await withControl();
    shortsFeed.dropYouTubeStyles();

    for (const [theme, background, color] of [
      ['dark', 'rgba(255, 255, 255, 0.1)', 'rgb(241, 241, 241)'],
      ['light', 'rgba(0, 0, 0, 0.05)', 'rgb(15, 15, 15)'],
    ] as const) {
      shortsFeed.setTheme(theme);
      await expect.poll(() => getComputedStyle(control()).backgroundColor).toBe(background);
      const style = getComputedStyle(control());
      expect(style.color).toBe(color);
      expect(control().getBoundingClientRect()).toMatchObject({ width: 48, height: 48 });
      expect(style.borderRadius).toBe('24px');
      const label = getComputedStyle(shortsFeed.railItem('Auto-Scroll')!.caption!);
      expect([label.fontSize, label.lineHeight, label.color]).toEqual(['12px', '18px', color]);
    }
  });

  it('is a pressed toggle button while Auto-Scroll is on', async () => {
    const { control } = await withControl();

    expect(control().tagName).toBe('BUTTON');
    expect(control().getAttribute('aria-pressed')).toBe('true');
  });

  it('switches Auto-Scroll off with a click, and on again with another', async () => {
    const settings = createTestSettingsStore();
    const { control } = await withControl(settings);

    control().click();
    await expect.poll(async () => (await settings.get()).autoScroll).toBe(false);
    await expect.poll(() => control().getAttribute('aria-pressed')).toBe('false');

    control().click();
    await expect.poll(async () => (await settings.get()).autoScroll).toBe(true);
    await expect.poll(() => control().getAttribute('aria-pressed')).toBe('true');
  });

  it('shows Auto-Scroll switched from the Popup or another tab', async () => {
    const settings = createTestSettingsStore();
    const { control } = await withControl(settings);

    await settings.set({ autoScroll: false });

    await expect.poll(() => control().getAttribute('aria-pressed')).toBe('false');
  });

  it('goes from every tab at once when hidden from the Popup, and comes back when shown', async () => {
    const settings = createTestSettingsStore();
    const { shortsFeed: tab1 } = await withControl(settings);
    const { shortsFeed: tab2 } = await withControl(settings);

    await settings.set({ shortsControlShown: false });

    for (const tab of [tab1, tab2]) {
      await expect.poll(() => tab.railLabels()).not.toContain('Auto-Scroll');
    }

    await settings.set({ shortsControlShown: true });

    for (const tab of [tab1, tab2]) {
      await expect.poll(() => tab.railLabels().slice(-2)).toEqual(['Auto-Scroll', SOUND]);
    }
  });

  it('never shows while hidden, and the rail stays as YouTube made it', async () => {
    const shortsFeed = await mountShortsFeed(page, {
      settings: createTestSettingsStore({ shortsControlShown: false }),
    });
    await aMomentLater();

    expect(shortsFeed.railLabels()).toEqual(['like this video along with 238 thousand other people', 'View 1,985 comments', 'Share', 'Remix', SOUND]);
  });

  it('leaves the rail when the viewer leaves the Shorts Feed', async () => {
    const { shortsFeed } = await withControl();

    shortsFeed.navigate('/feed/subscriptions');
    shortsFeed.clock.advance(500);

    expect(shortsFeed.railLabels()).not.toContain('Auto-Scroll');
  });

  it('goes with the engine when it is torn down', async () => {
    const { shortsFeed } = await withControl();

    shortsFeed.unmountEngine();

    expect(shortsFeed.railLabels()).not.toContain('Auto-Scroll');
  });

  it('draws a different icon for on and off', async () => {
    const settings = createTestSettingsStore();
    const { control } = await withControl(settings);
    const icon = () => control().querySelector('svg')?.outerHTML;
    const on = icon();

    await settings.set({ autoScroll: false });
    await expect.poll(() => control().getAttribute('aria-pressed')).toBe('false');

    expect(on).toBeDefined();
    expect(icon()).toBeDefined();
    expect(icon()).not.toBe(on);
  });
});

describe.each(testPages.filter(hasNextShort))('on $name', (page) => {
  it('is back on the next Short after an Advance, though YouTube rebuilt the rail', async () => {
    const shortsFeed = await mountShortsFeed(page);

    await expectTimeline(shortsFeed, ['Short 1 started over', 'Short 2 is current']);

    await expect.poll(() => shortsFeed.railLabels().slice(-2)).toEqual(['Auto-Scroll', SOUND]);
    expect(shortsFeed.railLabels()).toHaveLength(6);
  });

  it('is back on each Short the viewer moves to by hand', async () => {
    const shortsFeed = await mountShortsFeed(page, { settings: createTestSettingsStore({ autoScroll: false }) });
    await expect.poll(() => shortsFeed.railLabels()).toContain('Auto-Scroll');

    for (const short of [2, 3]) {
      shortsFeed.pressNextVideo();
      await expect.poll(() => shortsFeed.timeline).toContain(`Short ${short} is current`);
      await expect.poll(() => shortsFeed.railLabels().slice(-2)).toEqual(['Auto-Scroll', SOUND]);
    }
  });
});
