// YouTube's own interface text on the Shorts Feed, as the November 2026
// captures show it. A test page keeps these words, because the engine and the
// Shorts Control rely on YouTube's labels. Every other piece of text was
// written by someone (titles, names, descriptions, comments, sound names) and
// becomes a placeholder. When a new capture brings new interface text, add it
// here rather than editing a test page by hand.

const EXACT = new Set([
  // Masthead, guide and footer
  'Back', 'Guide', 'Skip navigation', 'Search', 'Search with your voice', 'Settings', 'Sign in',
  'YouTube', 'YouTube Home', 'Home', 'Shorts', 'Subscriptions', 'You', 'History',
  'Sign in to like videos, comment, and subscribe.', 'Explore', 'Music', 'Movies & TV', 'Live',
  'Show more', 'Show less', 'More from YouTube', 'YouTube Premium', 'YouTube Music', 'YouTube Kids',
  'YouTube Labs', 'Report history', 'About', 'Press', 'Copyright', 'Contact us', 'Creators',
  'Advertise', 'Developers', 'Terms', 'Privacy', 'Policy & Safety', 'How YouTube works',
  'Test new features', 'IN',
  // Player
  'YouTube Video Player', 'Tap to unmute', 'Info', 'Shopping', 'Close', 'Play', 'Pause (k)',
  'Play (k)', 'Mute (m)', 'Volume', 'Show cards', 'More', 'Playlist', 'Watch later', 'Share',
  'Share link', 'Copy link', 'Include playlist', 'More actions', 'Enter Full Screen (f)',
  'Seek slider', 'No captions are available for this video', 'Subtitles/closed captions unavailable',
  'Next (SHIFT+n)', 'Clip', 'View chapter', 'View key moments', 'Expand', 'Collapse',
  'Theater mode (t)', 'Theater mode', 'Play on TV', 'Full screen (f)', 'Full screen', 'Mute', 'Next',
  'Picture-in-picture', 'Play from this position',
  'Exit precise seeking', 'Click or scroll the panel for the precise seeking.', 'Watch full video',
  "If playback doesn't begin shortly, try restarting your device.",
  'An error occurred while retrieving sharing information. Please try again later.',
  "You're signed out", 'Cancel', 'Confirm', 'tooltip', 'loading',
  // Shorts rail, navigation and panels
  'Like', 'Like this video', 'Subscribe', 'Remix', 'Comments', 'See more videos using this sound',
  'Previous video', 'Next video', 'Go to video', 'Go to channel', 'Close panel', 'Sort comments',
  'Top', 'Show featured comments', 'Newest', 'Show recent comments, including potential spam',
  'Likes', 'Views', 'Description', '...more', '…', '•', '·', '/',
]);

const PATTERNS: RegExp[] = [
  /^Videos you watch may be added to the TV's watch history and influence TV recommendations\./,
  /^© \d{4} Google LLC$/,
  /^[\d.,]+[KMB]?$/, // counts
  /^[\d.]+x$/, // speeds
  /^\d+:\d{2}(:\d{2})?$/, // times
  /^(NaN|\d+:\d{2}) \/ (NaN|\d+:\d{2})$/,
  /^[A-Z][a-z]{2} \d{1,2}(, \d{4})?$/, // dates
  /^\d{4}$/,
  /^\d+%( volume)?$/,
  /^(Seek to )?\d+ Minutes \d+ Seconds( of \d+ Minutes \d+ Seconds)?$/,
  /^[\d,.]+ (thousand |million |billion )?(likes|views|comments)$/,
  /^like this video along with [\d,.]+ (thousand |million |billion )?other people$/,
  /^View [\d,.]+[KMB]? comments$/,
  /^Comments [\d,.]+[KMB]?$/,
];

export function isYouTubeText(text: string): boolean {
  return EXACT.has(text) || PATTERNS.some((pattern) => pattern.test(text));
}
