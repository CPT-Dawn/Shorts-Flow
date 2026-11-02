export default defineContentScript({
  // All of youtube.com, not just the Shorts Feed: YouTube reaches /shorts/
  // without a page load, so the engine must already be there to notice.
  matches: ['https://www.youtube.com/*'],
  main() {
    // The engine mounts here once it exists. Off the Shorts Feed it does nothing.
  },
});
