import { PREFERRED_SPEEDS, type Settings } from '@/settings/settings';
import type { Feed } from './feed';
import { holdWhile } from './holds';
import { drawIcon } from './icon';
import { placeOnPage } from './on-page';
import type { ShortsControl } from './shorts-control';
import { lookVariables } from './youtube-look';

/**
 * The Shorts Control's quick-settings menu: Skip Sponsored Shorts, Speed and
 * the Preferred Speed, the everyday settings, without the Popup. A small
 * button on the Shorts Control opens it (so does a right-click on the
 * control, or the context-menu key); the control's own click still switches
 * Auto-Scroll. Its switches change the same settings as the Popup, and show
 * changes made anywhere else at once.
 *
 * It looks like YouTube's own menus (the player's ⋮ "More actions") in both
 * themes, Native Look (ADR 0002), and works as an ARIA menu: arrow keys,
 * Home and End move, Enter and Space choose, Escape or Tab closes it and
 * gives the focus back, and so does a click anywhere else. The Preferred
 * Speed opens a second menu of speeds in its place, as YouTube's Playback
 * speed does.
 *
 * While it is open, it is a Hold: nothing Advances under the viewer's cursor.
 * A Shortcut typed while it has the focus works as anywhere on the Shorts
 * Feed, once: the menu itself answers to no letter keys.
 */
