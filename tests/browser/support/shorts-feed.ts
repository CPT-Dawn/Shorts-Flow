import { expect, onTestFinished } from 'vitest';
import { page as browserPage, userEvent } from 'vitest/browser';
import { mountEngine } from '@/engine/engine';
import type { SessionStore } from '@/settings/session';
import type { SettingsStore } from '@/settings/settings';
import { createTestClock, type TestClock } from './clock';
import { getMessage } from './messages';
import { createTestSessionStore, createTestSettingsStore } from './stores';
import { openTestPage, type TestPage } from './test-pages';

/** `expect.poll` options with time for two Shorts (2 to 3 s clips) to play out and the feed to move on. */
export const TWO_SHORTS = { timeout: 12_000 };

/**
 * Waits for the Shorts Feed's timeline to begin with `expected`. Only the
 * start is compared: the feed plays on after the last thing a test looks for.
 */
export function expectTimeline(shortsFeed: ShortsFeed, expected: string[], options = TWO_SHORTS) {
  return expect.poll(() => shortsFeed.timeline.slice(0, expected.length), options).toEqual(expected);
}

/** Long enough for the feed to have moved on had Shorts Flow Advanced, which it does as a Short ends. */
export function aMomentLater() {
  return new Promise((resolve) => setTimeout(resolve, 500));
}

