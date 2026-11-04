import { isDarkTheme, watchTheme } from './youtube';

/**
 * Part of the YouTube adapter (see youtube.ts): YouTube's own colours, the
 * Native Look (ADR 0002) of everything Shorts Flow draws on its pages. Its
 * theme variables are empty, so these are fixed values per theme, from its
 * 2026-11 stylesheets and captures (docs/reference/youtube-shorts-2026-11).
 * When YouTube changes its colours, this is the file to repair: features take
 * every colour from here and name none of their own.
 *
 * A feature's styles use the colours as CSS variables, `var(--shorts-flow-ink)`
 * and so on, declared for its element by `lookVariables`; the element follows
 * YouTube's theme with `followTheme`.
 */

/** YouTube's two themes. */
export type Theme = 'light' | 'dark';

/** One theme's colours. */
export type Look = {
  /** Text and icons: the rail's captions and icons, menu text. */
  ink: string;
  /** Secondary text: a menu item's value, a dialog's line of text. */
  secondary: string;
  /** The rail buttons' tonal fill, and on hover. */
  tonal: string;
  tonalHover: string;
  /** A small button raised on the rail (the quick-settings opener), and on hover. */
  raised: string;
  raisedHover: string;
  /** Menus (the player's ⋮ More actions): the sheet, its shadow, an item on hover. */
  menu: string;
  menuShadow: string;
  menuHover: string;
  /** YouTube's monochrome switch in a menu: the track off and on, the knob off and on, its shadow. */
  toggleOff: string;
  toggleOn: string;
  knobOff: string;
  knobOn: string;
  knobShadow: string;
  /** The snackbar (toast): inverted, so dark on the light theme. Its text, text button, and that button on hover. */
  snackbar: string;
  snackbarInk: string;
  snackbarAction: string;
  snackbarActionHover: string;
  /** Dialogs: the card, its shadow, the dim behind it. */
  dialog: string;
  dialogShadow: string;
  backdrop: string;
  /** The filled pill button, its text, and on hover. */
  filledButton: string;
  filledButtonInk: string;
  filledButtonHover: string;
  /** Tooltips: the same grey in both themes. */
  tooltip: string;
  tooltipInk: string;
};

export const YOUTUBE_LOOK: Readonly<Record<Theme, Look>> = {
  light: {
    ink: '#0f0f0f',
    secondary: '#606060',
    tonal: 'rgba(0, 0, 0, 0.05)',
    tonalHover: 'rgba(0, 0, 0, 0.1)',
    raised: '#e5e5e5',
    raisedHover: '#d9d9d9',
    menu: '#fff',
    menuShadow: '0 4px 32px rgba(0, 0, 0, 0.1)',
    menuHover: 'rgba(0, 0, 0, 0.1)',
    toggleOff: 'rgba(0, 0, 0, 0.1)',
    toggleOn: '#0f0f0f',
    knobOff: '#fff',
    knobOn: '#fff',
    knobShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
    snackbar: '#0f0f0f',
    snackbarInk: '#fff',
    snackbarAction: '#3ea6ff',
    snackbarActionHover: 'rgba(255, 255, 255, 0.2)',
    dialog: '#fff',
    dialogShadow: '0 4px 32px rgba(0, 0, 0, 0.1)',
    backdrop: 'rgba(0, 0, 0, 0.5)',
    filledButton: '#0f0f0f',
    filledButtonInk: '#fff',
    filledButtonHover: '#272727',
    tooltip: '#606060',
    tooltipInk: '#fff',
  },
  dark: {
    ink: '#f1f1f1',
    secondary: '#aaa',
    tonal: 'rgba(255, 255, 255, 0.1)',
    tonalHover: 'rgba(255, 255, 255, 0.2)',
    raised: '#3f3f3f',
    raisedHover: '#535353',
    menu: '#282828',
    menuShadow: '0 4px 32px rgba(0, 0, 0, 0.6)',
    menuHover: 'rgba(255, 255, 255, 0.1)',
    toggleOff: 'rgba(255, 255, 255, 0.2)',
    toggleOn: '#f1f1f1',
    knobOff: '#aaa',
    knobOn: '#0f0f0f',
    knobShadow: 'none',
    snackbar: '#f1f1f1',
    snackbarInk: '#0f0f0f',
    snackbarAction: '#065fd4',
    snackbarActionHover: 'rgba(0, 0, 0, 0.1)',
    dialog: '#212121',
    dialogShadow: '0 4px 32px rgba(0, 0, 0, 0.1)',
    backdrop: 'rgba(0, 0, 0, 0.5)',
    filledButton: '#f1f1f1',
    filledButtonInk: '#0f0f0f',
    filledButtonHover: '#d9d9d9',
    tooltip: '#606060',
    tooltipInk: '#fff',
  },
};

/**
 * CSS declaring every colour of the Look as a variable, `--shorts-flow-<name>`
 * (`menuHover` as `--shorts-flow-menu-hover`, clear of YouTube's own `--yt-*`
 * ones): the light theme's on `light`, the dark theme's on `dark`, two
 * selectors for the element that follows the theme (`:host` and
 * `:host([data-theme="dark"])` in a shadow root).
 */
export function lookVariables({ light, dark }: Record<Theme, string>): string {
  const declarations = (look: Look) =>
    Object.entries(look)
      .map(([name, value]) => `  --shorts-flow-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}: ${value};`)
      .join('\n');
  return `${light} {\n${declarations(YOUTUBE_LOOK.light)}\n}\n${dark} {\n${declarations(YOUTUBE_LOOK.dark)}\n}\n`;
}

/**
 * Keeps `element`'s `data-theme` on YouTube's theme, `dark` or `light`, until
 * `signal` aborts, so its styles pick their colours by it.
 */
export function followTheme(document: Document, element: HTMLElement, signal: AbortSignal): void {
  const setTheme = (dark: boolean) => (element.dataset.theme = dark ? 'dark' : 'light');
  setTheme(isDarkTheme(document));
  watchTheme(document, setTheme, signal);
}
