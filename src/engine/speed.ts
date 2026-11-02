import { DEFAULT_SETTINGS, PREFERRED_SPEEDS, type Settings } from '@/settings/settings';
import type { Feature } from './feed';
import { currentShortId, isShortsVideo, shortsVideo } from './youtube';

const HAVE_CURRENT_DATA = 2;

/**
 * Speed: while it is on, every new Current Short plays at the Preferred
 * Speed. YouTube's own speed goes back to 1× on every reload; this one lasts.
 * Turning Speed off goes back to 1×. While it is off, the speed is YouTube's.
 *
 * It lives alongside YouTube's own speed menu: a speed the viewer picks there
 * wins for the Current Short, and the next Short goes back to the Preferred
 * Speed. So the speed is set as each Short becomes current, never every time
 * the speed changes. YouTube plays every Short in the same `<video>`, so a new
 * Short is a new Short id, not a new element.
 *
 * Auto-Scroll's end detection reads the speed as it plays, so Advances still
 * come at the true end at any speed.
 */
export const speed: Feature = (feed) => {
  const { document } = feed;
  let wanted: Pick<Settings, 'speedOn' | 'preferredSpeed'> | undefined;
  /** The Short last seen current, and whether the viewer picked a speed of their own on it. */
  let current: { short: string | undefined; picked: boolean } | undefined;

  const play = (rate: number) => {
    const video = shortsVideo(document);
    if (!video) return;
    // The default carries the speed into the next Short's load before anything else runs.
    video.defaultPlaybackRate = rate;
    if (video.playbackRate !== rate) video.playbackRate = rate;
  };

  feed.watchSettings(({ speedOn, preferredSpeed }) => {
    const rate = preferredRate(preferredSpeed);
    const before = wanted;
    wanted = { speedOn, preferredSpeed: rate };
    if (before && before.speedOn === speedOn && before.preferredSpeed === rate) return;
    if (speedOn) {
      // A Preferred Speed picked just now is newer than any pick in YouTube's menu.
      if (current) current.picked = false;
      play(rate);
    } else if (before?.speedOn) {
      play(1);
    }
  });

  const observe = (event: Event) => {
    const video = event.target;
    if (!isShortsVideo(video) || !wanted?.speedOn) return;
    const short = currentShortId(document);
    const shown = current?.short === short && current ? current : (current = { short, picked: false });
    if (shown.picked) return;

    if (event.type === 'ratechange') {
      // Not the Preferred Speed, while the Short is under way: the viewer's pick in YouTube's menu.
      const underWay = video.readyState >= HAVE_CURRENT_DATA && video.currentTime > 0 && !video.seeking;
      if (video.playbackRate !== wanted.preferredSpeed && underWay) {
        shown.picked = true;
        return;
      }
    }
    play(wanted.preferredSpeed);
  };

  // A Short loading into the video, and the speed changing. Media events don't
  // bubble, so catch them on their way down to the video.
  for (const type of ['loadstart', 'loadedmetadata', 'canplay', 'playing', 'ratechange']) {
    document.addEventListener(type, observe, { capture: true, signal: feed.signal });
  }
};

/** `speed` if it is a Preferred Speed there is to pick, else the default. */
function preferredRate(speed: number): number {
  return PREFERRED_SPEEDS.includes(speed) ? speed : DEFAULT_SETTINGS.preferredSpeed;
}
