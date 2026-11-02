import type { Settings } from '@/settings/settings';
import type { Feature, Feed } from './feed';
import { quickSettings } from './quick-settings';
import { createRailButton, isDarkTheme, watchActionRail, watchTheme, type RailButton } from './youtube';

/** The Shorts Control as built for one visit, for what `SHORTS_CONTROL_EXTRAS` adds to it. */
export type ShortsControl = RailButton & {
  /** Its YouTube-style tooltip under the button. */
  tooltip: { show(): void; hide(): void };
};

/**
 * Something more the Shorts Control carries, called once per visit after it
 * is built: the quick-settings menu (#13) adds its opener here. It may append
 * its own elements to `control.item` (positioned against it; the item is
 * `position: relative`), and passes `feed.signal` to its listeners. The
 * control is the same element on every Short, so whatever it adds survives
 * YouTube rebuilding the rail.
 */
export type ShortsControlExtra = (control: ShortsControl, feed: Feed) => void;

/** What the Shorts Control carries besides the Auto-Scroll button. */
export const SHORTS_CONTROL_EXTRAS: ShortsControlExtra[] = [quickSettings];

/**
 * The Shorts Control: an Auto-Scroll button in YouTube's action rail, just
 * before the sound thumbnail, on every Short. A click switches Auto-Scroll;
 * the button is pressed while it is on, and its icon shows which it is. It
 * goes from the rail while the viewer hides it from the Popup.
 *
 * It is built from YouTube's own rail-button structure and classes, so it
 * looks like its neighbours (Native Look, ADR 0002). Fixed values from the
 * 2026-11 capture stand behind those classes, should YouTube rename them.
 * YouTube rebuilds the rail for every Short; the same control goes back in.
 */
export const shortsControl: Feature = (feed) => {
  const { document, signal } = feed;
  const parts = createRailButton(document, {
    item: 'shorts-flow-control',
    column: 'shorts-flow-control-column',
    button: 'shorts-flow-control-button',
    icon: 'shorts-flow-control-icon',
    caption: 'shorts-flow-control-caption',
  });
  const { item, button, icon, label } = parts;
  item.dataset.shortsFlow = 'shorts-control';
  button.setAttribute('aria-label', feed.getMessage('shortsControlName'));
  label.textContent = feed.getMessage('shortsControlName');

  const style = document.createElement('style');
  style.dataset.shortsFlow = 'shorts-control-style';
  style.textContent = SHORTS_CONTROL_CSS;
  document.head.append(style);

  const setTheme = (dark: boolean) => (item.dataset.theme = dark ? 'dark' : 'light');
  setTheme(isDarkTheme(document));
  watchTheme(document, setTheme, signal);

  const tooltip = createTooltip(feed, parts);
  const control: ShortsControl = { ...parts, tooltip };

  const render = (settings: Settings) => {
    const on = settings.autoScroll;
    button.setAttribute('aria-pressed', String(on));
    icon.replaceChildren(drawIcon(document, on ? ICON_ON : ICON_OFF));
    tooltip.text(feed.getMessage(on ? 'shortsControlTurnOff' : 'shortsControlTurnOn'));
  };
  button.addEventListener(
    'click',
    () => {
      const settings = feed.settings();
      if (settings) feed.changeSettings({ autoScroll: !settings.autoScroll });
    },
    { signal },
  );
  for (const extra of SHORTS_CONTROL_EXTRAS) extra(control, feed);

  // Nothing shows until the settings are known: it might be hidden.
  let shown = false;
  const place = (rail: Element, before: Element | null) => {
    if (!shown) return;
    if (item.parentElement === rail && item.nextElementSibling === before) return;
    // A new Short: the pointer is no longer over the button where it was.
    tooltip.hide();
    rail.insertBefore(item, before);
  };
  const sync = watchActionRail(document, place, signal);
  feed.watchSettings((settings) => {
    render(settings);
    shown = settings.shortsControlShown;
    if (shown) sync();
    else item.remove();
  });
  signal.addEventListener(
    'abort',
    () => {
      item.remove();
      style.remove();
    },
    { once: true },
  );
};

/**
 * YouTube's tooltip under the button: shown while the pointer is over it or
 * it has keyboard focus, gone on leaving, blur or Escape. It describes the
 * button to screen readers too.
 *
 * It sits at the end of the page, fixed under the button, as YouTube's own
 * tooltips do: the player's overlay clips anything wider than the rail.
 */
function createTooltip(feed: Feed, { button }: RailButton) {
  const { document, signal } = feed;
  const tooltip = document.createElement('div');
  tooltip.className = 'shorts-flow-control-tooltip';
  tooltip.id = 'shorts-flow-control-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  document.body.append(tooltip);
  signal.addEventListener('abort', () => tooltip.remove(), { once: true });
  button.setAttribute('aria-describedby', tooltip.id);

  const show = () => {
    const box = button.getBoundingClientRect();
    tooltip.style.left = `${box.left + box.width / 2}px`;
    tooltip.style.top = `${box.bottom + TOOLTIP_OFFSET}px`;
    tooltip.hidden = false;
  };
  const hide = () => (tooltip.hidden = true);
  const on = (type: string, listener: (event: Event) => void) => button.addEventListener(type, listener, { signal });
  on('pointerenter', show);
  on('mouseenter', show);
  on('pointerleave', hide);
  on('mouseleave', hide);
  on('focus', () => {
    if (button.matches(':focus-visible')) show();
  });
  on('blur', hide);
  on('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Escape') hide();
  });
  return {
    show,
    hide,
    text(text: string) {
      tooltip.textContent = text;
    },
  };
}

