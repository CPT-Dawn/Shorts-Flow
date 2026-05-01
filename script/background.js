chrome.runtime.onInstalled.addListener((details) => {
  // Initialize default settings on first install
  chrome.storage.local.get(
    ["applicationIsOn", "scrollOnComments", "showOnScreenButton"],
    (result) => {
      if (result.applicationIsOn === undefined) {
        chrome.storage.local.set({ applicationIsOn: true });
      }
      if (result.scrollOnComments === undefined) {
        chrome.storage.local.set({ scrollOnComments: false });
      }
      if (result.showOnScreenButton === undefined) {
        chrome.storage.local.set({ showOnScreenButton: true });
      }
    },
  );

  console.log("[YouTube Shorts Auto Scroller] Extension installed/updated");
});

// Auto-reload on update
chrome.runtime.onUpdateAvailable.addListener(() => {
  chrome.runtime.reload();
});
