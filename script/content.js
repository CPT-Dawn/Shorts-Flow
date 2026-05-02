// ------------------------------
// CONSTANT SELECTORS VARIABLES
// ------------------------------
const VIDEOS_LIST_SELECTORS = [
  ".reel-video-in-sequence",
  ".reel-video-in-sequence-new",
];
const CURRENT_SHORT_SELECTOR = "ytd-reel-video-renderer";
const LIKE_BUTTON_SELECTOR =
  "like-button-view-model button, #like-button button, [aria-label*='like' i] button";
const COMMENTS_SELECTOR =
  "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-comments-section']";

// ------------------------------
// APP VARIABLES
// ------------------------------
let scrollOnCommentsCheck = false;
let showOnScreenButton = true;
// ------------------------------
// STATE VARIABLES
// ------------------------------
let currentShortId = null;
let currentShortElement = null; // Track element instead of just ID
let currentVideoElement = null;
let applicationIsOn = false;
let onScreenToggleButton = null;
let scrollTimeout;
let lastScrolledElement = null; // Use element for more reliable locking
let lastVideoTime = 0;
let isChecking = false; // Prevent race conditions
let safetyCheckInterval = null; // For periodic checks
const MAX_RETRIES = 15;
const RETRY_DELAY_MS = 500;
// ------------------------------
// MAIN FUNCTIONS
// ------------------------------
function startAutoScrolling() {
  if (!applicationIsOn) {
    applicationIsOn = true;
    currentShortId = null;
    currentShortElement = null;
    currentVideoElement = null;
    lastScrolledElement = null;
    lastVideoTime = 0;
  }

  // Start safety check interval if not already running
  if (!safetyCheckInterval) {
    safetyCheckInterval = setInterval(() => {
      if (applicationIsOn && isShortsPage()) {
        const video = currentVideoElement;
        if (
          video &&
          (video.ended ||
            (video.duration > 0 && video.currentTime >= video.duration - 0.1))
        ) {
          onVideoEnded();
        }
        // Also ensure we haven't missed a short change
        checkForNewShort();
      }
    }, 2000); // Check every 2 seconds as a safety net
  }

  checkForNewShort();
  updateOnScreenButtonState();
}

function stopAutoScrolling() {
  applicationIsOn = false;

  if (safetyCheckInterval) {
    clearInterval(safetyCheckInterval);
    safetyCheckInterval = null;
  }

  if (currentVideoElement) {
    currentVideoElement.setAttribute("loop", "true");
    currentVideoElement.removeEventListener("ended", onVideoEnded);
    currentVideoElement.removeEventListener("timeupdate", onTimeUpdate);
    currentVideoElement._hasEndEvent = false;
  }
  updateOnScreenButtonState();
}
async function checkForNewShort() {
  if (!isShortsPage() || isChecking) return;
  isChecking = true;

  try {
    const currentShort = findShortContainer();
    if (!currentShort) return;

    // Use both element reference and ID for tracking
    if (
      currentShort !== currentShortElement ||
      (currentShort.id && currentShort.id !== currentShortId)
    ) {
      if (scrollTimeout) clearTimeout(scrollTimeout);

      removeOnScreenToggleButton();

      if (currentVideoElement) {
        currentVideoElement.removeEventListener("ended", onVideoEnded);
        currentVideoElement.removeEventListener("timeupdate", onTimeUpdate);
        currentVideoElement._hasEndEvent = false;
      }

      currentShortElement = currentShort;
      currentShortId = currentShort.id;
      lastScrolledElement = null; // Reset scroll lock for new short
      lastVideoTime = 0; // Reset time tracking
      currentVideoElement = currentShort.querySelector("video");

      if (currentVideoElement == null) {
        let l = 0;
        while (
          currentVideoElement == null &&
          currentShort === currentShortElement
        ) {
          currentVideoElement = currentShort.querySelector("video");
          if (l > MAX_RETRIES) {
            let prevShortElement = currentShortElement;
            currentShortId = null;
            currentShortElement = null;
            if (applicationIsOn) {
              return scrollToNextShort(prevShortElement);
            } else {
              return;
            }
          }
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          l++;
        }
      }

      if (
        currentShort.querySelector("ytd-ad-slot-renderer") ||
        currentShort.querySelector("ad-button-view-model")
      ) {
        if (applicationIsOn) {
          removeOnScreenToggleButton();
          return scrollToNextShort(currentShortElement, false);
        }
      }

      if (currentVideoElement) {
        // Ensure we don't add multiple listeners
        currentVideoElement.removeEventListener("ended", onVideoEnded);
        currentVideoElement.removeEventListener("timeupdate", onTimeUpdate);

        currentVideoElement.addEventListener("ended", onVideoEnded);
        currentVideoElement.addEventListener("timeupdate", onTimeUpdate);
        currentVideoElement._hasEndEvent = true;

        // Ensure loop is off immediately
        if (applicationIsOn) {
          currentVideoElement.loop = false;
          currentVideoElement.removeAttribute("loop");
        }

        // If the video is already ended, trigger scroll
        if (currentVideoElement.ended && applicationIsOn) {
          onVideoEnded();
        }
      }

      checkAndManageOnScreenButton();
    }

    if (currentVideoElement?.hasAttribute("loop") && applicationIsOn) {
      currentVideoElement.removeAttribute("loop");
      currentVideoElement.loop = false;
    }
  } finally {
    isChecking = false;
  }
}

