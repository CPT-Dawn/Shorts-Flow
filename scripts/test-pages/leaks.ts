// The scan every committed test page must pass: nothing in it may point back
// to YouTube's servers or to a real Short, channel or picture. It works on the
// page's text alone, so the test-page tool and the browser tests share it.

/** The made-up ids and names the test-page tool hands out. */
export const PLACEHOLDER = {
  shortId: (n: number) => `vid${String(n).padStart(8, '0')}`,
  handle: (n: number) => `channel${n}`,
  channelId: (n: number) => `UCchannel${String(n).padStart(15, '0')}`,
  hashtag: (n: number) => `tag${n}`,
};

const OUTSIDE_HOSTS = /\b(ytimg\.com|ggpht\.com|googleusercontent\.com|googlevideo\.com|doubleclick\.net|gstatic\.com|googleapis\.com|google\.com|youtube\.com)\b/g;

/** Everything in `html` that a committed test page must not contain. */
export function findLeaks(html: string): string[] {
  const markup = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '');
  const leaks = [
    ...matches(html, /<(script|link|iframe|object|embed|noscript)\b[^>]*>/g),
    ...matches(html, /https?:\/\/(?!www\.w3\.org\/)[^\s"'<>)]+/g),
    ...matches(html, /(?<![\w:])\/\/[a-z0-9-]+\.[a-z0-9.-]+/g),
    ...matches(html, OUTSIDE_HOSTS),
    ...matches(html, /blob:[^\s"'<>)]*/g),
    ...matches(html, /data:image\/(?!svg\+xml)[\w+.-]+/g),
    ...matches(markup, /\/(shorts|watch|embed|source|vi)\/(?!vid\d{8}\b)[\w-]{11}\b/g),
    ...matches(markup, /[?&]v=(?!vid\d{8}\b)[\w-]{11}\b/g),
    ...matches(markup, /\bUC(?!channel\d{15}\b)[\w-]{22}\b/g),
    ...matches(markup, /\/hashtag\/(?!tag\d+\/)[^/"'#?]+/g),
    ...matches(markup, /(?<![\w./-])@(?!channel\d+\b)[\w.-]+/g),
  ];
  return [...new Set(leaks)];
}

function matches(text: string, pattern: RegExp) {
  return [...text.matchAll(pattern)].map((match) => match[0]);
}
