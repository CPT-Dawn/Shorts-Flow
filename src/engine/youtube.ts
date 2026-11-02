/**
 * The YouTube adapter: everything Shorts Flow knows about YouTube's pages and
 * their DOM, and the only module that touches it. When YouTube changes its
 * markup, this is the file to repair; nothing else names a YouTube selector.
 *
 * Facts used, from the 2026-11 capture (docs/reference/youtube-shorts-2026-11):
 * - The Shorts Feed lives at /shorts/ and /shorts/<id>, and the address
 *   follows the Current Short. YouTube reaches it without a page load.
 * - The Shorts Feed keeps one player and one looping `<video>` for every
 *   Short: moving on gives the same video the next Short. `ended` never fires.
 * - A hidden watch-page player (`#movie_player`) with a video of its own sits
 *   in the page too, and must never be taken for the Short.
 * - YouTube never moves the feed on by itself. Its Next video control does,
 *   and so does its own ArrowDown key handling.
 * - The dark theme is `dark` on `<html>`, light is its absence. YouTube's theme
 *   variables are empty, so Native Look colours are fixed values per theme.
 *
 * Every function takes the document, because the engine may be mounted onto a
 * document from another window (tests use an iframe). No `instanceof` on DOM
 * classes, for the same reason.
 */

/**
 * Every page of YouTube's, as a match pattern: where the content script runs,
 * and all the host access Shorts Flow asks for.
 */
export const YOUTUBE_PAGES = 'https://www.youtube.com/*';

/** Whether `pathname` is a Shorts Feed address: /shorts/ or /shorts/<id>. */
export function isShortsFeed(pathname: string): boolean {
  return /^\/shorts(\/[^/]+)?\/?$/.test(pathname);
}

/** The Current Short's id, from the address, or undefined off the Shorts Feed. */
export function currentShortId(document: Document): string | undefined {
  const pathname = document.defaultView?.location.pathname ?? '';
  return isShortsFeed(pathname) ? /^\/shorts\/([^/]+)/.exec(pathname)?.[1] : undefined;
}

const SHORTS_VIDEO = 'ytd-shorts #shorts-player video.html5-main-video';

/** The Shorts player's video, which plays the Current Short. Never the hidden watch-page player's. */
export function shortsVideo(document: Document): HTMLVideoElement | undefined {
  return document.querySelector<HTMLVideoElement>(SHORTS_VIDEO) ?? undefined;
}

/** Whether `target` (say, a media event's target) is the Shorts player's video. */
export function isShortsVideo(target: EventTarget | null): target is HTMLVideoElement {
  const element = target as Element | null;
  return typeof element?.matches === 'function' && element.matches(SHORTS_VIDEO);
}

const NEXT_SHORT_CONTROL = 'ytd-shorts #navigation-button-down button';

/**
 * Asks YouTube to move the Shorts Feed on to the next Short, the way the
 * viewer would: through its Next video control, or failing that its own
 * ArrowDown key handling. Never scrolls the page itself.
 *
 * The key is dispatched untrusted (`isTrusted` false), so anything watching
 * for the viewer's own keys (Holds, Shortcuts) can tell it apart.
 */
export function advanceFeed(document: Document): void {
  const control = document.querySelector<HTMLButtonElement>(NEXT_SHORT_CONTROL);
  if (control && !control.disabled) {
    control.click();
    return;
  }
  const view = document.defaultView!;
  const target = document.querySelector('ytd-shorts') ?? document.body;
  target.dispatchEvent(
    new view.KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true, composed: true }),
  );
}

/**
 * What marks a Sponsored Short: YouTube's ad slot inside a slot of the Shorts
 * Feed. UNCONFIRMED: no live capture has met a Sponsored Short yet (see
 * docs/reference/youtube-shorts-sponsored-2026-11). The element name comes
 * from public filter lists, whose rules hide a Shorts slot that holds
 * `.ytd-reel-video-renderer > ytd-ad-slot-renderer`. The test-page tool
 * reads this too, to mark the Sponsored Short in a test page.
 */
export const SPONSORED_SHORT_MARK = 'ytd-ad-slot-renderer';

