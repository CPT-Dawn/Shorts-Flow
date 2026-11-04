import { defineConfig } from 'wxt';
import { siteUrl } from './src/site/site-links';

/**
 * Shorts Flow's icons, drawn by `bun run icons` from the Tideline brand SVGs in
 * docs/design/brand. Chrome takes PNGs only. Firefox takes the SVG tile, and in
 * its toolbar the monochrome mark in a colour that suits the theme.
 */
const PNG_ICONS = { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' };
const SVG_ICON = 'icon/shorts-flow.svg';
const SVG_ICONS = { 16: SVG_ICON, 32: SVG_ICON, 48: SVG_ICON, 96: SVG_ICON, 128: SVG_ICON };
const TOOLBAR_ICONS = [16, 32].map((size) => ({
  // `light` is the light glyph, for dark toolbars; `dark` the reverse.
  light: 'icon/toolbar-light.svg',
  dark: 'icon/toolbar-dark.svg',
  size,
}));

/**
 * Everything the Firefox sources zip holds: enough to run
 * `bun install --frozen-lockfile && bun run build:firefox` and get the same package.
 */
export const SOURCES = [
  'src/**',
  'public/**',
  'package.json',
  'bun.lock',
  'tsconfig.json',
  'wxt.config.ts',
  'SOURCE-BUILD.md',
  'LICENSE',
] as const;

// One codebase builds the Chrome Web Store and Firefox Add-ons packages; Edge,
// Brave, Opera and Vivaldi install the Chrome one (ADR 0004).
export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  hooks: {
    // Each package carries only the icons its browser reads: SVGs for Firefox, PNGs for the rest.
    'build:publicAssets': (wxt, files) => {
      const unused = wxt.config.browser === 'firefox' ? '.png' : '.svg';
      for (const icon of files.filter((file) => file.relativeDest.endsWith(unused))) {
        files.splice(files.indexOf(icon), 1);
      }
    },
  },
  // Every page is an extension page in a modern browser: no polyfill, so
  // nothing in the package calls fetch().
  vite: () => ({ build: { modulePreload: { polyfill: false } } }),
  zip: {
    // The Firefox sources zip for Firefox Add-ons review: what it takes to
    // rebuild the package and nothing else (no tests, no YouTube captures).
    // SOURCE-BUILD.md tells the reviewer how.
    includeSources: [...SOURCES],
  },
  manifest: ({ browser }) => ({
    name: '__MSG_extensionName__',
    short_name: '__MSG_extensionShortName__',
    description: '__MSG_extensionDescription__',
    default_locale: 'en',
    homepage_url: siteUrl('home', {}),
    // Host access comes from the content script's match alone.
    permissions: ['storage'],
    icons: browser === 'firefox' ? SVG_ICONS : PNG_ICONS,
    action: {
      default_title: '__MSG_extensionShortName__',
      ...(browser === 'firefox' && {
        default_icon: { 16: SVG_ICON, 32: SVG_ICON },
        theme_icons: TOOLBAR_ICONS,
      }),
    },
    ...(browser !== 'firefox' && { minimum_chrome_version: '121' }),
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'shorts-flow@cptdawn.dev',
          // data_collection_permissions is known from desktop 140 but only
          // from Android 142, so 142 keeps web-ext lint clean. Zero
          // telemetry: see ADR 0003.
          strict_min_version: '142.0',
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
});