export function quickSettings(control: ShortsControl, feed: Feed): void {
  const { document, signal, getMessage } = feed;
  const window = document.defaultView!;

  const opener = document.createElement('button');
  opener.type = 'button';
  opener.className = 'shorts-flow-quick-settings-button';
  opener.setAttribute('aria-label', getMessage('quickSettingsName'));
  opener.setAttribute('aria-haspopup', 'menu');
  opener.setAttribute('aria-expanded', 'false');
  opener.append(drawIcon(document, OPENER_ICON, { size: 16, filled: true, className: 'shorts-flow-quick-settings-icon' }));
  control.item.append(opener);

  const { host, root } = placeOnPage(feed, 'quick-settings', { css: MENU_CSS });
  const menu = createMenu(document, 'quick-settings-menu', getMessage('quickSettingsName'));
  const speeds = createMenu(document, 'quick-settings-speeds', getMessage('quickSettingsPreferredSpeed'));
  root.append(menu.element, speeds.element);

  const skipSponsored = menu.add(
    item(document, 'menuitemcheckbox', ICONS.skipSponsored, getMessage('quickSettingsSkipSponsored'), toggle(document)),
  );
  const speedOn = menu.add(item(document, 'menuitemcheckbox', ICONS.speed, getMessage('quickSettingsSpeed'), toggle(document)));
  const speedValue = document.createElement('span');
  speedValue.className = 'value';
  const preferredSpeed = menu.add(
    item(document, 'menuitem', ICONS.preferredSpeed, getMessage('quickSettingsPreferredSpeed'), speedValue, chevron(document)),
  );
  // Read as "Preferred Speed 1.5×": the two spans would run together otherwise.
  speedValue.id = 'quick-settings-preferred-speed-value';
  preferredSpeed.querySelector('.label')!.id = 'quick-settings-preferred-speed-label';
  preferredSpeed.setAttribute('aria-labelledby', 'quick-settings-preferred-speed-label quick-settings-preferred-speed-value');
  preferredSpeed.setAttribute('aria-haspopup', 'menu');
  preferredSpeed.setAttribute('aria-expanded', 'false');
  preferredSpeed.setAttribute('aria-controls', speeds.element.id);

  const back = speeds.add(item(document, 'menuitem', ICONS.back, getMessage('quickSettingsPreferredSpeed')));
  back.classList.add('back');
  back.setAttribute('aria-label', getMessage('quickSettingsBack'));
  const speedItems = PREFERRED_SPEEDS.map((speed) => {
    const choice = speeds.add(item(document, 'menuitemradio', CHECK, getMessage('quickSettingsSpeedValue', String(speed))));
    choice.dataset.speed = String(speed);
    return choice;
  });

  let open: Menu | undefined;
  let returnTo: HTMLElement = opener;

  const show = (which: Menu, focus: HTMLElement) => {
    for (const each of [menu, speeds]) each.element.hidden = each !== which;
    open = which;
    opener.setAttribute('aria-expanded', 'true');
    preferredSpeed.setAttribute('aria-expanded', String(which === speeds));
    position(which.element);
    focus.focus();
  };
  const close = ({ refocus }: { refocus: boolean }) => {
    if (!open) return;
    for (const each of [menu, speeds]) each.element.hidden = true;
    open = undefined;
    opener.setAttribute('aria-expanded', 'false');
    preferredSpeed.setAttribute('aria-expanded', 'false');
    if (refocus) returnTo.focus();
  };
  const openMenu = (from: HTMLElement) => {
    returnTo = from;
    control.tooltip.hide();
    show(menu, menu.items[0]!);
  };
  const openSpeeds = () => show(speeds, speedItems.find((choice) => choice.getAttribute('aria-checked') === 'true') ?? back);
  const backToMenu = () => show(menu, preferredSpeed);

  /** Beside the Shorts Control, on the player's side, kept on screen. */
  const position = (element: HTMLElement) => {
    const anchor = control.button.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const gap = 8;
    let left = anchor.left - gap - box.width;
    if (left < gap) left = Math.min(anchor.right + gap, window.innerWidth - gap - box.width);
    const top = Math.max(gap, Math.min(anchor.bottom - box.height, window.innerHeight - gap - box.height));
    element.style.left = `${Math.max(gap, left)}px`;
    element.style.top = `${top}px`;
  };

  const on = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
  ) => target.addEventListener(type, listener, { signal });

  on(opener, 'click', () => (open ? close({ refocus: true }) : openMenu(opener)));
  on(control.button, 'contextmenu', (event) => {
    event.preventDefault();
    openMenu(control.button);
  });
  on(skipSponsored, 'click', () => {
    const settings = feed.settings();
    if (settings) feed.changeSettings({ skipSponsoredShorts: !settings.skipSponsoredShorts });
  });
  on(speedOn, 'click', () => {
    const settings = feed.settings();
    if (settings) feed.changeSettings({ speedOn: !settings.speedOn });
  });
  on(preferredSpeed, 'click', openSpeeds);
  on(back, 'click', backToMenu);
  for (const choice of speedItems) {
    on(choice, 'click', () => {
      feed.changeSettings({ preferredSpeed: Number(choice.dataset.speed) });
      backToMenu();
    });
  }

  // Only the keys of a menu. Enter and Space are left to the buttons, which
  // click once for them; letters go on to the Shortcuts, which act once.
  on(host, 'keydown', (event) => {
    if (!open || event.ctrlKey || event.altKey || event.metaKey) return;
    const items = open.items;
    const at = items.indexOf(root.activeElement as HTMLElement);
    const moveTo = (index: number) => items[(index + items.length) % items.length]!.focus();
    const keys: Record<string, () => void> = {
      ArrowDown: () => moveTo(at + 1),
      ArrowUp: () => moveTo(at < 0 ? -1 : at - 1),
      Home: () => moveTo(0),
      End: () => moveTo(-1),
      ArrowRight: () => {
        if (root.activeElement === preferredSpeed) openSpeeds();
      },
      ArrowLeft: () => {
        if (open === speeds) backToMenu();
      },
      Escape: () => (open === speeds ? backToMenu() : close({ refocus: true })),
      Tab: () => close({ refocus: true }),
    };
    const act = keys[event.key];
    if (!act) return;
    event.preventDefault();
    act();
  });
  // A click anywhere else closes it, leaving the focus where the viewer clicked.
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!open) return;
      const path = event.composedPath();
      if (!path.includes(host) && !path.includes(opener)) close({ refocus: false });
    },
    { capture: true, signal },
  );
  window.addEventListener('resize', () => open && position(open.element), { signal });

  holdWhile(feed, () => open !== undefined);

  const render = (settings: Settings) => {
    skipSponsored.setAttribute('aria-checked', String(settings.skipSponsoredShorts));
    speedOn.setAttribute('aria-checked', String(settings.speedOn));
    speedValue.textContent = getMessage('quickSettingsSpeedValue', String(settings.preferredSpeed));
    for (const choice of speedItems) {
      choice.setAttribute('aria-checked', String(Number(choice.dataset.speed) === settings.preferredSpeed));
    }
    // Hidden from the Popup: the control is gone, and its menu with it.
    if (!settings.shortsControlShown) close({ refocus: false });
  };
  feed.watchSettings(render);
}

type Menu = {
  element: HTMLElement;
  items: HTMLElement[];
  add(item: HTMLElement): HTMLElement;
};

function createMenu(document: Document, id: string, name: string): Menu {
  const element = document.createElement('div');
  element.id = id;
  element.className = 'menu';
  element.setAttribute('role', 'menu');
  element.setAttribute('aria-label', name);
  element.hidden = true;
  const items: HTMLElement[] = [];
  return {
    element,
    items,
    add(item) {
      items.push(item);
      element.append(item);
      return item;
    },
  };
}

/** One menu item, as YouTube lays them out: icon, text, then whatever sits at the end. */
function item(document: Document, role: string, icon: string[], text: string, ...end: Element[]): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'item';
  button.setAttribute('role', role);
  button.tabIndex = -1;
  const iconBox = document.createElement('span');
  iconBox.className = 'icon';
  iconBox.setAttribute('aria-hidden', 'true');
  iconBox.append(drawIcon(document, icon));
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = text;
  button.append(iconBox, label, ...end);
  return button;
}