const SHORT_SLOT = '.reel-video-in-sequence-new';

/**
 * Whether the Current Short is a Sponsored Short. Where YouTube puts an ad
 * in the feed is unconfirmed, so this looks in both places it may be: the slot
 * that holds the Shorts renderer (YouTube moves it to the Current Short), and
 * the slot on screen in the middle of the Shorts Feed, in case an ad brings
 * markup of its own instead.
 */
export function isSponsoredShort(document: Document): boolean {
  const shorts = document.querySelector('ytd-shorts');
  if (!shorts) return false;
  const renderer = shorts.querySelector('ytd-reel-video-renderer');
  const current = new Set<Element>();
  const holding = renderer?.closest(SHORT_SLOT) ?? renderer;
  if (holding) current.add(holding);
  const container = shorts.querySelector('#shorts-container');
  if (container) {
    const box = container.getBoundingClientRect();
    const middle = box.top + box.height / 2;
    for (const slot of container.querySelectorAll(SHORT_SLOT)) {
      const { top, bottom } = slot.getBoundingClientRect();
      if (box.height > 0 && top <= middle && middle < bottom) current.add(slot);
    }
  }
  return [...current].some((slot) => slot.querySelector(SPONSORED_SHORT_MARK) !== null);
}

/**
 * Calls `changed` whenever the Shorts Feed may have moved to another Short or
 * filled one in: something added or moved inside it, or it scrolled. Until
 * YouTube has built the Shorts Feed, it waits for it. Stops when `signal` aborts.
 */
export function watchShortsFeed(document: Document, changed: () => void, signal: AbortSignal): void {
  const view = document.defaultView!;
  let observed: Element | undefined;
  const observer = new view.MutationObserver(() => {
    const shorts = document.querySelector('ytd-shorts') ?? undefined;
    if (shorts !== observed) observe(shorts);
    changed();
  });
  const observe = (shorts: Element | undefined) => {
    observer.disconnect();
    observed = shorts;
    // Until YouTube builds the Shorts Feed, watch the whole page for it.
    observer.observe(shorts ?? document.documentElement, { childList: true, subtree: true });
  };
  observe(document.querySelector('ytd-shorts') ?? undefined);
  document.addEventListener(
    'scroll',
    (event) => {
      if ((event.target as Element | null)?.id === 'shorts-container') changed();
    },
    { capture: true, passive: true, signal },
  );
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });
}

/**
 * YouTube's own single keys on the Shorts Feed and its player, as
 * `shortcutKey` gives them (letters in lower case), so no Shortcut ever takes
 * one. From YouTube Help's "Keyboard shortcuts for YouTube" (answer 7631406,
 * read 2026-11) and the player's own shortcut list (Shift+?), plus the keys
 * the Shorts Feed moves between Shorts with:
 * - ArrowUp, ArrowDown, PageUp, PageDown: previous and next Short.
 * - Space, k: play/pause. m: mute. j, l, ArrowLeft, ArrowRight: seek.
 * - `,` `.`: frame by frame. `<` `>`: playback speed. 0–9, Home, End: seek to a point.
 * - f: full screen. c: captions. `+` `-` `o` `w` `b`: caption styling. t: theater. i: miniplayer.
 * - `/`: search box. `?`: the shortcut list. Escape, Enter, Tab: dialogs and focus.
 * - The media keys.
 * YouTube's W/A/S/D pan 360° videos only, which the Shorts Feed never shows,
 * so A and S stay free for the default Shortcuts. Combinations (Shift+N,
 * Ctrl+arrows) never reach a Shortcut, since Shortcuts take no modifier.
 */
const YOUTUBE_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End',
  ' ', 'k', 'm', 'j', 'l', ',', '.', '<', '>',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'f', 'c', '+', '-', '=', 'o', 'w', 'b', 't', 'i', '/', '?',
  'Escape', 'Enter', 'Tab', 'Backspace',
  'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaTrackNext', 'MediaTrackPrevious',
  'AudioVolumeUp', 'AudioVolumeDown', 'AudioVolumeMute',
]);

/** Whether `key` (as `shortcutKey` gives it) is one of YouTube's own keys, which no Shortcut may take. */
export function isYouTubeKey(key: string): boolean {
  return YOUTUBE_KEYS.has(key);
}