export type ShortsFeed = {
  window: Window;
  document: Document;
  settings: SettingsStore;
  session: SessionStore;
  clock: TestClock;
  /**
   * What the viewer has seen so far, in order:
   * - `Short <n> started over` when the nth Short loops back to its start,
   *   counting from the Short the page opened on as Short 1;
   * - `Short <n> is current` when YouTube has moved the feed on to it;
   * - `page scrolled by script` if anything scrolled the page other than
   *   YouTube's own next-Short navigation;
   * - `page reloaded`.
   */
  timeline: string[];
  /** Moves to `path` inside YouTube, without a page load. */
  navigate(path: string): void;
  /** Sets the playback speed as YouTube's own speed menu does. */
  setPlaybackSpeed(rate: number): void;
  /** How fast the Current Short plays, as the viewer sees it: 1 is normal speed. */
  playbackSpeed(): number;
  /** How fast the Shorts player will play the next Short it loads: its default speed. */
  nextLoadSpeed(): number;
  /** How fast the hidden watch-page player behind the Shorts Feed would play. */
  hiddenPlayerSpeed(): number;
  /** Pauses the Current Short where it is, as YouTube's pause control does. */
  pause(): void;
  /** Whether the Current Short is playing, as the viewer sees: not paused, nor waiting for data. */
  playing(): boolean;
  /** Plays the Current Short on from where it was paused, as YouTube's play control does. */
  resume(): void;
  /**
   * Plays a clip to its end in the hidden watch-page player YouTube keeps
   * behind the Shorts Feed. Resolves once it has ended.
   */
  playHiddenWatchPlayer(): Promise<void>;
  /** YouTube fetches one more Short onto the end of the feed, which is how a Stall ends. */
  loadNextShort(): void;
  /** Clicks YouTube's Next video control, as the viewer does to move on by hand. */
  pressNextVideo(): void;
  /** Clicks YouTube's Previous video control, as the viewer does to go back a Short by hand. */
  pressPreviousVideo(): void;
  /** Switches YouTube between its dark and light themes, as its Appearance setting does. */
  setTheme(theme: 'dark' | 'light'): void;
  /**
   * The notice Shorts Flow shows on the page, if one is showing: what it
   * says, its buttons, and the element a viewer sees (for its looks).
   */
  notice(): { text: string; actions: string[]; element: HTMLElement } | undefined;
  /** Presses the notice's button labelled `label`, as the viewer does. */
  pressNoticeAction(label: string): void;
  /**
   * The dialog Shorts Flow shows over the player (the Break Nudge), if one is
   * open: its title, its text, its buttons, and the element a viewer sees.
   */
  dialog(): { title: string; text: string; actions: string[]; element: HTMLDialogElement } | undefined;
  /** Presses the open dialog's button labelled `label`, as the viewer does. */
  pressDialogAction(label: string): void;
  /**
   * Presses `key` (a `KeyboardEvent.key` value) on the page as the viewer
   * does on a real keyboard, optionally while holding `holding` down. The
   * key goes wherever the focus is on the page.
   */
  pressKey(key: string, options?: { holding?: 'Control' | 'Alt' | 'Meta' | 'Shift' }): Promise<void>;
  /** Clicks into YouTube's search box and types `text` there, leaving the focus in it. */
  typeInSearch(text: string): Promise<void>;
  /** What YouTube's search box says, as the viewer sees it. */
  searchText(): string;
  /** A script on the page makes up a keydown of `key`, as Shorts Flow's own ArrowDown fallback does. */
  pressKeyByScript(key: string): void;
  /**
   * The accessible names of the controls in YouTube's action rail beside the
   * Current Short, top to bottom, as a screen reader would list them.
   */
  railLabels(): string[];
  /** The rail control named `label`, as the viewer finds it, if the rail has one. */
  railControl(label: string): HTMLElement | undefined;
  /**
   * The rail item whose control is named `label`: the control, the whole
   * item (control and caption), and the caption under the control, if any.
   */
  railItem(label: string): { button: HTMLElement; item: Element; caption: HTMLElement | undefined } | undefined;
  /**
   * The tooltip showing on the page, if one is: its text and the element a
   * viewer sees.
   */
  tooltip(): { text: string; element: HTMLElement } | undefined;
  /**
   * Takes away every style YouTube's page has, as if YouTube had renamed all
   * its classes, leaving only what Shorts Flow brings.
   */
  dropYouTubeStyles(): void;
  /** Points at `element` with the mouse, as the viewer does before clicking. */
  hover(element: Element): void;
  /** Moves the mouse away from `element` again. */
  unhover(element: Element): void;
  /** Plays the Current Short on from where it is, as YouTube's play control does. */
  play(): void;
  /** Drags the Current Short's progress to its very end, as the viewer can while it is paused. */
  scrubToEnd(): void;
  /** Closes the open comments or description panel with its ✕, as the viewer does. */
  closePanel(): void;
  /** Opens a YouTube menu on the page (a dropdown, as the overflow ⋮ opens), as the viewer does. */
  openMenu(): void;
  /** Closes the menu `openMenu` opened. */
  closeMenu(): void;
  /** Opens the player's Share dialog, as the viewer does. */
  openShareDialog(): void;
  /** Closes the Share dialog. */
  closeShareDialog(): void;
  /** Puts focus in YouTube's search box, as the viewer does to type in it. */
  clickSearchBox(): void;
  /** Moves focus out of the search box, as the viewer does by clicking away. */
  leaveSearchBox(): void;
  /** Turns the mouse wheel over the Short, by hand: YouTube moves to the next Short. */
  scrollByHand(): Promise<void>;
  /** Presses ArrowDown on the keyboard, by hand: YouTube moves to the next Short. */
  pressArrowDownByHand(): Promise<void>;
  /** Clicks YouTube's Next video control with the mouse, by hand. */
  clickNextVideoByHand(): Promise<void>;
  /** Switches to another tab, leaving this one playing in the background. */
  moveToBackground(): void;
  /** Switches back to this tab. */
  moveToForeground(): void;
  /** Tears the engine down, leaving the page playing. */
  unmountEngine(): void;
  /** The Shorts Control's quick-settings opener, as the viewer finds it by its name, if it is there. */
  quickSettingsButton(): HTMLElement | undefined;
  /** Clicks the Shorts Control's quick-settings opener with the mouse, as the viewer does. */
  openQuickSettings(): Promise<void>;
  /** Right-clicks the Shorts Control's Auto-Scroll button, as the viewer does for its menu. */
  rightClickShortsControl(): Promise<void>;
  /**
   * The menu Shorts Flow shows on the page, if one is open: its accessible
   * name, its items as a screen reader lists them, the item with the
   * keyboard focus, and the element a viewer sees.
   */
  quickSettings(): QuickSettingsMenu | undefined;
  /** Clicks the open menu's item whose accessible name starts with `name`, with the mouse. */
  chooseQuickSetting(name: string): Promise<void>;
  /** Clicks with the mouse somewhere on the page away from any menu, as the viewer does to dismiss one. */
  clickElsewhere(): Promise<void>;
};

