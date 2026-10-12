// Shared defaults, versioned settings storage (chrome.storage.sync) and IndexedDB helpers.
// Loaded after apps.js (DEFAULT_DOCK) on every page and in the background service worker.
// Bump SCHEMA_VERSION and add a MIGRATIONS entry whenever the settings shape changes.
const SCHEMA_VERSION = 2;
const DEFAULTS = {
  version: SCHEMA_VERSION,
  groups: [{
    name: "Favorites",
    links: [
      { title: "GitHub", url: "https://github.com", icon: "" },
      { title: "Gmail", url: "https://mail.google.com", icon: "" },
      { title: "YouTube", url: "https://youtube.com", icon: "" }
    ]
  }],
  engine: "google",
  clock24: false,
  shortcuts: true,
  wpMode: "live", // daily | live | url | file (image or video) | gradient
  wpUrl: "",
  wpFileAt: 0, // bumped on each upload so open tabs reload the file
  liveScene: "webcity", // key of LIVE_SCENES in live.js
  liveQuality: "medium", // low | medium | high
  gradient: "linear-gradient(135deg, #1e3c72, #2a5298)",
  dim: 30,
  blur: 0,
  layout: "centered", // centered | sidebar | minimal
  accent: "#e23636",
  cardSize: "m", // s | m | l
  cardStyle: "glass", // glass | solid | outline
  animations: true,
  userName: "",
  widgets: { weather: true, todo: false, notes: false, pomodoro: false, quote: false, calendar: false, worldclock: false,
             rss: false, countdown: false, habits: false, crypto: false, github: false },
  zones: ["America/New_York", "Europe/London", "Asia/Tokyo"],
  // Global widget look; each widget may override it in widgetLayout[id].style
  widgetStyle: { bg: 25, tint: "dark", blur: 16, opacity: 100, font: "system", size: 100, color: "#ffffff", radius: 18, border: true },
  widgetLayout: {}, // { [widgetId]: { rect: { x, y, w, h, z } (% of viewport), style: {...} } }
  weatherCity: "", // empty = detect current location
  tempUnit: "celsius",
  todos: [],
  notes: "",
  onboarded: false, // false shows the welcome screen once
  dock: DEFAULT_DOCK,
  dockLocked: true, // locked docks can't be edited until unlocked in settings
  dockVisible: true,
  aiTools: true, // AI Tools launcher in the bottom-left corner
  smooth: true, // drop glass blur over animated wallpapers (blur is re-rendered every frame)
  suggest: false, // search suggestions (asks for permission to the suggestion host)
  showFocus: true,
  focus: { text: "", date: "", done: false }, // "today's main focus"
  pomoWork: 25, // minutes
  pomoBreak: 5,
  blockDuringFocus: false,
  blockSites: [], // hostnames blocked while a focus session runs
  rssUrl: "",
  countdowns: [], // [{ name, date: "YYYY-MM-DD" }]
  habits: [], // [{ name, days: { "YYYY-MM-DD": true } }]
  cryptoCoins: ["bitcoin", "ethereum"],
  cryptoCurrency: "usd",
  githubUser: "",
  profiles: [], // [{ name, days: [0-6], from: "HH:MM", to: "HH:MM", data: {...PROFILE_KEYS} }]
  activeProfile: "", // "" = the main setup
  profileAuto: true // switch by schedule
};
const ENGINES = {
  google: "https://www.google.com/search?q=",
  duckduckgo: "https://duckduckgo.com/?q=",
  bing: "https://www.bing.com/search?q=",
  brave: "https://search.brave.com/search?q=",
  ecosia: "https://www.ecosia.org/search?q="
};

// Each migration upgrades settings from version N to N+1
const MIGRATIONS = {
  1: (s) => { s.groups = [{ name: "Favorites", links: s.links || [] }]; delete s.links; return s; }
};
function migrate(s) {
  let v = s.version || 1;
  while (v < SCHEMA_VERSION) { s = MIGRATIONS[v](s); s.version = ++v; }
  return s;
}
function normalize(raw) {
  const s = { ...structuredClone(DEFAULTS), ...migrate(raw) };
  s.widgets = { ...DEFAULTS.widgets, ...raw.widgets };
  s.widgetStyle = { ...DEFAULTS.widgetStyle, ...raw.widgetStyle };
  s.focus = { ...DEFAULTS.focus, ...raw.focus };
  return s;
}

