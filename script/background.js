chrome.runtime.onInstalled.addListener((details) => {
  // Initialize default settings on first install
  chrome.storage.local.get(
    ["applicationIsOn", "scrollOnComments", "showOnScreenButton"],
    (result) => {
      // Default to OFF for auto-scrolling
      if (result.applicationIsOn === undefined) {
        chrome.storage.local.set({ applicationIsOn: false });
      }
      // Default to ON for scrolling on comments
      if (result.scrollOnComments === undefined) {
        chrome.storage.local.set({ scrollOnComments: true });
      }
      // Default to ON for quick toggle button
      if (result.showOnScreenButton === undefined) {
        chrome.storage.local.set({ showOnScreenButton: true });
      }
    },
  );

  console.log("[YouTube Shorts Auto Scroller] Extension installed/updated");
});

// Ensure auto-scrolling is OFF by default when browser starts
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.set({ applicationIsOn: false });
});

// Auto-reload on update
chrome.runtime.onUpdateAvailable.addListener(() => {
  chrome.runtime.reload();
});
