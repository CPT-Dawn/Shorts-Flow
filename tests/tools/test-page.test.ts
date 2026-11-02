import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { findLeaks } from '../../scripts/test-pages/leaks';
import { makeTestPage } from '../../scripts/test-pages/make-test-page';

// A tiny stand-in for a capture of youtube.com/shorts: YouTube's own markup and
// interface text, with made-up creators' content where a real capture has
// other people's titles, names, pictures and ids.
const CAPTURE = `<!doctype html>
<html dark="" lang="en"><head>
<script src="https://www.youtube.com/s/desktop/abc/jsbin/spf.js" nonce="x"></script>
<title>Moonlit Harbour Secrets - YouTube</title>
<meta name="description" content="Enjoy the videos and music you love">
<link rel="stylesheet" href="/s/player/abc/www-player.css" nonce="">
<link rel="stylesheet" href="//fonts.googleapis.com/css2?family=Roboto">
<link rel="icon" href="https://www.youtube.com/s/desktop/abc/img/favicon_32x32.png">
</head><body>
<ytd-app><ytd-shorts is-dark="" role="main">
<div id="shorts-inner-container" class="style-scope ytd-shorts">
<div id="0" class="reel-video-in-sequence-new style-scope ytd-shorts">
<div class="reel-video-in-sequence-thumbnail style-scope ytd-shorts" style="background-image: url(&quot;https://i.ytimg.com/vi/Qm3xYz7Ab_1/frame0.jpg&quot;);"></div>
<ytd-reel-video-renderer id="reel-video-renderer" class="style-scope ytd-shorts">
<div id="shorts-player"><video class="video-stream html5-main-video" style="width: 444px; height: 804px;" src="blob:https://www.youtube.com/0f1e2d3c" loop=""></video></div>
<a href="https://www.youtube.com/shorts/Qm3xYz7Ab_1" aria-label="Moonlit Harbour Secrets">Moonlit Harbour Secrets</a>
<div class="channel" aria-label="Go to channel @harbour_tales"><img src="https://yt3.ggpht.com/abcdef=s48" alt="harbour_tales"></div>
<a href="/@harbour_tales/shorts">@harbour_tales</a>
<span class="ytAttributedStringHost">Sea shanty · Old Crew (ft. Captain Wren)</span>
<a href="/hashtag/nightsailing/shorts">#NightSailing</a>
<reel-action-bar-view-model>
<like-button-view-model><button aria-label="like this video along with 238 thousand other people" aria-pressed="false"></button><span>238K</span></like-button-view-model>
<button-view-model><button aria-label="View 1,985 comments"></button><span>1,985</span></button-view-model>
<button-view-model><button aria-label="Share"></button><span>Share</span></button-view-model>
<button-view-model><button aria-label="Remix" aria-disabled="true"></button><span>Remix</span></button-view-model>
<pivot-button-view-model><a role="button" aria-label="See more videos using this sound" href="/source/Rk2Pq9Lm4Zx/shorts"></a></pivot-button-view-model>
</reel-action-bar-view-model>
</ytd-reel-video-renderer>
</div>
<div id="1" class="reel-video-in-sequence-new style-scope ytd-shorts">
<div class="reel-video-in-sequence-thumbnail style-scope ytd-shorts" style="background-image: url(&quot;https://i.ytimg.com/vi/Tn8wVb2Cd-3/frame0.jpg&quot;);"></div>
</div>
<div id="2" class="reel-video-in-sequence-new style-scope ytd-shorts">
<div class="reel-video-in-sequence-thumbnail style-scope ytd-shorts" style="background-image: url(&quot;https://i.ytimg.com/vi/Hj5kLp0Ef_9/frame0.jpg&quot;);"></div>
</div>
</div>
<div id="navigation-button-up" class="navigation-container"><button aria-label="Previous video"></button></div>
<div id="navigation-button-down" class="navigation-container"><button aria-label="Next video"></button></div>
</ytd-shorts>
<div id="movie_player"><video class="video-stream html5-main-video"></video></div>
<a href="https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fwww.youtube.com%2Fshorts%2FQm3xYz7Ab_1">Sign in</a>
</ytd-app>
</body></html>`;