/** YouTube's switch at the end of a menu item, drawn from the item's `aria-checked`. */
function toggle(document: Document) {
  const track = document.createElement('span');
  track.className = 'toggle';
  track.setAttribute('aria-hidden', 'true');
  const knob = document.createElement('span');
  knob.className = 'knob';
  track.append(knob);
  return track;
}

function chevron(document: Document) {
  const box = document.createElement('span');
  box.className = 'chevron';
  box.setAttribute('aria-hidden', 'true');
  box.append(drawIcon(document, ['M10 7l5 5-5 5']));
  return box;
}


// Outline icons in the weight of YouTube's menu icons: 24 px, 2 px lines.
const ICONS = {
  // Two chevrons running into a bar: past this one.
  skipSponsored: ['M5 6l6 6-6 6', 'M12 6l6 6-6 6', 'M20 6v12'],
  // A gauge with its needle.
  speed: ['M4.5 17a8.5 8.5 0 1 1 15 0', 'M12 13l3.5-4'],
  // Two sliders, set.
  preferredSpeed: ['M4 8h16', 'M4 16h16', 'M9 5.5v5', 'M15 13.5v5'],
  back: ['M14 7l-5 5 5 5'],
};
const CHECK = ['M5 12.5l4.5 4.5L19 7.5'];
/** Three dots, filled: the "more" of YouTube's ⋮ buttons. */
const OPENER_ICON = ['M12 3.5a2 2 0 1 0 0 4a2 2 0 1 0 0-4z', 'M12 10a2 2 0 1 0 0 4a2 2 0 1 0 0-4z', 'M12 16.5a2 2 0 1 0 0 4a2 2 0 1 0 0-4z'];

/**
 * YouTube's menus, from the 2026-11 capture (rail.md, overflow-menu-dark.png):
 * a raised sheet with 12 px corners, 8 px above and below, 40 px items of
 * Roboto 14 px with a 24 px icon 16 px in, secondary text, and YouTube's
 * monochrome switch, in YouTube's colours (youtube-look.ts).
 */
const MENU_CSS = `
${lookVariables({ light: ':host', dark: ':host([data-theme="dark"])' })}
.menu {
  position: fixed;
  z-index: 2202;
  box-sizing: border-box;
  min-width: 234px;
  max-height: calc(100vh - 16px);
  overflow-y: auto;
  padding: 8px 0;
  border-radius: 12px;
  background-color: var(--shorts-flow-menu);
  box-shadow: var(--shorts-flow-menu-shadow);
  color: var(--shorts-flow-ink);
  font-family: Roboto, Arial, sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}
.menu[hidden] {
  display: none;
}
.item {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: 100%;
  height: 40px;
  margin: 0;
  padding: 0 12px 0 16px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
  white-space: nowrap;
  cursor: pointer;
}
.item:hover,
.item:focus-visible {
  background-color: var(--shorts-flow-menu-hover);
}
.item:focus {
  outline: none;
}
.item:focus-visible {
  outline: 2px solid var(--shorts-flow-ink);
  outline-offset: -2px;
}
.icon {
  display: flex;
  flex: none;
  width: 24px;
  height: 24px;
  margin-right: 12px;
}
.label {
  flex: 1;
  margin-right: 16px;
}
.value {
  color: var(--shorts-flow-secondary);
  font-size: 12px;
  line-height: 18px;
}
.chevron {
  display: flex;
  width: 24px;
  height: 24px;
  margin-left: 4px;
  color: var(--shorts-flow-secondary);
}
[role="menuitemradio"] .icon {
  visibility: hidden;
}
[role="menuitemradio"][aria-checked="true"] .icon {
  visibility: visible;
}
.back {
  height: 48px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--shorts-flow-menu-hover);
  font-weight: 500;
}
.toggle {
  position: relative;
  flex: none;
  box-sizing: border-box;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background-color: var(--shorts-flow-toggle-off);
  transition: background-color 0.1s;
}
.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--shorts-flow-knob-off);
  box-shadow: var(--shorts-flow-knob-shadow);
  transition: transform 0.1s, background-color 0.1s;
}
[aria-checked="true"] .toggle {
  background-color: var(--shorts-flow-toggle-on);
}
[aria-checked="true"] .knob {
  transform: translateX(16px);
  background-color: var(--shorts-flow-knob-on);
}
@media (prefers-reduced-motion: reduce) {
  .toggle, .knob { transition: none; }
}
@media (forced-colors: active) {
  .menu { border: 1px solid CanvasText; }
  .toggle { border: 1px solid CanvasText; }
  .knob { background-color: CanvasText; }
  [aria-checked="true"] .toggle { background-color: Highlight; }
}
`;
