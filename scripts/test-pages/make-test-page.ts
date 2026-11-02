// Turns a local capture of youtube.com/shorts into an anonymised test page:
// YouTube's markup and interface text stay exactly as captured, everything
// other people made (titles, names, descriptions, comments, pictures, ids)
// becomes a neutral placeholder, and the Shorts video plays a generated clip.
// See tests/pages/README.md.

import { load, type CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import postcss, { type Root } from 'postcss';
import { findLeaks, PLACEHOLDER } from './leaks';
import { isYouTubeText } from './youtube-text';

export type MakeTestPageOptions = {
  /** Clip addresses to hand out to the Shorts in turn. */
  clips: string[];
  /** The text of one of the capture's stylesheets, or undefined to leave it out. */
  stylesheet: (url: string) => Promise<string | undefined>;
};

export type TestPage = {
  html: string;
  /** The page's own Shorts address. */
  path: string;
  /** Every Short slot on the page, top to bottom, with the clip it plays. */
  shorts: { id: string; clip: string }[];
  /** The capture's text that became placeholders, for a person to skim. Never write it to the repo. */
  replacedText: string[];
};

const YOUTUBE = 'https://www.youtube.com/';

// A plain grey square stands in for every avatar and thumbnail.
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' fill='%23888'/%3E%3C/svg%3E";

const LOREM =
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ';

// Attributes that carry text a viewer reads or hears.
const TEXT_ATTRIBUTES = [
  'aria-label', 'title', 'alt', 'placeholder', 'aria-valuetext', 'data-tooltip-title', 'data-title-no-tooltip',
];

const DROPPED_ATTRIBUTES =
  /^(on.*|nonce|integrity|srcset|poster|data-original-src|data-loaded|data-sessionlink|data-id|crossorigin)$/;

export class LeakError extends Error {
  constructor(
    message: string,
    /** As in {@link TestPage.replacedText}. */
    readonly replacedText: string[],
  ) {
    super(message);
  }
}

export async function makeTestPage(capture: string, options: MakeTestPageOptions): Promise<TestPage> {
  // A capture is a live DOM written out as HTML. Read it back as written, not
  // as a browser would repair it, so YouTube's structure survives.
  const $ = load(capture, { xml: { xmlMode: false, decodeEntities: true, emptyAttrs: true } });
  const names = new Names();

  const slotIds = learnNames($, names);
  await inlineStylesheets($, options.stylesheet);
  removeOutsideResources($);
  replacePictures($);
  replaceLinks($, names);
  replaceWords($, names);
  replaceIds($, names);
  const shorts = assignClips($, slotIds, names, options.clips);
  keepNestedControls($);

  const html = $.html();
  checkBrowsersReadTheSameStructure($, html);
  const leaks = [...findLeaks(html), ...names.survivorsIn(html)];
  if (leaks.length > 0) {
    throw new LeakError(`The test page would still contain:\n  ${leaks.join('\n  ')}`, names.words.originals());
  }
  return {
    html,
    path: `/shorts/${shorts[currentSlot($)]?.id ?? ''}`,
    shorts,
    replacedText: names.words.originals(),
  };
}

/** Hands out stable stand-ins: the same real value always gets the same one. */
class Aliases {
  #seen = new Map<string, string>();
  constructor(private make: (n: number) => string) {}
  of(real: string) {
    if (!this.#seen.has(real)) this.#seen.set(real, this.make(this.#seen.size + 1));
    return this.#seen.get(real)!;
  }
  has(real: string) {
    return this.#seen.has(real);
  }
  originals() {
    return [...this.#seen.keys()];
  }
}

class Names {
  shortId = new Aliases(PLACEHOLDER.shortId);
  handle = new Aliases(PLACEHOLDER.handle);
  channelId = new Aliases(PLACEHOLDER.channelId);
  hashtag = new Aliases(PLACEHOLDER.hashtag);
  words = new Aliases(() => '');
  #placeholders = new Map<string, string>();

  placeholder(text: string) {
    this.words.of(text);
    if (!this.#placeholders.has(text)) this.#placeholders.set(text, lorem(text));
    return this.#placeholders.get(text)!;
  }

  /** Real values that are still somewhere in `html`, in any HTML escaping. */
  survivorsIn(html: string) {
    const text = unescapeHtml(html);
    const originals = [
      ...this.shortId.originals(),
      ...this.handle.originals(),
      ...this.channelId.originals(),
      ...this.words.originals().filter((words) => words.length >= 4),
    ];
    return originals.filter((original) => {
      const pattern = new RegExp(`(^|[^\\w])${escapeRegExp(original)}($|[^\\w])`, 'i');
      return pattern.test(text) || pattern.test(html);
    });
  }
}

// --- 1. Learn every Short id and channel handle, so each can be swapped everywhere.

function learnNames($: CheerioAPI, names: Names) {
  // Slots first, in order, so the Shorts get ids in the order they play.
  const slotIds = $('.reel-video-in-sequence-new')
    .toArray()
    .map((slot) => $(slot).find('[style*="/vi/"]').attr('style')?.match(/\/vi\/([\w-]{11})\//)?.[1]);
  for (const id of slotIds) if (id) names.shortId.of(id);
  const html = $.html().replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/g, '');
  for (const [, id] of html.matchAll(/\/(?:shorts|vi|watch\?v=|source)\/?([\w-]{11})(?![\w-])/g)) {
    names.shortId.of(id!);
  }
  for (const [, handle] of html.matchAll(/(?:\/|\s|>|"|^)@([\w.-]+)/g)) names.handle.of(handle!);
  for (const [, id] of html.matchAll(/\/channel\/(UC[\w-]{22})/g)) names.channelId.of(id!);
  return slotIds;
}

// --- 2. Bring in YouTube's stylesheets, keeping only rules for what is on the page.

async function inlineStylesheets($: CheerioAPI, stylesheet: MakeTestPageOptions['stylesheet']) {
  const tokens = pageTokens($);
  const inlined = new Set<string>();
  for (const link of $('link[rel="stylesheet"]').toArray()) {
    const href = link.attribs.href ?? '';
    if (!URL.canParse(href, YOUTUBE)) continue;
    const url = new URL(href, YOUTUBE).href;
    // YouTube links some stylesheets twice; the second copy changes nothing.
    if (inlined.has(url)) continue;
    const css = await stylesheet(url);
    if (css === undefined) continue;
    inlined.add(url);
    $(link).replaceWith($('<style>').text(pruneStylesheet(css, tokens)));
  }
  $('style').each((_, style) => {
    $(style).text(pruneStylesheet($(style).text(), tokens));
  });
}

function pageTokens($: CheerioAPI) {
  const tokens = new Set(['html', 'body', ':root']);
  $<Element, string>('*').each((_, el) => {
    tokens.add(el.name.toLowerCase());
    for (const [name, value] of Object.entries(el.attribs)) {
      tokens.add(`[${name.toLowerCase()}]`);
      if (name === 'id') tokens.add(`#${value}`);
      if (name === 'class') for (const c of value.split(/\s+/)) if (c) tokens.add(`.${c}`);
    }
  });
  return tokens;
}

function pruneStylesheet(css: string, tokens: Set<string>) {
  let root: Root;
  try {
    root = postcss.parse(css);
  } catch {
    return '';
  }
  root.walkAtRules((rule) => {
    if (rule.name === 'font-face' || rule.name === 'import') rule.remove();
  });
  root.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes$/.test((rule.parent as { name: string }).name)) return;
    const kept = rule.selectors.filter((selector) => selectorTokens(selector).every((t) => tokens.has(t)));
    if (kept.length === 0) rule.remove();
    else if (kept.length < rule.selectors.length) rule.selectors = kept;
  });
  root.walkDecls((decl) => {
    decl.value = decl.value.replace(/url\(\s*(["']?)(?!data:image\/svg\+xml)[^)]*\1\s*\)/g, 'none');
  });
  root.walkAtRules((rule) => {
    if (rule.nodes && rule.nodes.length === 0) rule.remove();
  });
  root.walkComments((comment) => {
    comment.remove();
  });
  return root.toString();
}

/** The tags, classes, ids and attributes an element needs for `selector` to match it. */
function selectorTokens(selector: string) {
  let plain = selector;
  // Drop functional pseudo-classes and their arguments (:not(), :is(), :nth-child()...).
  for (let previous = ''; previous !== plain; ) {
    previous = plain;
    plain = plain.replace(/::?[\w-]+\([^()]*\)/g, '');
  }
  const tokens: string[] = [];
  plain = plain.replace(/\[\s*([\w-]+)[^\]]*\]/g, (_, name: string) => {
    tokens.push(`[${name.toLowerCase()}]`);
    return ' ';
  });
  plain = plain.replace(/::?[\w-]+/g, ' ');
  for (const [token] of plain.matchAll(/[.#][\w-]+/g)) tokens.push(token);
  plain = plain.replace(/[.#][\w-]+/g, ' ');
  for (const [tag] of plain.matchAll(/[a-zA-Z][\w-]*/g)) tokens.push(tag.toLowerCase());
  return tokens;
}

// --- 3. Remove scripts and everything else that reaches outside the page.

function removeOutsideResources($: CheerioAPI) {
  $('script, noscript, iframe, object, embed, base, link').remove();
  $('meta').each((_, meta) => {
    const { charset, name } = meta.attribs;
    if (charset === undefined && name !== 'viewport' && name !== 'color-scheme') $(meta).remove();
  });
  removeComments($, $.root().toArray());
  $<Element, string>('*').each((_, el) => {
    for (const attribute of Object.keys(el.attribs)) {
      if (DROPPED_ATTRIBUTES.test(attribute)) $(el).removeAttr(attribute);
    }
  });
}

function removeComments($: CheerioAPI, nodes: AnyNode[]) {
  for (const node of nodes) {
    if (node.type === 'comment') $(node).remove();
    else if ('children' in node) removeComments($, (node as Element).children);
  }
}

// --- 4. Replace every picture.

function replacePictures($: CheerioAPI) {
  $('img[src]').each((_, img) => {
    if (img.attribs.src) img.attribs.src = PLACEHOLDER_IMAGE;
  });
  $('[style*="url("]').each((_, el) => {
    el.attribs.style = el.attribs.style!.replace(
      /url\((&quot;|["'])?(?!data:image\/svg\+xml)[^)]*\)/g,
      `url("${PLACEHOLDER_IMAGE}")`,
    );
  });
}

// --- 5. Point links at the page's own made-up addresses, or nowhere.

function replaceLinks($: CheerioAPI, names: Names) {
  $('a[href]').each((_, a) => {
    a.attribs.href = replaceHref(a.attribs.href!, names);
  });
}

function replaceHref(href: string, names: Names) {
  if (href === '' || href.startsWith('#')) return href;
  if (!URL.canParse(href, YOUTUBE)) return '#';
  const url = new URL(href, YOUTUBE);
  if (url.origin !== new URL(YOUTUBE).origin) return '#';
  const segments = url.pathname.split('/').map((segment, i, all) => {
    const previous = all[i - 1] ?? '';
    if (segment === '') return segment;
    if (segment.startsWith('@')) return `@${names.handle.of(segment.slice(1))}`;
    if (['shorts', 'watch', 'source', 'vi'].includes(previous)) return names.shortId.of(segment);
    if (previous === 'channel') return names.channelId.of(segment);
    if (previous === 'hashtag') return names.hashtag.of(segment);
    return segment;
  });
  return segments.join('/');
}

// --- 6. Replace names and everything people wrote.

function replaceWords($: CheerioAPI, names: Names) {
  const replace = (text: string) => {
    if (isYouTubeText(text)) return text;
    const named = replaceHandles(text, names);
    const rest = named.replace(/@channel\d+/g, '').trim();
    if (named !== text && (rest === '' || isYouTubeText(rest))) return named;
    if (names.handle.has(text)) return names.handle.of(text);
    return names.placeholder(text);
  };

  for (const attribute of TEXT_ATTRIBUTES) {
    $<Element, string>(`[${attribute}]`).each((_, el) => {
      const value = el.attribs[attribute]!.trim();
      if (value !== '') el.attribs[attribute] = replace(value);
    });
  }
  $('*')
    .not('style, script')
    .contents()
    .each((_, node) => {
      if (node.type !== 'text') return;
      const text = node.data.trim();
      if (text !== '') node.data = node.data.replace(text, replace(text));
    });
}

function replaceHandles(text: string, names: Names) {
  return text.replace(/(^|\s)@([\w.-]+)/g, (whole, space: string, handle: string) =>
    names.handle.has(handle) ? `${space}@${names.handle.of(handle)}` : whole,
  );
}

function lorem(text: string) {
  const length = [...text].length;
  const prefix = /^[#@]/.test(text) ? text[0]! : '';
  const rest = Math.max(length - prefix.length, 1);
  return (
    prefix +
    LOREM.repeat(Math.ceil(rest / LOREM.length) + 1)
      .slice(0, rest)
      .trimEnd()
      .padEnd(rest, 'x')
  );
}

// --- 7. Swap ids that sit in YouTube's own attributes.

function replaceIds($: CheerioAPI, names: Names) {
  $('[video-id]:not([video-id=""])').each((_, el) => {
    el.attribs['video-id'] = names.shortId.of(el.attribs['video-id']!);
  });
}

// --- 8. Give the Shorts video a generated clip; leave the hidden watch-page player alone.

function assignClips($: CheerioAPI, slotIds: (string | undefined)[], names: Names, clips: string[]) {
  const shorts = slotIds.map((original, i) => ({
    // A slot YouTube had not filled yet still gets an id of its own.
    id: names.shortId.of(original ?? `empty slot ${i}`),
    clip: clips[i % clips.length]!,
  }));
  $('ytd-reel-video-renderer video').each((_, video) => {
    video.attribs.src = shorts[currentSlot($)]?.clip ?? clips[0]!;
  });
  return shorts;
}

/** Which numbered slot holds YouTube's one Shorts renderer. */
function currentSlot($: CheerioAPI) {
  return Number($('ytd-reel-video-renderer').closest('.reel-video-in-sequence-new').attr('id') ?? 0);
}

// --- 9. Keep the structure a browser would rebuild differently.

/**
 * Script can put a button inside a button (YouTube's player does) or a link
 * inside a link, but HTML cannot say so: a browser reading it back closes the
 * outer one early and moves everything after it. The inner one becomes a span
 * with the same attributes, so every element stays where YouTube put it.
 */
function keepNestedControls($: CheerioAPI) {
  for (const tag of ['button', 'a']) {
    $<Element, string>(`${tag} ${tag}`).each((_, el) => {
      el.name = 'span';
      if (el.attribs.role === undefined) el.attribs.role = tag === 'a' ? 'link' : 'button';
    });
  }
}

/** Fails if a browser would read `html` into a different tree than the capture's. */
function checkBrowsersReadTheSameStructure($: CheerioAPI, html: string) {
  const asBrowsersRead = load(html);
  const shape = (page: CheerioAPI) =>
    page('ytd-app, ytd-app *')
      .toArray()
      .map((el) => `${page(el).parents().length} ${el.name}`);
  const expected = shape($);
  const actual = shape(asBrowsersRead);
  const at = expected.findIndex((line, i) => line !== actual[i]);
  if (at !== -1 || expected.length !== actual.length) {
    throw new Error(
      `A browser would rebuild the page differently from element ${at} (${expected[at]} became ${actual[at]}). ` +
        'Teach keepNestedControls() about this markup.',
    );
  }
}

function unescapeHtml(html: string) {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