const CREATORS_CONTENT = [
  'Moonlit Harbour Secrets',
  'harbour_tales',
  'Sea shanty',
  'Old Crew',
  'Captain Wren',
  'NightSailing',
  'nightsailing',
  'Qm3xYz7Ab_1',
  'Tn8wVb2Cd-3',
  'Hj5kLp0Ef_9',
  'Rk2Pq9Lm4Zx',
  'ytimg',
  'ggpht',
  'blob:',
];

const PLAYER_CSS = `
.html5-main-video { object-fit: cover; }
ytd-shorts[is-dark] .navigation-container { background: url(https://www.youtube.com/s/img/arrow.png); }
.unused-on-this-page { color: red; }
@font-face { font-family: Roboto; src: url(https://fonts.gstatic.com/roboto.woff2); }
`;

const CLIPS = ['/tests/pages/clips/clip-a.webm', '/tests/pages/clips/clip-b.webm'];

async function makeFromCapture(capture = CAPTURE) {
  return makeTestPage(capture, {
    clips: CLIPS,
    stylesheet: async (url) => (url === 'https://www.youtube.com/s/player/abc/www-player.css' ? PLAYER_CSS : undefined),
  });
}

describe('making a test page from a capture', () => {
  it("leaves none of the creators' titles, names, ids or pictures in it", async () => {
    const { html } = await makeFromCapture();

    for (const content of CREATORS_CONTENT) expect(html).not.toContain(content);
    expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org\/)/);
  });

  it("keeps YouTube's markup and its own interface text", async () => {
    const { html } = await makeFromCapture();

    for (const kept of [
      '<ytd-shorts is-dark="" role="main">',
      'class="reel-video-in-sequence-new style-scope ytd-shorts"',
      '<reel-action-bar-view-model>',
      'aria-label="like this video along with 238 thousand other people"',
      'aria-label="View 1,985 comments"',
      'aria-label="See more videos using this sound"',
      'aria-label="Next video"',
      'aria-label="Previous video"',
      '<span>Share</span>',
      '<span>Remix</span>',
      '>Sign in<',
    ]) {
      expect(html).toContain(kept);
    }
  });

  it('gives a creator the same neutral name everywhere they appear', async () => {
    const { html } = await makeFromCapture();

    expect(html).toContain('aria-label="Go to channel @channel1"');
    expect(html).toContain('alt="channel1"');
    expect(html).toContain('href="/@channel1/shorts"');
    expect(html).toContain('>@channel1<');
  });

  it("puts placeholders of the same length where people's words were", async () => {
    const { html } = await makeFromCapture();
    const title = html.match(/aria-label="([^"]*)">([^<]*)<\/a>/);

    expect(title?.[1]).toBe(title?.[2]);
    expect(title?.[1]).toHaveLength('Moonlit Harbour Secrets'.length);
    expect(html).toMatch(/>#[a-z ]{12}</);
  });

  it('removes scripts and every outside resource', async () => {
    const { html } = await makeFromCapture();

    expect(html).not.toMatch(/<(script|link|iframe|noscript)\b/);
    expect(html).not.toContain('nonce');
  });

  it('gives every Short a made-up id and the page its own Shorts address', async () => {
    const page = await makeFromCapture();

    expect(page.shorts.map((short) => short.id)).toEqual(['vid00000001', 'vid00000002', 'vid00000003']);
    expect(page.path).toBe('/shorts/vid00000001');
  });

  it('plays a generated clip in the Shorts video and leaves the hidden player alone', async () => {
    const page = await makeFromCapture();

    expect(page.shorts.map((short) => short.clip)).toEqual([CLIPS[0], CLIPS[1], CLIPS[0]]);
    expect(page.html).toContain(
      `<video class="video-stream html5-main-video" style="width: 444px; height: 804px;" src="${CLIPS[0]}" loop=""></video>`,
    );
    expect(page.html).toContain('<div id="movie_player"><video class="video-stream html5-main-video"></video></div>');
  });

  it('replaces every thumbnail and avatar with a plain placeholder picture', async () => {
    const { html } = await makeFromCapture();

    expect(html).not.toMatch(/data:image\/(png|jpe?g|webp|gif)/);
    expect(html.match(/data:image\/svg\+xml/g)).toHaveLength(4);
  });

  it("brings YouTube's stylesheets in, keeping only rules for what is on the page", async () => {
    const { html } = await makeFromCapture();

    expect(html).toContain('.html5-main-video { object-fit: cover; }');
    expect(html).toContain('ytd-shorts[is-dark] .navigation-container { background: none; }');
    expect(html).not.toContain('unused-on-this-page');
    expect(html).not.toContain('@font-face');
  });

  it('keeps a button inside a button where a browser reading the page would move it out', async () => {
    // YouTube's player builds this with script; read back as HTML, a browser
    // would close the outer button and push everything after it up a level.
    const capture = CAPTURE.replace(
      '<div id="shorts-player">',
      '<div id="shorts-player"><button class="badge"><div class="expanded"><button class="dismiss"></button></div></button>',
    );

    const { html } = await makeFromCapture(capture);
    const $ = load(html);

    expect($('button.badge .dismiss')).toHaveLength(1);
    expect($('#shorts-inner-container > .reel-video-in-sequence-new')).toHaveLength(3);
    expect($('#shorts-player > video')).toHaveLength(1);
  });

  it("makes a page when a hashtag shares its name with YouTube's own markup", async () => {
    // #shorts and #top are everyday hashtags, and also words in YouTube's
    // addresses and stylesheet selectors, which stay as captured.
    const capture = CAPTURE.replace(
      '<a href="/hashtag/nightsailing/shorts">#NightSailing</a>',
      '<a href="/hashtag/shorts/shorts">#shorts</a><a href="/hashtag/top/shorts">#top</a>',
    ).replace('</head>', '<style>#top, #shorts-player { color: inherit; }</style></head>');

    const { html } = await makeFromCapture(capture);

    expect(html).toContain('href="/hashtag/tag1/shorts"');
    expect(html).toContain('href="/hashtag/tag2/shorts"');
    expect(html).not.toMatch(/>#(shorts|top)</);
  });

  it('refuses to make the page when creator content hides somewhere it does not know', async () => {
    const capture = CAPTURE.replace('<ytd-shorts ', '<ytd-shorts data-headline="Moonlit Harbour Secrets" ');

    await expect(makeFromCapture(capture)).rejects.toThrow(/Moonlit Harbour Secrets/);
  });
});

