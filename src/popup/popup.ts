import type { WhatsNew } from '@/lifecycle/whats-new';
import type { SessionStore } from '@/settings/session';
import type { Settings, SettingsStore } from '@/settings/settings';
import type { BrowserInfo } from '@/site/browser-info';
import { siteUrl } from '@/site/site-links';
import type { HostAccess } from './host-access';
import { drawMark } from './mark';
import type { PopupMessage } from './messages';
import { POPUP_ROWS, STATUS_PARTS, type PopupContext, type PopupRow, type StatusPart } from './rows';
import './popup.css';

export type { HostAccess } from './host-access';
export type { PopupMessage } from './messages';
export type { PopupContext, PopupRow, StatusPart } from './rows';

export type PopupOptions = {
  settings: SettingsStore;
  /** The current Session, kept by the Shorts tabs. */
  session: SessionStore;
  /** Looks up text in the locale files, filling in `substitutions` in order: `browser.i18n.getMessage`. */
  getMessage: (key: PopupMessage, substitutions?: string[]) => string;
  /** The extension's version, from the manifest. */
  version: string;
  /** Whether an update brought news the viewer hasn't opened yet. */
  whatsNew: WhatsNew;
  /** The browser's name and version, for the Report link: `readBrowser`. */
  readBrowser: () => Promise<BrowserInfo>;
  /**
   * Whether the tab the Popup opened over is on the Shorts Feed, as that tab's
   * content script says. False when no content script of Shorts Flow's answers.
   */
  isOnShortsFeed: () => Promise<boolean>;
  /** Firefox's record of the access to youtube.com; absent in the Chrome build. */
  hostAccess?: HostAccess;
  /** The settings list; `POPUP_ROWS` unless a test brings its own. */
  rows?: PopupRow[];
  /** What the status line says after the Shorts Feed; `STATUS_PARTS` unless a test brings its own. */
  statusParts?: StatusPart[];
};