/** An open menu as `quickSettings()` finds it. */
export type QuickSettingsMenu = {
  name: string;
  items: { role: string; name: string; checked?: boolean; expanded?: boolean }[];
  /** The accessible name of the item with the keyboard focus, if one has it. */
  focused: string | undefined;
  element: HTMLElement;
};

/**
 * Opens `page`, stands in for the parts of YouTube the scriptless test page
 * lacks (playing the Current Short, and moving to the next one when its
 * Next video control is pressed or ArrowDown is typed), and mounts the
 * engine onto it the way the content script does.
 */
export async function mountShortsFeed(
  page: TestPage,
  {
    settings = createTestSettingsStore(),
    session = createTestSessionStore(),
    clock = createTestClock(),
    path = page.path,
    signal,
    sponsoredKeepsAddress = false,
  }: {
    settings?: SettingsStore;
    session?: SessionStore;
    clock?: TestClock;
    /** Where on YouTube the page is when the engine starts. */
    path?: string;
    /** Stands in for WXT's content-script context: the engine tears down when it aborts. */
    signal?: AbortSignal;
    /**
     * YouTube leaves the address on the Short before while a Sponsored Short
     * is current. Unconfirmed either way (docs/reference/youtube-shorts-sponsored-2026-11),
     * so Shorts Flow must cope with both.
     */
    sponsoredKeepsAddress?: boolean;
  } = {},
): Promise<ShortsFeed> {
  const { window, document } = await openTestPage(page);
  window.history.replaceState(null, '', path);

  const timeline: string[] = [];
  const push = (entry: string) => timeline.push(entry);
  watchForScriptedScrolls(window, () => push('page scrolled by script'));
  window.frameElement!.addEventListener('load', () => push('page reloaded'));
  const youtube = playLikeYouTube(window, page, push, { sponsoredKeepsAddress });

  const unmount = mountEngine(document, { settings, session, getMessage, clock, signal });
  let mounted = true;
  const unmountEngine = () => {
    if (!mounted) return;
    mounted = false;
    unmount();
  };
  onTestFinished(unmountEngine);

  return {
    window,
    document,
    settings,
    session,
    clock,
    timeline,
    navigate(path) {
      // How YouTube moves between its pages: no load.
      window.history.pushState(null, '', path);
    },
    setPlaybackSpeed(rate) {
      youtube.video.defaultPlaybackRate = rate;
      youtube.video.playbackRate = rate;
    },
    playbackSpeed: () => youtube.video.playbackRate,
    nextLoadSpeed: () => youtube.video.defaultPlaybackRate,
    hiddenPlayerSpeed: () => document.querySelector<HTMLVideoElement>('#movie_player video')!.playbackRate,
    pause() {
      youtube.video.pause();
    },
    playing: () => !youtube.video.paused && youtube.video.readyState >= youtube.video.HAVE_FUTURE_DATA,
    resume() {
      void youtube.video.play().catch(() => {});
    },
    playHiddenWatchPlayer: youtube.playHiddenWatchPlayer,
    loadNextShort: youtube.loadNextShort,
    pressNextVideo() {
      document.querySelector<HTMLButtonElement>('#navigation-button-down button')!.click();
    },
    pressPreviousVideo: youtube.previous,
    setTheme(theme) {
      document.documentElement.toggleAttribute('dark', theme === 'dark');
    },
    notice: () => findNotice(document),
    pressNoticeAction(label) {
      const notice = findNotice(document);
      const button = notice && [...notice.element.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);
      if (!button) throw new Error(`No notice with a "${label}" button is showing`);
      button.click();
    },
    dialog: () => findDialog(document),
    pressDialogAction(label) {
      const dialog = findDialog(document);
      const button = dialog && [...dialog.element.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);
      if (!button) throw new Error(`No dialog with a "${label}" button is open`);
      button.click();
    },
    async pressKey(key, { holding } = {}) {
      // Focusing the frame would take the focus from an element in it (a menu item, say).
      const focused = document.activeElement;
      if (!focused || focused === document.body) focusPage(window);
      const name = key === ' ' ? '{Space}' : key.length === 1 ? key : `{${key}}`;
      await userEvent.keyboard(holding ? `{${holding}>}${name}{/${holding}}` : name);
    },
    async typeInSearch(text) {
      focusPage(window);
      searchBox().focus();
      await userEvent.keyboard(text);
    },
    searchText: () => searchBox().value,
    pressKeyByScript(key) {
      (document.activeElement ?? document.body).dispatchEvent(
        new (window as Window & typeof globalThis).KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }),
      );
    },
    railLabels: () => railControls(document).map(({ label }) => label),
    railControl: (label) => railControls(document).find((control) => control.label === label)?.element,
    railItem(label) {
      const control = railControls(document).find((control) => control.label === label);
      if (!control) return undefined;
      const caption = control.item.querySelector<HTMLElement>('.ytSpecButtonShapeWithLabelLabel') ?? undefined;
      return { button: control.element, item: control.item, caption };
    },
    tooltip() {
      const tooltip = [...document.querySelectorAll<HTMLElement>('[role="tooltip"]')].find(
        (element) =>
          element.getBoundingClientRect().width > 0 && element.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
      );
      return tooltip && { text: (tooltip.textContent ?? '').trim(), element: tooltip };
    },
    dropYouTubeStyles() {
      for (const style of document.querySelectorAll('style, link[rel="stylesheet"]')) {
        if (!style.closest('[data-shorts-flow]') && !(style as HTMLElement).dataset.shortsFlow) style.remove();
      }
    },
    hover(element) {
      for (const type of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter']) {
        element.dispatchEvent(new (window as Window & typeof globalThis).PointerEvent(type, { bubbles: !type.endsWith('enter'), composed: true }));
      }
    },
    unhover(element) {
      for (const type of ['pointerout', 'pointerleave', 'mouseout', 'mouseleave']) {
        element.dispatchEvent(new (window as Window & typeof globalThis).PointerEvent(type, { bubbles: !type.endsWith('leave'), composed: true }));
      }
    },
    play() {
      youtube.video.play().catch(() => {});
    },
    scrubToEnd() {
      youtube.video.currentTime = youtube.video.duration;
    },
    closePanel() {
      // What YouTube does when the panel's ✕ is pressed.
      for (const panel of document.querySelectorAll('ytd-engagement-panel-section-list-renderer')) {
        if (panel.getAttribute('visibility') === 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED') {
          panel.setAttribute('visibility', 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN');
        }
      }
      for (const element of document.querySelectorAll('[is-watch-while-mode]')) {
        element.removeAttribute('is-watch-while-mode');
      }
    },
    openMenu() {
      // YouTube puts the overflow ⋮ menu in a dropdown in its popup container.
      const dropdown = document.createElement('tp-yt-iron-dropdown');
      dropdown.style.cssText = 'position: fixed; top: 120px; right: 200px; display: block;';
      dropdown.innerHTML =
        '<div id="contentWrapper"><yt-sheet-view-model style="display: block; width: 240px;">' +
        '<yt-list-view-model role="listbox"><yt-list-item-view-model role="option" style="display: block; height: 40px;">' +
        'Description</yt-list-item-view-model></yt-list-view-model></yt-sheet-view-model></div>';
      document.querySelector('ytd-popup-container')!.append(dropdown);
    },
    closeMenu() {
      // YouTube keeps the dropdown, hidden.
      for (const dropdown of document.querySelectorAll<HTMLElement>('ytd-popup-container tp-yt-iron-dropdown')) {
        dropdown.style.display = 'none';
        dropdown.setAttribute('aria-hidden', 'true');
      }
    },
    openShareDialog() {
      document.querySelector<HTMLElement>('#shorts-player .ytp-share-panel')!.style.display = '';
    },
    closeShareDialog() {
      document.querySelector<HTMLElement>('#shorts-player .ytp-share-panel')!.style.display = 'none';
    },
    clickSearchBox() {
      window.focus();
      searchBox().focus();
    },
    leaveSearchBox() {
      (document.activeElement as HTMLElement | null)?.blur();
    },
    async scrollByHand() {
      await frame().getByRole('button', { name: 'Next video' }).wheel({ direction: 'down' });
    },
    async pressArrowDownByHand() {
      window.focus();
      await userEvent.keyboard('{ArrowDown}');
    },
    async clickNextVideoByHand() {
      await frame().getByRole('button', { name: 'Next video' }).click();
    },
    moveToBackground() {
      // What the browser does when the viewer switches tabs.
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new (window as Window & typeof globalThis).Event('visibilitychange'));
      window.dispatchEvent(new (window as Window & typeof globalThis).Event('blur'));
    },
    moveToForeground() {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new (window as Window & typeof globalThis).Event('visibilitychange'));
      window.dispatchEvent(new (window as Window & typeof globalThis).Event('focus'));
    },
    unmountEngine,
    quickSettingsButton: () => findByName(document, QUICK_SETTINGS),
    async openQuickSettings() {
      await frame().getByRole('button', { name: QUICK_SETTINGS, exact: true }).click();
    },
    async rightClickShortsControl() {
      await frame().getByRole('button', { name: 'Auto-Scroll', exact: true }).click({ button: 'right' });
    },
    quickSettings: () => findMenu(document),
    async chooseQuickSetting(name) {
      const menu = findMenu(document);
      const item = menu?.items.find((item) => item.name.startsWith(name));
      if (!item) throw new Error(`No open menu has an item named "${name}"`);
      await frame()
        .getByRole(item.role as 'menuitem', { name: item.name, exact: true })
        .click();
    },
    async clickElsewhere() {
      // The page's top left corner, away from the player and the rail: nothing happens there.
      await browserPage.elementLocator(window.frameElement!).click({ position: { x: 5, y: 5 } });
    },
  };

  function searchBox() {
    return document.querySelector<HTMLInputElement>('input[name="search_query"]')!;
  }

  /** The page as the viewer's mouse and keyboard reach it: their events are trusted. */
  function frame() {
    return browserPage.frameLocator(browserPage.elementLocator(window.frameElement!));
  }
}