function onVideoEnded() {
  if (!applicationIsOn) return stopAutoScrolling();

  // Prevent duplicate triggers for the same short
  if (
    lastScrolledElement === currentShortElement &&
    currentShortElement !== null
  )
    return;
  lastScrolledElement = currentShortElement;

  scrollToNextShort(currentShortElement);
}

function onTimeUpdate() {
  if (!applicationIsOn || !currentVideoElement) return;

  const video = currentVideoElement;
  const currentTime = video.currentTime;
  const duration = video.duration;

  // YouTube sometimes re-enables loop on user interaction/seeking
  if (video.loop || video.hasAttribute("loop")) {
    video.loop = false;
    video.removeAttribute("loop");
  }

  // If video is within 0.5s of end and playing, trigger scroll
  const isNearEnd =
    duration > 0 && duration - currentTime < 0.5 && !video.paused;

  // Jump back check: if time suddenly decreases while we were near the end,
  // it means the video looped back to the start.
  const hasLoopedBack =
    currentTime < lastVideoTime &&
    lastVideoTime > duration - 2 &&
    currentTime < 1;

  if (isNearEnd || hasLoopedBack) {
    onVideoEnded();
  }

  lastVideoTime = currentTime;
}

async function scrollToNextShort(
  prevShort = null,
  useDelayAndCheckComments = true,
) {
  if (!applicationIsOn) return stopAutoScrolling();
  if (prevShort) lastScrolledElement = prevShort; // Prevent multiple triggers from the same short

  const comments = document.querySelector(COMMENTS_SELECTOR);
  const isCommentsOpen = () => {
    const visibilityOfComments = comments?.attributes["VISIBILITY"]?.value;
    return visibilityOfComments === "ENGAGEMENT_PANEL_VISIBILITY_EXPANDED";
  };
  // Check if comments is open, and settings are set to scroll on comments
  if (comments && useDelayAndCheckComments) {
    if (isCommentsOpen() && !scrollOnCommentsCheck) {
      useDelayAndCheckComments = false; // If the comments are open, don't wait for the additional scroll delay when scrolling
      // If the comments are open, wait till they are closed (if the setting is set to scroll on comments)
      while (
        isCommentsOpen() && // Waits till the comments are closed
        !scrollOnCommentsCheck && // Stops if the setting is changed
        prevShort === currentShortElement // Stops if the short changes
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }
  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(async () => {
    if (prevShort != null && currentShortElement != prevShort) return; // If the short changed, don't scroll
    const nextShortContainer = await waitForNextShort();
    if (nextShortContainer == null && isShortsPage())
      return window.location.reload(); // If no next short is found, reload the page (Last resort)
    // If next short container is found, remove the current video element end event listener
    if (currentVideoElement) {
      currentVideoElement.removeEventListener("ended", onVideoEnded);
      currentVideoElement.removeEventListener("timeupdate", onTimeUpdate);
      currentVideoElement._hasEndEvent = false;
    }
    // Scroll to the next short container
    nextShortContainer.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });

    // Then check the new short
    checkForNewShort();

    // Ensure the button is properly managed after scrolling
    setTimeout(() => {
      checkAndManageOnScreenButton();
    }, 500); // Small delay to ensure DOM is updated
  }, 0);
}
function findShortContainer(id = null) {
  let shorts = [];
  // Finds the short container by the selector (Incase of updates)
  for (let i = 0; i < VIDEOS_LIST_SELECTORS.length; i++) {
    const shortList = [...document.querySelectorAll(VIDEOS_LIST_SELECTORS[i])];
    if (shortList.length > 0) {
      shorts = [...shortList];
      break;
    }
  }

  // If no shorts found by sequence class, try direct renderer elements
  if (shorts.length === 0) {
    shorts = [...document.querySelectorAll(CURRENT_SHORT_SELECTOR)];
  }

  // If an id is provided, find the short with that id
  if (id != null) {
    if (shorts.length === 0) return document.getElementById(id);
    const short = shorts.find((short) => short.id == id.toString());
    if (short) return short;
  }

  // Find the active short
  const activeShort = shorts.find(
    (short) =>
      short.hasAttribute("is-active") ||
      short.querySelector("[is-active]") ||
      // In some YouTube versions, the active short is the only one with a playing video
      (short.querySelector("video") && !short.querySelector("video").paused),
  );

  if (activeShort) return activeShort;

  // Fallback to current element if it's still in DOM
  if (currentShortElement && document.body.contains(currentShortElement)) {
    return currentShortElement;
  }

  // Last resort: first short or ID "0"
  return shorts[0] || document.getElementById("0");
}