/** YouTube's tooltips keep 14 px from what they describe (`tp-yt-paper-tooltip`'s offset). */
const TOOLTIP_OFFSET = 14;

// Icons in the weight of YouTube's own outline icons: 24 px, 2 px lines.
// Distinct shapes, never colours (ADR 0002): Auto-Scroll on is the feed
// moving down, Auto-Scroll off is a Short looping in place.
const ICON_ON = ['M5 4.5l7 7 7-7', 'M5 12.5l7 7 7-7'];
const ICON_OFF = ['M20 12a8 8 0 1 1-2.34-5.66', 'M20 3.5v4.5h-4.5'];

/** One of the icons above as an inline SVG, drawn in the button's text colour. */
function drawIcon(document: Document, paths: string[]): SVGSVGElement {
  const SVG = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVG, 'svg');
  const attributes = {
    viewBox: '0 0 24 24',
    width: '24',
    height: '24',
    focusable: 'false',
    'aria-hidden': 'true',
    style: 'pointer-events: none; display: inherit; width: 100%; height: 100%;',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  };
  for (const [name, value] of Object.entries(attributes)) svg.setAttribute(name, value);
  for (const d of paths) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

/**
 * The fixed Native Look from the 2026-11 capture (rail.md), behind YouTube's
 * own classes: every rule sits in `:where()`, so it counts for nothing
 * against YouTube's stylesheet and fills in only what that no longer styles.
 * The tooltip is Shorts Flow's own, in YouTube's tooltip style.
 */
const SHORTS_CONTROL_CSS = `
.shorts-flow-control {
  position: relative;
}
:where(.shorts-flow-control) {
  --shorts-flow-ink: #0f0f0f;
  --shorts-flow-tonal: rgba(0, 0, 0, 0.05);
  --shorts-flow-tonal-hover: rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 0 8px;
}
:where(.shorts-flow-control[data-theme="dark"]) {
  --shorts-flow-ink: #f1f1f1;
  --shorts-flow-tonal: rgba(255, 255, 255, 0.1);
  --shorts-flow-tonal-hover: rgba(255, 255, 255, 0.2);
}
:where(.shorts-flow-control-column) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
:where(.shorts-flow-control-button) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 24px;
  background: var(--shorts-flow-tonal);
  color: var(--shorts-flow-ink);
  cursor: pointer;
}
:where(.shorts-flow-control-button:hover) {
  background: var(--shorts-flow-tonal-hover);
}
:where(.shorts-flow-control-icon) {
  width: 24px;
  height: 24px;
}
:where(.shorts-flow-control-caption) {
  margin-top: 4px;
  color: var(--shorts-flow-ink);
  font-family: Roboto, Arial, sans-serif;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-align: center;
  white-space: nowrap;
}
/*
 * The quick-settings opener: a small round button on the control's top
 * corner, in the rail's own tonal colours, shown while the control is
 * pointed at or focused and while its menu is open.
 */
.shorts-flow-quick-settings-button {
  position: absolute;
  top: -4px;
  right: -6px;
  z-index: 1;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 11px;
  background: #e5e5e5;
  color: #0f0f0f;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.1s;
}
.shorts-flow-control[data-theme="dark"] .shorts-flow-quick-settings-button {
  background: #3f3f3f;
  color: #f1f1f1;
}
.shorts-flow-quick-settings-button:hover {
  background: #d9d9d9;
}
.shorts-flow-control[data-theme="dark"] .shorts-flow-quick-settings-button:hover {
  background: #535353;
}
.shorts-flow-control:hover .shorts-flow-quick-settings-button,
.shorts-flow-control:focus-within .shorts-flow-quick-settings-button,
.shorts-flow-quick-settings-button[aria-expanded="true"] {
  opacity: 1;
}
.shorts-flow-quick-settings-button:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 1px;
}
.shorts-flow-quick-settings-icon {
  width: 16px;
  height: 16px;
  pointer-events: none;
}
@media (hover: none) {
  .shorts-flow-quick-settings-button { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .shorts-flow-quick-settings-button { transition: none; }
}
@media (forced-colors: active) {
  .shorts-flow-quick-settings-button { border: 1px solid ButtonText; opacity: 1; }
}
.shorts-flow-control-tooltip {
  position: fixed;
  z-index: 2300;
  box-sizing: border-box;
  margin: 8px 0 0;
  padding: 8px;
  border-radius: 4px;
  background-color: #606060;
  color: #fff;
  opacity: 0.9;
  font-family: Roboto, Arial, sans-serif;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  white-space: nowrap;
  pointer-events: none;
  transform: translateX(-50%);
  animation: shorts-flow-tooltip-in 150ms ease-in;
}
.shorts-flow-control-tooltip[hidden] {
  display: none;
}
@keyframes shorts-flow-tooltip-in {
  from { opacity: 0; }
  to { opacity: 0.9; }
}
@media (prefers-reduced-motion: reduce) {
  .shorts-flow-control-tooltip { animation: none; }
}
@media (forced-colors: active) {
  .shorts-flow-control-tooltip { border: 1px solid CanvasText; }
}
`;
