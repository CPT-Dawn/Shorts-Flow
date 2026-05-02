# Shorts Flow: Auto Scroll & Ad Skip

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Available-blue?logo=googlechrome)](https://chromewebstore.google.com/detail/shorts-flow-auto-scroll-a/kfkkpgeijmfhmdhlcnoecidgceljccdf)
[![Version](https://img.shields.io/badge/version-2.2.0-brightgreen.svg)](manifest.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Experience YouTube Shorts hands-free. **Shorts Flow** automatically scrolls to the next video when the current one ends, instantly skips ads, and adds an intuitive on-screen toggle right into the YouTube player.

## 📑 Table of Contents
- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
- [Configuration](#-configuration)
- [Technical Architecture](#-technical-architecture)
- [Development & Contributing](#-development--contributing)
- [License](#-license)

## ✨ Features

- **Seamless Auto-Scrolling**: Continuously scrolls to the next Short precisely when the current video finishes.
- **Zero-Delay Ad Skipping**: Detects sponsored content and ads instantly, scrolling past them before they play.
- **Native UI Integration**: Injects a sleek, non-intrusive toggle button directly above the 'Like' button in the Shorts player.
- **Smart Comment Handling**: Optionally pauses auto-scrolling when you are reading or typing in the comments section.
- **Robust Detection**: Built with dual URL and DOM observation to handle YouTube's Single Page Application (SPA) navigation flawlessly.

## 🚀 Installation

### From the Chrome Web Store
*(Link coming soon upon publication)*

### Manual Installation (Developer Mode)
1. Clone or download this repository.
   ```bash
   git clone https://github.com/yourusername/shorts-flow.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the repository directory.

## 💻 Usage

Once installed, Shorts Flow is designed to be unobtrusive. By default:
- **Auto-Scroll is OFF** when you launch your browser to prevent unexpected behavior.
- To enable it, simply click the extension icon in your browser toolbar and toggle **Auto-Scroll**, or use the **Quick Toggle** injected directly into the YouTube Shorts player.
- Navigate to [YouTube Shorts](https://www.youtube.com/shorts) and enjoy a hands-free experience.

## ⚙️ Configuration

Click the extension icon to access the settings panel:
- **Auto-Scroll**: The master switch for the extension's core functionality.
- **Quick Toggle**: Shows or hides the on-screen ON/OFF button injected into the YouTube player interface.
- **Scroll with Comments**: When enabled, the extension will continue to auto-scroll even if the comments panel is open. When disabled, opening comments acts as a temporary pause.

## 🏗 Technical Architecture

Shorts Flow is a Manifest V3 Chrome Extension engineered for performance and reliability against YouTube's highly dynamic DOM.

- **`manifest.json`**: Configures permissions (`storage`), host matching strictly to `youtube.com/shorts/*`, and registers the Service Worker and Content Scripts.
- **`script/content.js`**: The core engine.
  - Utilizes `MutationObserver` and custom event listeners (`yt-navigate-finish`, `ended`, `timeupdate`) to detect video lifecycle changes.
  - Implements element-based tracking (`currentShortElement`) and race-condition locks (`isChecking`) to maintain state stability without relying solely on DOM IDs.
  - Incorporates safety polling to catch edge cases where native `<video>` events are swallowed by the browser.
- **`script/background.js`**: The Service Worker. Manages default installation states and ensures auto-scroll is safely disabled upon browser startup (`chrome.runtime.onStartup`).
- **`script/script.js` & UI**: A lightweight, accessible, and responsive popup interface that syncs instantly with `chrome.storage.local`.

## 🛠 Development & Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the project.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes following [Conventional Commits](https://www.conventionalcommits.org/).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

### Code Style
- Use modern ES6+ JavaScript.
- Avoid arbitrary `setTimeout` delays for DOM manipulation; prefer `MutationObserver` or specific event listeners.
- Handle potential `NotFoundError` exceptions during DOM injection using `contains()` validation.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