/** Whether YouTube is showing its dark theme. */
export function isDarkTheme(document: Document): boolean {
  return document.documentElement.hasAttribute('dark');
}

/**
 * Calls `changed` whenever YouTube switches between its dark and light themes,
 * until `signal` aborts.
 */
export function watchTheme(document: Document, changed: (dark: boolean) => void, signal: AbortSignal): void {
  const view = document.defaultView!;
  const observer = new view.MutationObserver(() => changed(isDarkTheme(document)));
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dark'] });
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });
}

// The action rail (2026-11): `reel-action-bar-view-model` beside the Current
// Short holds Like, Comments, Share, Remix and the sound thumbnail
// (`pivot-button-view-model`), in that order. YouTube builds it afresh for
// every Short, inside the one renderer, inside `ytd-shorts`.
const SHORTS_ELEMENT = 'ytd-shorts';
const ACTION_RAIL = 'ytd-reel-video-renderer reel-action-bar-view-model';
const SOUND_THUMBNAIL = ':scope > pivot-button-view-model';

/**
 * Calls `place` with the Current Short's action rail and the item to insert
 * a rail button before (the sound thumbnail, or null to append when it's
 * missing), now and each time YouTube rebuilds or changes the rail, until
 * `signal` aborts. `place` must leave a rail it is happy with untouched,
 * since its own changes are watched too.
 *
 * One observer, scoped to the Shorts element (it waits for that element
 * first, when YouTube has yet to build it). Returns a function that calls
 * `place` again on demand.
 */
export function watchActionRail(
  document: Document,
  place: (rail: Element, before: Element | null) => void,
  signal: AbortSignal,
): () => void {
  const view = document.defaultView!;
  const sync = () => {
    if (signal.aborted) return;
    const rail = document.querySelector(ACTION_RAIL);
    if (rail) place(rail, rail.querySelector(SOUND_THUMBNAIL));
  };
  const railObserver = new view.MutationObserver(sync);
  const observeShorts = () => {
    const shorts = document.querySelector(SHORTS_ELEMENT);
    if (shorts) railObserver.observe(shorts, { childList: true, subtree: true });
    return Boolean(shorts);
  };
  const waiting = new view.MutationObserver(() => {
    if (!observeShorts()) return;
    waiting.disconnect();
    sync();
  });
  if (!observeShorts()) waiting.observe(document.documentElement, { childList: true, subtree: true });
  signal.addEventListener(
    'abort',
    () => {
      railObserver.disconnect();
      waiting.disconnect();
    },
    { once: true },
  );
  sync();
  return sync;
}

/** The parts of a rail button built by `createRailButton`. */
export type RailButton = {
  /** The rail item to insert into the rail. */
  item: HTMLElement;
  /** The item's inner column: the button with its caption under it. */
  column: HTMLElement;
  /** The round button itself. */
  button: HTMLButtonElement;
  /** Where the 24 px icon goes. */
  icon: HTMLElement;
  /** The caption under the button. */
  caption: HTMLElement;
  /** The caption's text. */
  label: HTMLElement;
};

/**
 * A rail button with the structure and classes of YouTube's own labelled rail
 * buttons (Share, Remix), so YouTube's stylesheet gives it the Native Look:
 *
 * ```
 * item.ytSpecButtonViewModelHost.ytwReelActionBarViewModelHostDesktopActionButton
 *   label.ytSpecButtonShapeWithLabelHost (column)
 *     button.ytSpecButtonShapeNext{Host,Tonal,Mono,SizeL,IconButton,…}
 *       div.ytSpecButtonShapeNextIcon > span.ytIconWrapperHost > span.ytSpecIconShapeHost > div (icon)
 *     div.ytSpecButtonShapeWithLabelLabel (caption) > span.ytAttributedStringHost (label)
 * ```
 *
 * Only plain elements: YouTube's own tags (`button-view-model`, …) are custom
 * elements its scripts would try to take over. `classes` gives each part a
 * class of Shorts Flow's own as well, so fixed fallback styles still reach
 * them if YouTube renames its classes.
 */
