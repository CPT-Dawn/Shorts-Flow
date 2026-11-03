import { afterEach, describe, expect, it } from 'vitest';
import { commands, page } from 'vitest/browser';
import { mountPopup, type PopupOptions } from '@/popup/popup';
import { getMessage } from './support/messages';
import { createTestSessionStore, createTestSettingsStore } from './support/stores';

type Media = { colorScheme?: 'light' | 'dark' | null; forcedColors?: 'active' | 'none' | null };

declare module 'vitest/browser' {
  interface BrowserCommands {
    /** Playwright's `page.emulateMedia` (see vitest.config.ts). */
    emulateMedia(media: Media): Promise<void>;
  }
}

let unmount: (() => void) | undefined;

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  document.body.replaceChildren();
  await commands.emulateMedia({ colorScheme: null, forcedColors: null });
});

/** Opens the Popup as the toolbar button would, with test stand-ins for the browser. */
function openPopup(options: Partial<PopupOptions> = {}) {
  unmount = mountPopup(document, {
    settings: createTestSettingsStore(),
    session: createTestSessionStore(),
    getMessage,
    version: '3.0.0',
    whatsNew: { isUnread: async () => false, markUnread: async () => {}, markRead: async () => {} },
    readBrowser: async () => ({}),
    isOnShortsFeed: async () => true,
    ...options,
  });
}

/** An `rgb()` or `rgba()` colour as computed, in 0 to 255 per channel. */
function rgb(color: string): [number, number, number, number] {
  const parts = /rgba?\(([^)]+)\)/.exec(color)?.[1]?.split(/[\s,/]+/).filter(Boolean).map(Number);
  if (!parts || parts.length < 3) throw new Error(`Not an rgb() colour: ${color}`);
  return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
}

/** WCAG 2 contrast ratio between two opaque colours. */
function contrast(a: string, b: string): number {
  const luminance = (color: string) => {
    const [r, g, b] = rgb(color).slice(0, 3).map((channel) => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

const style = (element: Element, pseudo?: string) => getComputedStyle(element, pseudo);
const listSwitch = (name: string) => page.getByRole('list', { name: 'Settings' }).getByRole('switch', { name });

describe.each(['light', 'dark'] as const)('in %s mode', (colorScheme) => {
  it('draws pickers and number fields with an edge at 3:1 against the list', async () => {
    await commands.emulateMedia({ colorScheme });
    openPopup({ settings: createTestSettingsStore({ sessionLimit: { kind: 'shorts', value: 30 } }) });
    await expect.element(page.getByRole('spinbutton')).toBeVisible();

    const surface = style(document.querySelector('.sf-list')!).backgroundColor;
    for (const field of document.querySelectorAll('.sf-select')) {
      expect(contrast(style(field).borderTopColor, surface), field.outerHTML).toBeGreaterThanOrEqual(3);
    }
  });

  it("draws an on switch's knob at 3:1 against its track", async () => {
    await commands.emulateMedia({ colorScheme });
    openPopup({ settings: createTestSettingsStore({ shortsControlShown: true }) });
    await expect.element(listSwitch('Show button on Shorts')).toBeChecked();

    const on = listSwitch('Show button on Shorts').element();
    expect(contrast(style(on, '::after').backgroundColor, style(on).backgroundColor)).toBeGreaterThanOrEqual(3);
  });
});

describe('in forced colours (Windows High Contrast)', () => {
  /** Whether this browser can emulate forced colours at all. */
  const forcedColors = () => matchMedia('(forced-colors: active)').matches;

  it('keeps every switch visible, on and off, with a knob that stands out', async (context) => {
    await commands.emulateMedia({ forcedColors: 'active' });
    if (!forcedColors()) context.skip();
    openPopup({ settings: createTestSettingsStore({ autoScroll: true, skipSponsoredShorts: false }) });
    await expect.element(page.getByRole('switch', { name: 'Auto-Scroll' })).toBeEnabled();
    const canvas = style(document.body).backgroundColor;

    for (const control of document.querySelectorAll<HTMLInputElement>('.sf-switch')) {
      const name = `${control.getAttribute('aria-labelledby')} ${control.checked ? 'on' : 'off'}`;
      const track = style(control);
      const knob = style(control, '::after');
      expect(track.borderTopStyle, name).toBe('solid');
      expect(track.borderTopWidth, name).toBe('1px');
      // Off: CanvasText edge and knob on Canvas. On: a Highlight track with a
      // HighlightText knob. How far apart those are is the theme's to decide,
      // so the test asks only that each one differs from what it sits on.
      expect(track.borderTopColor, name).toBe(control.checked ? track.backgroundColor : knob.backgroundColor);
      expect(track.borderTopColor, name).not.toBe(canvas);
      expect(knob.backgroundColor, name).not.toBe(track.backgroundColor);
    }
    // Both kinds are on the page: Auto-Scroll on, Skip Sponsored Shorts off.
    const states = [...document.querySelectorAll<HTMLInputElement>('.sf-switch')].map((control) => control.checked);
    expect(states).toContain(true);
    expect(states).toContain(false);
  });

  it('outlines the night card, the pickers and the keycaps', async (context) => {
    await commands.emulateMedia({ forcedColors: 'active' });
    if (!forcedColors()) context.skip();
    openPopup();
    await expect.element(page.getByRole('switch', { name: 'Auto-Scroll' })).toBeEnabled();

    for (const selector of ['.sf-feature', '.sf-select', '.sf-kbd']) {
      const element = document.querySelector(selector)!;
      expect(style(element).borderTopStyle, selector).toBe('solid');
      expect(style(element).borderTopColor, selector).not.toBe(style(element).backgroundColor);
    }
  });
});

describe('size', () => {
  // Firefox cuts a popup off at 600px tall; Chrome at 600 too.
  const POPUP_MAX_HEIGHT = 600;
  const HEADROOM = 24;

  it("fits within the browser's popup with room to spare, even with every notice and field showing", async () => {
    openPopup({
      settings: createTestSettingsStore({ sessionLimit: { kind: 'minutes', value: 999 } }),
      session: createTestSessionStore({ lastSeenAt: Date.now(), shortsWatched: 1234 }),
      whatsNew: { isUnread: async () => true, markUnread: async () => {}, markRead: async () => {} },
      hostAccess: {
        isGranted: async () => false,
        request: async () => false,
        watch: () => () => {},
      },
    });
    await expect.element(page.getByRole('alert')).toBeVisible();
    await expect.element(page.getByRole('spinbutton')).toBeVisible();
    await document.fonts.ready;

    const height = document.querySelector('main')!.getBoundingClientRect().height;
    expect(height).toBeLessThanOrEqual(POPUP_MAX_HEIGHT - HEADROOM);
    expect(document.querySelector('main')!.getBoundingClientRect().width).toBe(340);
  });
});