/** Builds the Popup into `document.body` and returns its teardown. */
export function mountPopup(
  document: Document,
  {
    settings,
    session,
    getMessage,
    version,
    whatsNew,
    readBrowser,
    isOnShortsFeed,
    hostAccess,
    rows = POPUP_ROWS,
    statusParts = STATUS_PARTS,
  }: PopupOptions,
): () => void {
  const popup = new AbortController();
  const { signal } = popup;

  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, ...children: (Node | string)[]) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.append(...children);
    return node;
  };

  /** A native checkbox drawn as a switch, so it keeps its keyboard and screen reader behaviour. */
  const switchInput = (className: string, labelledBy: string, describedBy?: string) => {
    const input = element('input', className);
    input.type = 'checkbox';
    input.setAttribute('role', 'switch');
    input.setAttribute('aria-labelledby', labelledBy);
    if (describedBy) input.setAttribute('aria-describedby', describedBy);
    // Disabled until the settings arrive, so nothing shows a guess.
    input.disabled = true;
    return input;
  };

  /** One item of the settings list: label and hint on the left, `control` on the right. */
  const listRow = (tag: 'div' | 'label', id: string, label: string, hint: string | undefined, control: Node) => {
    const labelNode = element('span', 'sf-row-label', label);
    labelNode.id = id;
    const text = element('span', 'sf-row-text', labelNode);
    let hintNode: HTMLSpanElement | undefined;
    if (hint !== undefined) {
      hintNode = element('span', 'sf-row-hint', hint);
      hintNode.id = `${id}-hint`;
      text.append(hintNode);
    }
    return { item: element('li', 'sf-row-item', element(tag, 'sf-row', text, control)), hintNode };
  };

  // Settings, as last read or changed, shared with every row.
  let current: Settings | undefined;
  const listeners = new Set<(settings: Settings) => void>();
  const watchSettings = (listener: (settings: Settings) => void) => {
    listeners.add(listener);
    if (current) listener(current);
  };
  const show = (shown: Settings) => {
    const first = !current;
    current = shown;
    for (const listener of listeners) listener(shown);
    // Switches animate from here on, not into the state they opened in.
    if (first) document.defaultView?.requestAnimationFrame(() => main.classList.add('sf-ready'));
  };

  /** A middle dot between two things on one line. */
  const separator = () => {
    const dot = element('span', 'sf-sep', ' · ');
    dot.setAttribute('aria-hidden', 'true');
    return dot;
  };

  // Auto-Scroll: the one bright thing, on the night card.
  const autoScrollTitle = element('span', 'sf-feature-title', getMessage('popupAutoScroll'));
  autoScrollTitle.id = 'sf-auto-scroll';
  const autoScrollHint = element('span', 'sf-feature-hint');
  autoScrollHint.id = 'sf-auto-scroll-hint';
  const autoScroll = switchInput('sf-switch sf-switch-pearl', autoScrollTitle.id, autoScrollHint.id);
  autoScroll.addEventListener('change', () => void settings.set({ autoScroll: autoScroll.checked }), { signal });
  const feature = element(
    'label',
    'sf-feature',
    drawMark(document, 'line', 'sf-watermark'),
    autoScrollTitle,
    autoScrollHint,
    autoScroll,
  );
  watchSettings(({ autoScroll: on }) => {
    autoScroll.checked = on;
    autoScroll.disabled = false;
    autoScrollHint.textContent = getMessage(on ? 'popupAutoScrollOn' : 'popupAutoScrollOff');
  });

  // The status line: whether the tab the Popup opened over is on the Shorts
  // Feed, then whatever the status parts add. Blank until the tab answers.
  const feedStatus = element('span', 'sf-status-feed');
  const status = element('p', 'sf-status', element('span', 'sf-status-dot'), feedStatus);
  status.setAttribute('role', 'status');
  void isOnShortsFeed().then((onShortsFeed) => {
    if (signal.aborted) return;
    status.dataset.feed = onShortsFeed ? 'on' : 'off';
    feedStatus.textContent = getMessage(onShortsFeed ? 'popupOnShortsFeed' : 'popupOffShortsFeed');
  });

  // The header: the mark, the name, and the version carrying What's new.
  const title = getMessage('popupTitle');
  document.title = title;
  const shortVersion = displayVersion(version);
  const versionChip = element('span', 'sf-version', shortVersion);
  versionChip.setAttribute('role', 'note');
  versionChip.setAttribute('aria-label', getMessage('popupVersion', [shortVersion]));
  const unreadDot = element('span', 'sf-unread');
  unreadDot.setAttribute('role', 'img');
  unreadDot.setAttribute('aria-label', getMessage('popupWhatsNewUnread'));
  const header = element(
    'header',
    'sf-header',
    drawMark(document, 'tile', 'sf-logo'),
    element('h1', 'sf-name', title),
    versionChip,
  );

  // Firefox: a notice while the viewer has turned off access to youtube.com.
  const restore = element('button', 'sf-button', getMessage('popupHostAccessRestore'));
  restore.type = 'button';
  const hostNotice = element(
    'section',
    'sf-notice',
    element('p', 'sf-notice-title', getMessage('popupHostAccessLost')),
    element('p', 'sf-notice-hint', getMessage('popupHostAccessHint')),
    restore,
  );
  hostNotice.setAttribute('role', 'alert');
  // Shown just under the header, and only while the access is off.
  const showHostAccess = (granted: boolean) => {
    if (signal.aborted) return;
    if (granted) hostNotice.remove();
    else if (!hostNotice.isConnected) header.after(hostNotice);
  };
  if (hostAccess) {
    // Straight from the click: the browser asks the viewer only from a click.
    restore.addEventListener('click', () => void hostAccess.request().then(showHostAccess), { signal });
    const unwatchHostAccess = hostAccess.watch(showHostAccess);
    signal.addEventListener('abort', unwatchHostAccess, { once: true });
    void hostAccess.isGranted().then(showHostAccess);
  }

  // The footer: news and help, each on Shorts Flow's own site.
  const whatsNewLink = link(element('a', 'sf-link sf-whats-new', getMessage('popupWhatsNew')), siteUrl('welcome', { v3: true }));
  let whatsNewOpened = false;
  whatsNewLink.addEventListener(
    'click',
    () => {
      whatsNewOpened = true;
      unreadDot.remove();
      void whatsNew.markRead();
    },
    { signal },
  );
  void whatsNew.isUnread().then((unread) => {
    if (unread && !whatsNewOpened && !signal.aborted) versionChip.append(unreadDot);
  });

  const reportLink = link(element('a', 'sf-link', getMessage('popupReportProblem')), siteUrl('report', { version }));
  void readBrowser().then((browser) => {
    reportLink.href = siteUrl('report', { version, ...browser });
  });
  const footer = element(
    'footer',
    'sf-footer',
    whatsNewLink,
    element(
      'span',
      'sf-help',
      reportLink,
      separator(),
      link(element('a', 'sf-link', getMessage('popupSupport')), siteUrl('support', {})),
    ),
  );

  // What every row and status part builds itself with.
  const context: PopupContext = {
    document,
    signal,
    getMessage,
    settings: () => current,
    watchSettings,
    changeSettings: (changes) => void settings.set(changes),
    session,
    row: ({ id, label, hint, control }) => listRow('div', id, label, hint, control).item,
    switchRow({ setting, label, hint }) {
      const id = `sf-setting-${setting}`;
      const input = switchInput('sf-switch', id, hint && `${id}-hint`);
      input.addEventListener('change', () => context.changeSettings({ [setting]: input.checked }), { signal });
      // The whole row is the switch's label, so a click anywhere on it switches.
      const { item, hintNode } = listRow('label', id, label, hint && '', input);
      watchSettings((shown) => {
        input.checked = shown[setting];
        input.disabled = false;
        if (hint && hintNode) hintNode.textContent = hint(shown);
      });
      return item;
    },
  };

  for (const part of statusParts) status.append(separator(), part(context));

  const list = element('ul', 'sf-list', ...rows.map((row) => row(context)));
  list.setAttribute('aria-label', getMessage('popupSettings'));

  const main = element(
    'main',
    'sf-popup',
    header,
    feature,
    status,
    ...(rows.length ? [list] : []),
    footer,
  );
  document.body.append(main);

  let changedSinceRead = false;
  const unwatch = settings.watch((changed) => {
    changedSinceRead = true;
    show(changed);
  });
  void settings.get().then((read) => {
    if (!changedSinceRead && !signal.aborted) show(read);
  });

  return () => {
    popup.abort();
    listeners.clear();
    unwatch();
    main.remove();
  };
}

/** The version as the chip shows it: 3.0.0 as 3.0, 3.1.2 as it is. */
function displayVersion(version: string): string {
  return version.replace(/^(\d+\.\d+)\.0$/, '$1');
}

/** Makes `anchor` open `href` in a new tab, as every link in the Popup does. */
function link(anchor: HTMLAnchorElement, href: string): HTMLAnchorElement {
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}