/** Puts the keyboard focus into the test page's frame, where a viewer's keys would go. */
function focusPage(window: Window) {
  (window.frameElement as HTMLIFrameElement).focus();
  window.focus();
}

/**
 * The controls in the action rail of the Current Short, as a screen reader
 * finds them: each rail item's button (or link acting as one), named by its
 * aria-label.
 */
function railControls(document: Document) {
  const rail = document.querySelector('ytd-reel-video-renderer reel-action-bar-view-model');
  if (!rail) return [];
  return [...rail.children].flatMap((item) => {
    const element = item.querySelector<HTMLElement>('button, [role="button"]');
    const label = element?.getAttribute('aria-label');
    return element && label ? [{ label, element, item }] : [];
  });
}

/**
 * Stands in for YouTube's Shorts player and feed. The Shorts Feed keeps one
 * renderer and one looping `<video>` for every Short: moving on puts the
 * renderer into the next slot, builds its action rail afresh, gives the video
 * the next Short's clip, and changes the address to the next Short's (unless
 * told a Sponsored Short keeps the address before it). YouTube never moves on by itself.
 */
function playLikeYouTube(
  window: Window,
  page: TestPage,
  push: (entry: string) => void,
  { sponsoredKeepsAddress }: { sponsoredKeepsAddress: boolean },
) {
  const { document } = window;
  const shorts = document.querySelector('ytd-shorts')!;
  const video = shorts.querySelector<HTMLVideoElement>('#shorts-player video')!;
  const renderer = shorts.querySelector('#reel-overlay-container')!;
  const container = shorts.querySelector('#shorts-container')!;
  // YouTube builds the action rail afresh for every Short.
  const freshRail = shorts.querySelector('reel-action-bar-view-model')!.cloneNode(true);
  // YouTube adds Shorts to the end of the feed as it fetches them.
  const feed = [...page.shorts];
  let current = feed.findIndex((short) => page.path.endsWith(short.id));
  // The timeline counts Shorts from the one the page opens on.
  const opening = current;

  video.muted = true;
  video.play().catch(() => {});
  video.addEventListener('seeking', () => {
    if (video.currentTime < 0.5) push(`Short ${current - opening + 1} started over`);
  });

  const moveTo = (step: 1 | -1) => {
    // YouTube takes a moment to fetch and swap in the next Short.
    setTimeout(() => {
      const following = feed[current + step];
      if (!following) return;
      current += step;
      const slot = shorts.querySelector(`.reel-video-in-sequence-new[id="${current}"]`)!;
      slot.append(renderer);
      renderer.querySelector('reel-action-bar-view-model')!.replaceWith(freshRail.cloneNode(true));
      container.scrollTop = (slot as HTMLElement).offsetTop;
      shorts.removeAttribute('is-up-arrow-hidden');
      shorts.querySelector('#navigation-button-up')?.removeAttribute('aria-hidden');
      if (!(sponsoredKeepsAddress && following.sponsored)) window.history.pushState(null, '', `/shorts/${following.id}`);
      video.src = following.clip;
      video.play().catch(() => {});
      push(`Short ${current - opening + 1} is current`);
    }, 100);
  };
  const next = () => moveTo(1);
  shorts.querySelector('#navigation-button-down button')!.addEventListener('click', next);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' && !event.defaultPrevented) next();
  });
  shorts.addEventListener('wheel', (event) => {
    if ((event as WheelEvent).deltaY > 0) next();
  });

  return {
    video,
    previous: () => moveTo(-1),
    loadNextShort() {
      const slots = shorts.querySelectorAll('.reel-video-in-sequence-new');
      const last = slots[slots.length - 1]!;
      const slot = last.cloneNode(false) as Element;
      slot.id = String(slots.length);
      last.after(slot);
      const id = `vid${String(feed.length + 1).padStart(8, '0')}`;
      feed.push({ id, clip: page.shorts[feed.length % page.shorts.length]?.clip ?? page.shorts[0]!.clip });
    },
    playHiddenWatchPlayer() {
      const hidden = document.querySelector<HTMLVideoElement>('#movie_player video')!;
      hidden.muted = true;
      hidden.src = page.shorts[0]!.clip;
      const ended = new Promise<void>((resolve) => hidden.addEventListener('ended', () => resolve(), { once: true }));
      hidden.play().catch(() => {});
      return ended;
    },
  };
}

