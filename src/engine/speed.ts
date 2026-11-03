import { DEFAULT_SETTINGS, PREFERRED_SPEEDS, type Settings } from '@/settings/settings';
import type { Feature } from './feed';
import { currentShortId, isShortsVideo, shortsVideo } from './youtube';

const HAVE_CURRENT_DATA = 2;

/**
 * The speed Speed last set on the Shorts video, for as long as the page
 * lives. YouTube keeps the video while the viewer is elsewhere on YouTube, so
 * a later visit must know which speed is Shorts Flow's to take back: Speed
 * may have been switched off in the meantime.
 */
const setBySpeed = new WeakMap<HTMLVideoElement, number>();

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
 *
 * The speed outlives the visit on the video YouTube keeps, so Speed tidies
 * up after itself: leaving the Shorts Feed, it hands the video's default (the
 * speed its next Short loads at) back to 1×; arriving with Speed off, it takes
 * back a speed it set before, unless the viewer has picked another since.
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
    if (rate === 1) setBySpeed.delete(video);
    else setBySpeed.set(video, rate);
  };

  /** Back to 1×, wherever the video still plays at the speed Speed set on it. */
  const takeBack = (video: HTMLVideoElement | undefined) => {
    const rate = video && setBySpeed.get(video);
    if (!video || rate === undefined) return;
    setBySpeed.delete(video);
    if (video.defaultPlaybackRate === rate) video.defaultPlaybackRate = 1;
    if (video.playbackRate === rate) video.playbackRate = 1;
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
    } else if (!before) {
      // Arriving with Speed off: it may have been switched off elsewhere.
      takeBack(shortsVideo(document));
    }
  });

  const observe = (event: Event) => {
    const video = event.target;
    if (!isShortsVideo(video) || !wanted) return;
    if (!wanted.speedOn) {
      // The video may only appear (or load) once Speed is known to be off.
      takeBack(video);
      return;
    }
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

  // Leaving: the Short in view keeps its speed (it is out of sight, or the
  // engine is going away), but no later Short loads at the Preferred Speed on
  // the strength of a visit that has ended.
  feed.signal.addEventListener(
    'abort',
    () => {
      const video = shortsVideo(document);
      const rate = video && setBySpeed.get(video);
      if (video && rate !== undefined && video.defaultPlaybackRate === rate) video.defaultPlaybackRate = 1;
    },
    { once: true },
  );
};

/** `speed` if it is a Preferred Speed there is to pick, else the default. */
function preferredRate(speed: number): number {
  return PREFERRED_SPEEDS.includes(speed) ? speed : DEFAULT_SETTINGS.preferredSpeed;
}