// Settings are stored as one JSON string split into chunks, because chrome.storage.sync
// limits each item to 8KB. If sync fails (quota/offline), we fall back to local storage.
const CHUNK = 3500;
const LEGACY_KEYS = ["links", "engine", "clock24", "wpMode", "wpUrl", "gradient", "dim", "blur"];

async function readRaw() {
  const local = await chrome.storage.local.get(["cfg", ...LEGACY_KEYS]);
  if (local.cfg) return local.cfg;
  const sync = await chrome.storage.sync.get(null).catch(() => ({}));
  if (sync.cfg_count) {
    let str = "";
    for (let i = 0; i < sync.cfg_count; i++) str += sync["cfg_" + i];
    return JSON.parse(str);
  }
  const legacy = {};
  for (const k of LEGACY_KEYS) if (k in local) legacy[k] = local[k];
  return Object.keys(legacy).length ? legacy : null;
}

async function getSettings() {
  const raw = await readRaw();
  if (!raw) return structuredClone(DEFAULTS);
  const outdated = (raw.version || 1) !== SCHEMA_VERSION;
  const s = normalize(raw);
  if (outdated) {
    await saveSettings(s);
    await chrome.storage.local.remove(LEGACY_KEYS);
  }
  return s;
}

// Returns "sync" or "local" depending on where the settings ended up
async function saveSettings(s) {
  const str = JSON.stringify(s);
  const items = { cfg_count: Math.ceil(str.length / CHUNK) };
  for (let i = 0; i < items.cfg_count; i++) items["cfg_" + i] = str.slice(i * CHUNK, (i + 1) * CHUNK);
  try {
    const old = (await chrome.storage.sync.get("cfg_count")).cfg_count || 0;
    await chrome.storage.sync.set(items);
    const stale = [];
    for (let i = items.cfg_count; i < old; i++) stale.push("cfg_" + i);
    if (stale.length) await chrome.storage.sync.remove(stale);
    await chrome.storage.local.remove("cfg");
    return "sync";
  } catch (err) {
    console.warn("Sync save failed, saving locally:", err);
    await chrome.storage.local.set({ cfg: s });
    return "local";
  }
}

function onSettingsChanged(cb) {
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if ((area === "sync" && changes.cfg_count) || (area === "local" && changes.cfg)) cb(await getSettings());
  });
}

const getJSON = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); };

// Local calendar date as YYYY-MM-DD
const isoDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Optional permissions are requested on demand (must run inside a click handler)
const hasOrigins = (origins) => chrome.permissions.contains({ origins });
const requestOrigins = (origins) => chrome.permissions.request({ origins });

// ---- Themes: presets and shareable codes ----
const THEME_KEYS = ["wpMode", "liveScene", "liveQuality", "gradient", "dim", "blur", "layout", "accent", "cardSize", "cardStyle", "animations", "widgetStyle"];
const THEME_PRESETS = {
  "Spider Night": { wpMode: "live", liveScene: "webcity", accent: "#e23636", layout: "centered", cardStyle: "glass", dim: 10 },
  "Neon Drive": { wpMode: "live", liveScene: "synthwave", accent: "#ff4fb0", layout: "centered", cardStyle: "solid", dim: 5 },
  "Northern Calm": { wpMode: "live", liveScene: "aurora", accent: "#34d399", layout: "sidebar", cardStyle: "glass", dim: 0 },
  "Deep Space": { wpMode: "live", liveScene: "galaxy", accent: "#7aa2ff", layout: "minimal", cardStyle: "outline", dim: 10 },
  "Festival": { wpMode: "live", liveScene: "festival", accent: "#ffb020", layout: "centered", cardStyle: "glass", dim: 5 },
  "Snow Day": { wpMode: "live", liveScene: "snow", accent: "#9ad8ff", layout: "centered", cardStyle: "glass", dim: 5 },
  "Monsoon": { wpMode: "live", liveScene: "rain", accent: "#5eead4", layout: "sidebar", cardStyle: "glass", dim: 10 },
  "Daily Photo": { wpMode: "daily", accent: "#facc15", layout: "centered", cardStyle: "glass", dim: 25 }
};
const encodeTheme = (s) => "CTAB1:" + btoa(unescape(encodeURIComponent(JSON.stringify(Object.fromEntries(THEME_KEYS.map((k) => [k, s[k]]))))));
function decodeTheme(code) {
  const m = /^CTAB1:([A-Za-z0-9+/=]+)$/.exec(code.trim());
  if (!m) throw new Error("not a theme code");
  const t = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
  if (t.wpMode === "file" || t.wpMode === "url") t.wpMode = "live"; // uploads aren't shareable
  return Object.fromEntries(THEME_KEYS.filter((k) => k in t).map((k) => [k, t[k]]));
}