/** The accessible name of the Shorts Control's quick-settings opener. */
const QUICK_SETTINGS = 'Quick settings';

/** Every root a viewer's screen reader looks through: the page and each open shadow root in it. */
function allRoots(document: Document): (Document | ShadowRoot)[] {
  const roots: (Document | ShadowRoot)[] = [document];
  for (const element of document.querySelectorAll('*')) if (element.shadowRoot) roots.push(element.shadowRoot);
  return roots;
}

/** A button on the page named `name` by its aria-label, as a screen reader finds it. */
function findByName(document: Document, name: string) {
  for (const root of allRoots(document)) {
    for (const element of root.querySelectorAll<HTMLElement>('button, [role="button"]')) {
      if (element.getAttribute('aria-label') === name && isVisible(element)) return element;
    }
  }
  return undefined;
}

function isVisible(element: Element) {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && element.checkVisibility({ visibilityProperty: true });
}

/** The text a screen reader reads for `element`: its aria-label, or its text without what is hidden from it. */
function accessibleName(element: Element): string {
  const label = element.getAttribute('aria-label');
  if (label) return label;
  const labelledBy = element.getAttribute('aria-labelledby');
  const root = element.getRootNode() as Document | ShadowRoot;
  if (labelledBy) {
    return labelledBy
      .split(' ')
      .map((id) => root.getElementById(id)?.textContent?.trim() ?? '')
      .join(' ');
  }
  const copy = element.cloneNode(true) as Element;
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** An open menu on the page, in the page itself or in a shadow root, as the viewer finds it. */
function findMenu(document: Document): QuickSettingsMenu | undefined {
  for (const root of allRoots(document)) {
    for (const element of root.querySelectorAll<HTMLElement>('[role="menu"]')) {
      if (!isVisible(element)) continue;
      const items = [...element.querySelectorAll('[role^="menuitem"]')].map((item) => {
        const checked = item.getAttribute('aria-checked');
        const expanded = item.getAttribute('aria-expanded');
        return {
          role: item.getAttribute('role')!,
          name: accessibleName(item),
          ...(checked !== null && { checked: checked === 'true' }),
          ...(expanded !== null && { expanded: expanded === 'true' }),
        };
      });
      const labelledBy = element.getAttribute('aria-labelledby');
      const name = labelledBy ? (root.getElementById(labelledBy)?.textContent?.trim() ?? '') : accessibleName(element);
      const active = root.activeElement;
      const focused = active && element.contains(active) ? accessibleName(active) : undefined;
      return { name: element.getAttribute('aria-label') ?? name, items, focused, element };
    }
  }
  return undefined;
}

/**
 * A notice on the page as the viewer finds it: a visible status message,
 * whether in the page itself or inside an element's shadow root.
 */
function findNotice(document: Document) {
  const roots: (Document | ShadowRoot)[] = [document];
  for (const element of document.querySelectorAll('*')) if (element.shadowRoot) roots.push(element.shadowRoot);
  for (const root of roots) {
    for (const element of root.querySelectorAll<HTMLElement>('[role="status"]')) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || !element.checkVisibility({ visibilityProperty: true })) continue;
      const actions = [...element.querySelectorAll('button')].map((button) => button.textContent?.trim() ?? '');
      const withoutButtons = element.cloneNode(true) as HTMLElement;
      for (const button of withoutButtons.querySelectorAll('button')) button.remove();
      const text = (withoutButtons.textContent ?? '').replace(/\s+/g, ' ').trim();
      return { text, actions, element };
    }
  }
  return undefined;
}

