// Shared defaults, versioned settings storage (chrome.storage.sync) and IndexedDB helpers.
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
  widgets: { weather: true, todo: false, notes: false, pomodoro: false, quote: false, calendar: false, worldclock: false },
  zones: ["America/New_York", "Europe/London", "Asia/Tokyo"],
  // Global widget look; each widget may override it in widgetLayout[id].style
  widgetStyle: { bg: 25, tint: "dark", blur: 16, opacity: 100, font: "system", size: 100, color: "#ffffff", radius: 18, border: true },
  widgetLayout: {}, // { [widgetId]: { rect: { x, y, w, h, z } (% of viewport), style: {...} } }
  weatherCity: "", // empty = detect current location
  tempUnit: "celsius",
  todos: [],
  notes: ""
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
