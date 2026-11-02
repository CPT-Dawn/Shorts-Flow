import type { Feed } from './feed';
import { currentShortId, isShortsVideo } from './youtube';

/**
 * How short of its end, in seconds of real time, a Short may jump back and
 * still count as having played to its end: the browser takes a moment to
 * report the jump.
 */
const END_TOLERANCE = 0.25;

/** The last time the Shorts video reported where it was. */
type Report = {
  /** Which Short it was playing. */
  short: string | undefined;
  /** Its playback position, in seconds. */
  time: number;
  /** When it was there, in ms on the page's clock. */
  at: number;
  /** How fast it was playing on from there: 0 while paused or waiting for data. */
  speed: number;
  /** Whether this playthrough has reached its end already. */
  ended: boolean;
};

/**
 * The end-of-Short detector. Calls `onEnd` once per playthrough of the
 * Current Short, when its playback position reaches the end, or wraps from
 * the end back to the start, whichever it sees first. YouTube loops Shorts
 * natively and `ended` never fires, so the position is all there is; the
 * looping is left alone. A Short that is not Advanced just plays again.
 *
 * YouTube plays every Short in the same `<video>`, so what was seen of one
 * Short is forgotten as soon as the video moves on to another.
 */
export function watchShortEnds(feed: Feed, onEnd: () => void): void {
  let last: Report | undefined;

  const observe = (event: Event) => {
    const video = event.target;
    if (!isShortsVideo(video)) return;
    // A new Short, or the same one reloaded: its position starts afresh.
    if (event.type === 'emptied' || event.type === 'loadstart') {
      last = undefined;
      return;
    }
    const short = currentShortId(feed.document);
    if (last && last.short !== short) last = undefined;
    const { currentTime: time, duration } = video;
    if (!(duration > 0)) return;

    const speed = !video.paused && video.readyState >= video.HAVE_FUTURE_DATA ? video.playbackRate : 0;
    // Media plays in real time, so this is the page's clock, not the engine's.
    const at = event.timeStamp;
    const jumpedBack = last !== undefined && time < last.time;
    // Where playback had got to when it jumped, had it kept going since its
    // last report. Sparse reports, at any speed, still see it reach the end.
    const reached = last ? last.time + ((at - last.at) / 1000) * last.speed : time;
    const finished =
      video.ended || time >= duration || (jumpedBack && reached >= duration - END_TOLERANCE * last!.speed);

    if (finished && !last?.ended) onEnd();
    // A jump back clear of the end begins the next playthrough.
    const nextPlaythrough = jumpedBack && time < duration - END_TOLERANCE * video.playbackRate;
    last = { short, time, at, speed, ended: !nextPlaythrough && (finished || (last?.ended ?? false)) };
  };

  // Every event that reports a change in where or how fast the video plays.
  // Media events don't bubble, so catch them on their way down to the video.
  const types = ['timeupdate', 'seeking', 'ended', 'pause', 'playing', 'waiting', 'ratechange', 'emptied', 'loadstart'];
  for (const type of types) feed.document.addEventListener(type, observe, { capture: true, signal: feed.signal });
}