/** An open dialog on the page, in the page itself or inside an element's shadow root, as the viewer finds it. */
function findDialog(document: Document) {
  const roots: (Document | ShadowRoot)[] = [document];
  for (const element of document.querySelectorAll('*')) if (element.shadowRoot) roots.push(element.shadowRoot);
  for (const root of roots) {
    const element = root.querySelector<HTMLDialogElement>('dialog[open]');
    if (!element) continue;
    const named = (attribute: string) => {
      const id = element.getAttribute(attribute);
      return (id && root.getElementById(id)?.textContent?.trim()) ?? '';
    };
    const actions = [...element.querySelectorAll('button')].map((button) => button.textContent?.trim() ?? '');
    return { title: named('aria-labelledby'), text: named('aria-describedby'), actions, element };
  }
  return undefined;
}

/** Calls `scrolled` whenever script asks the page to scroll: Shorts Flow never should. */
function watchForScriptedScrolls(window: Window, scrolled: () => void) {
  const frameWindow = window as Window & typeof globalThis;
  const targets: object[] = [frameWindow.Element.prototype, frameWindow];
  for (const target of targets) {
    for (const name of ['scrollIntoView', 'scrollTo', 'scrollBy', 'scroll'] as const) {
      const original = (target as Record<string, unknown>)[name];
      if (typeof original !== 'function') continue;
      Object.defineProperty(target, name, {
        configurable: true,
        value(this: unknown, ...args: unknown[]) {
          scrolled();
          return original.apply(this, args);
        },
      });
    }
  }
}