describe('the scan every committed test page passes', () => {
  it('passes a page with only made-up ids, names and pictures', () => {
    const page =
      '<a href="/shorts/vid00000001">x</a><a href="/@channel1/shorts">@channel1</a>' +
      '<a href="/channel/UCchannel000000000000001">y</a><a href="/hashtag/tag1/shorts">#lorem</a>' +
      '<svg xmlns="http://www.w3.org/2000/svg"></svg><style>@media (min-width: 1px) {}</style>';

    expect(findLeaks(page)).toEqual([]);
  });

  it.each([
    ['a real Short id', '<a href="/shorts/Qm3xYz7Ab_1">x</a>', '/shorts/Qm3xYz7Ab_1'],
    ['a real handle', '<span>@harbour_tales</span>', '@harbour_tales'],
    ['a real channel id', '<a href="/channel/UC4R8DWoMoI7CAwX8_LjQHig">x</a>', 'UC4R8DWoMoI7CAwX8_LjQHig'],
    ['a real hashtag', '<a href="/hashtag/nightsailing/shorts">x</a>', '/hashtag/nightsailing'],
    ['an outside address', '<img src="https://yt3.ggpht.com/a=s48">', 'https://yt3.ggpht.com/a=s48'],
    ['a script', '<script></script>', '<script>'],
    ['a photo', '<img src="data:image/jpeg;base64,AAAA">', 'data:image/jpeg'],
    ['a recorded video', '<video src="blob:https://www.youtube.com/0f1e"></video>', 'blob:https://www.youtube.com/0f1e'],
  ])('flags %s', (_, page, leak) => {
    expect(findLeaks(page)).toContain(leak);
  });
});