// ---- Focus blocking: site list helpers ----
const siteOrigins = (hosts) => hosts.flatMap((h) => [`*://${h}/*`, `*://*.${h}/*`]);
const parseSites = (text) => [...new Set(text.split(/[\s,]+/).map((h) => h.trim().toLowerCase()
  .replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "")).filter((h) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h)))];


// ---- Pomodoro: state lives in chrome.storage.local so every tab and the background agree ----
const pomoLength = (s, mode) => (mode === "work" ? s.pomoWork : s.pomoBreak) * 60e3;

// Ends the session that was due at `endsAt` exactly once, whoever notices first (a tab or the
// background alarm), logging finished focus sessions per day for the stats line
async function finishPomo(s, endsAt) {
  const { pomo, focusLog = {} } = await chrome.storage.local.get(["pomo", "focusLog"]);
  if (!pomo || pomo.endsAt !== endsAt) return;
  if (pomo.mode === "work") {
    const day = (focusLog[isoDate()] ??= { sessions: 0, minutes: 0 });
    day.sessions++;
    day.minutes += Math.round(pomoLength(s, "work") / 60e3);
    for (const k of Object.keys(focusLog).sort().slice(0, -60)) delete focusLog[k]; // keep ~2 months
  }
  const next = pomo.mode === "work" ? "break" : "work";
  await chrome.storage.local.set({ focusLog, pomo: { mode: next, endsAt: null, remaining: pomoLength(s, next) } });
}

// ---- Import links from the browser (bookmarks bar / most visited) ----
async function importBrowserLinks(kind) {
  const perm = kind === "bookmarks" ? "bookmarks" : "topSites";
  if (!(await chrome.permissions.request({ permissions: [perm] }))) throw new Error("permission denied");
  const link = (title, url) => ({ title: (title || new URL(url).hostname).slice(0, 40), url, icon: "" });
  if (kind === "topSites") {
    const sites = await chrome.topSites.get();
    return [{ name: "Most visited", links: sites.slice(0, 12).map((t) => link(t.title, t.url)) }];
  }
  const [root] = await chrome.bookmarks.getTree();
  const bar = root.children[0]; // the bookmarks bar
  const loose = bar.children.filter((n) => n.url && /^https?:/.test(n.url));
  const groups = loose.length ? [{ name: "Bookmarks bar", links: loose.slice(0, 30).map((n) => link(n.title, n.url)) }] : [];
  for (const folder of bar.children.filter((n) => n.children)) {
    const links = folder.children.filter((n) => n.url && /^https?:/.test(n.url)).slice(0, 30).map((n) => link(n.title, n.url));
    if (links.length) groups.push({ name: folder.title || "Folder", links });
  }
  return groups;
}

const faviconFor = (url) => `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(url)}`;
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
function linkIcon(l, cls) {
  if (l.icon && !/^(https?:|data:)/.test(l.icon)) return el("div", cls + " emoji", l.icon);
  const i = el("img", cls);
  i.src = l.icon || faviconFor(l.url); i.alt = "";
  return i;
}

function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("ctab", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("files");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = fn(open.result.transaction("files", mode).objectStore("files"));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    };
  });
}
// Plays an uploaded video wallpaper (muted, looping) behind everything else in `host`
function showVideo(host, blob) {
  const v = el("video", "live-canvas");
  Object.assign(v, { muted: true, loop: true, autoplay: true, playsInline: true, src: URL.createObjectURL(blob) });
  v.style.objectFit = "cover";
  host.prepend(v);
  return v;
}

const putWallpaperFile = (blob) => idb("readwrite", (s) => s.put(blob, "wallpaper"));
const getWallpaperFile = () => idb("readonly", (s) => s.get("wallpaper"));