async function waitForNextShort(retries = 5, delay = 500) {
  if (!isShortsPage()) return null;

  // First, try to find the next sibling of the current short
  // This is the most reliable way as it doesn't depend on IDs being sequential
  const currentShort = currentShortElement || findShortContainer();

  for (let i = 0; i < retries; i++) {
    let nextShort = null;

    // Strategy 1: Check next sibling
    if (currentShort && currentShort.nextElementSibling) {
      const sibling = currentShort.nextElementSibling;
      // Verify it matches one of our expected selectors or is a valid container
      if (
        VIDEOS_LIST_SELECTORS.some((selector) => sibling.matches(selector)) ||
        sibling.tagName.toLowerCase() === "ytd-reel-video-renderer" ||
        sibling.classList.contains("reel-video-in-sequence")
      ) {
        nextShort = sibling;
      }
    }

    // Strategy 2: Fallback to ID + 1
    if (!nextShort && currentShortId !== null) {
      const currentIdNum = parseInt(currentShortId);
      if (!isNaN(currentIdNum)) {
        const nextId = currentIdNum + 1;
        const potentialNext = findShortContainer(nextId);
        // STRICT CHECK: Only accept if the ID actually matches what we asked for.
        if (potentialNext && potentialNext.id == nextId.toString()) {
          nextShort = potentialNext;
        }
      }
    }

    if (nextShort) return nextShort;

    // If none found, little slight screen shake to trigger hydration of new shorts
    window.scrollBy(0, 100);
    await new Promise((r) => setTimeout(r, delay));
    window.scrollBy(0, -100);
    await new Promise((r) => setTimeout(r, delay));
  }
  return null;
}