export function createRailButton(
  document: Document,
  classes: Record<Exclude<keyof RailButton, 'label'>, string>,
): RailButton {
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, ...names: string[]) => {
    const node = document.createElement(tag);
    node.className = names.join(' ');
    return node;
  };
  const item = element('div', classes.item, 'ytSpecButtonViewModelHost', 'ytwReelActionBarViewModelHostDesktopActionButton');
  const column = element('label', classes.column, 'ytSpecButtonShapeWithLabelHost');
  const button = element(
    'button',
    classes.button,
    'ytSpecButtonShapeNextHost',
    'ytSpecButtonShapeNextTonal',
    'ytSpecButtonShapeNextMono',
    'ytSpecButtonShapeNextSizeL',
    'ytSpecButtonShapeNextIconButton',
    'ytSpecButtonShapeNextEnableBackdropFilterExperiment',
    'ytSpecButtonShapeNextMainstageIconSize',
    'ytSpecButtonShapeNextMainstagePadding',
  );
  button.type = 'button';
  const iconBox = element('div', 'ytSpecButtonShapeNextIcon', 'ytSpecButtonShapeNextElevatedContent');
  iconBox.setAttribute('aria-hidden', 'true');
  const wrapper = element('span', 'ytIconWrapperHost');
  wrapper.style.cssText = 'width: 24px; height: 24px;';
  const shape = element('span', 'yt-icon-shape', 'ytSpecIconShapeHost');
  const icon = element('div', classes.icon);
  icon.style.cssText = 'width: 100%; height: 100%; display: block; fill: currentcolor;';
  shape.append(icon);
  wrapper.append(shape);
  iconBox.append(wrapper);
  button.append(iconBox);
  const caption = element('div', classes.caption, 'ytSpecButtonShapeWithLabelLabel');
  // The button carries the accessible name; the caption is for the eye.
  caption.setAttribute('aria-hidden', 'true');
  const label = element(
    'span',
    'ytAttributedStringHost',
    'ytAttributedStringWhiteSpacePreWrap',
    'ytAttributedStringTextAlignmentCenter',
    'ytAttributedStringWordWrapping',
  );
  caption.append(label);
  column.append(button, caption);
  item.append(column);
  return { item, column, button, icon, caption, label };
}

const EXPANDED_PANEL =
  'ytd-shorts ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]';

/**
 * Whether one of the Shorts Feed's side panels is open: comments, the
 * description, or the sound's other Shorts. YouTube keeps every panel in the
 * page and marks the open one ENGAGEMENT_PANEL_VISIBILITY_EXPANDED (and
 * `ytd-shorts` `is-watch-while-mode`). Open panels stay open across Shorts.
 */
export function isPanelOpen(document: Document): boolean {
  return document.querySelector(EXPANDED_PANEL) !== null;
}

/**
 * Menus and dialogs: the overflow ⋮ menu and other dropdowns YouTube shows in
 * `tp-yt-iron-dropdown`, its share and report dialogs, the player's own
 * `role=dialog` panels, and any page dialog or menu.
 */
const MENU_OR_DIALOG =
  'tp-yt-iron-dropdown, tp-yt-paper-dialog, dialog, [role="dialog"], [role="alertdialog"], [role="menu"], [aria-modal="true"]';

/**
 * Whether a YouTube menu or dialog is open. YouTube keeps closed ones in the
 * page, hidden (several player dialogs and an empty dropdown sit there all
 * along), so only one the viewer can see counts.
 */
export function isMenuOrDialogOpen(document: Document): boolean {
  for (const element of document.querySelectorAll(MENU_OR_DIALOG)) {
    if (isShown(element)) return true;
  }
  return false;
}

function isShown(element: Element): boolean {
  if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
}

const FEED_NAVIGATION = 'ytd-shorts #navigation-button-up, ytd-shorts #navigation-button-down';

/** Whether `target` is inside the Shorts Feed's Previous video or Next video control. */
export function isFeedNavigation(target: EventTarget | null): boolean {
  const element = target as Element | null;
  return typeof element?.closest === 'function' && element.closest(FEED_NAVIGATION) !== null;
}