function createOnScreenToggleButton() {
  if (onScreenToggleButton || !showOnScreenButton) return;

  const likeButton = document.querySelector(LIKE_BUTTON_SELECTOR);
  if (!likeButton) return;

  const buttonContainer =
    likeButton.closest("like-button-view-model") ||
    likeButton.closest("button-view-model") ||
    likeButton.closest("#like-button") ||
    likeButton.closest('[role="button"]') ||
    likeButton.closest("ytd-toggle-button-renderer") ||
    likeButton.parentElement;

  if (!buttonContainer) return;

  const actionBar =
    buttonContainer.closest("reel-action-bar-view-model") ||
    buttonContainer.closest("#button-bar") ||
    buttonContainer.closest("#actions") ||
    buttonContainer.parentElement;

  if (!actionBar) return;

  const toggleButton = document.createElement("div");
  toggleButton.id = "yt-shorts-auto-scroll-toggle";
  toggleButton.innerHTML = `
        <div class="sf-toggle-btn ${applicationIsOn ? "active" : ""}"
             title="${applicationIsOn ? "Auto-scroll ON - Click to disable" : "Auto-scroll OFF - Click to enable"}">
            <div class="sf-toggle-btn-inner">
                <svg class="sf-toggle-svg" viewBox="0 0 24 24" fill="none">
                    <path d="M7 10l5 5 5-5H7z" fill="currentColor"/>
                    <path d="M7 14l5 5 5-5H7z" fill="currentColor"/>
                </svg>
                <span class="sf-toggle-text">
                    ${applicationIsOn ? "ON" : "OFF"}
                </span>
            </div>
        </div>
    `;

  toggleButton.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();

    const newState = !applicationIsOn;
    chrome.storage.local.set({ applicationIsOn: newState });
    if (newState) startAutoScrolling();
    else stopAutoScrolling();
  });

  actionBar.insertBefore(toggleButton, buttonContainer);
  onScreenToggleButton = toggleButton;
}

function updateOnScreenButtonState() {
  if (!onScreenToggleButton) return;

  const buttonElement = onScreenToggleButton.querySelector(".sf-toggle-btn");
  const textElement = onScreenToggleButton.querySelector(".sf-toggle-text");

  if (buttonElement) {
    buttonElement.title = applicationIsOn
      ? "Auto-scroll ON - Click to disable"
      : "Auto-scroll OFF - Click to enable";

    if (applicationIsOn) buttonElement.classList.add("active");
    else buttonElement.classList.remove("active");
  }

  if (textElement) {
    textElement.textContent = applicationIsOn ? "ON" : "OFF";
  }
}
function removeOnScreenToggleButton() {
  if (onScreenToggleButton) {
    onScreenToggleButton.remove();
    onScreenToggleButton = null;
  }
}

function checkAndManageOnScreenButton() {
  if (showOnScreenButton && isShortsPage()) {
    // Check if the button is still in the DOM
    if (onScreenToggleButton && !document.body.contains(onScreenToggleButton)) {
      onScreenToggleButton = null; // Reset if removed from DOM
    }

    if (!onScreenToggleButton) {
      createOnScreenToggleButton();
    } else {
      updateOnScreenButtonState();
    }
  } else {
    removeOnScreenToggleButton();
  }
}
// ------------------------------
// INITIATION AND SETTINGS FETCH
// ------------------------------
(function initiate() {
  // Initial state fetch - Default to false if not set
  chrome.storage.local.get(["applicationIsOn"], (result) => {
    if (result["applicationIsOn"] === true) startAutoScrolling();
    else stopAutoScrolling();
  });

  // Watch for short changes via MutationObserver (more efficient than polling)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "is-active"
      ) {
        if (mutation.target.hasAttribute("is-active")) {
          checkForNewShort();
        }
      } else if (mutation.type === "childList" && isShortsPage()) {
        checkForNewShort();
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    attributes: true,
    subtree: true,
    attributeFilter: ["is-active"],
  });

  // Handle storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes["applicationIsOn"]) {
      if (changes["applicationIsOn"].newValue) startAutoScrolling();
      else stopAutoScrolling();
    }

    if (changes["scrollOnComments"]) {
      scrollOnCommentsCheck = changes["scrollOnComments"].newValue;
    }

    if (changes["showOnScreenButton"]) {
      showOnScreenButton = changes["showOnScreenButton"].newValue;
      checkAndManageOnScreenButton();
    }
  });

  // Initial settings fetch
  chrome.storage.local.get(
    ["scrollOnComments", "showOnScreenButton"],
    (result) => {
      if (result["scrollOnComments"] !== undefined)
        scrollOnCommentsCheck = result["scrollOnComments"];
      if (result["showOnScreenButton"] !== undefined)
        showOnScreenButton = result["showOnScreenButton"];

      checkForNewShort();
    },
  );
})();
function isShortsPage() {
  let containsShortElements = false;
  const doesPageHaveAShort = document.querySelector(
    VIDEOS_LIST_SELECTORS.join(","),
  );
  if (doesPageHaveAShort) containsShortElements = true;
  return containsShortElements;
}
