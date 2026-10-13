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
  dailySource: "bing", // bing | apod | wikimedia | picsum (see DAILY_SOURCES)
  nasaKey: "", // optional personal key for NASA APOD (DEMO_KEY is shared and rate-limited)
  unsplashKey: "", // the user's own free Unsplash Access Key (required for the Unsplash source)
  unsplashTopic: "nature", // nature | space | any search words
  sceneSchedule: { on: false, morning: "ocean", day: "clouds", evening: "synthwave", night: "webcity" },
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
  s.sceneSchedule = { ...DEFAULTS.sceneSchedule, ...raw.sceneSchedule };
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

// ---- Daily photo wallpapers: free sources, cached once per local day ----
// Each loader returns up to 8 recent pictures, newest first: { url, title, link } (link = credit/source page)
const DAILY_SOURCES = {
  bing: {
    name: "Bing photo of the day",
    async load() {
      const json = await getJSON("https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=en-US");
      return json.images.map((i) => ({ url: `https://www.bing.com${i.urlbase}_UHD.jpg`, title: i.copyright || "", link: i.copyrightlink || "https://www.bing.com" }));
    }
  },
  apod: {
    name: "NASA Astronomy Picture of the Day",
    async load(s) {
      const start = isoDate(new Date(Date.now() - 9 * 864e5));
      const days = await getJSON(`https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(s.nasaKey || "DEMO_KEY")}&start_date=${start}`);
      // only real APOD pictures (the API sometimes returns a generic NASA placeholder instead)
      return days.filter((d) => d.media_type === "image" && /apod\.nasa\.gov\/apod\/image\//.test(d.hdurl || d.url)).reverse().slice(0, 8).map((d) => ({
        url: d.hdurl || d.url, title: `${d.title}${d.copyright ? " — © " + d.copyright.trim() : ""}`,
        link: `https://apod.nasa.gov/apod/ap${d.date.slice(2).replace(/-/g, "")}.html`
      }));
    }
  },
  wikimedia: {
    name: "Wikimedia Commons picture of the day",
    async load() {
      const days = await Promise.allSettled(Array.from({ length: 4 }, (_, i) => {
        const d = isoDate(new Date(Date.now() - i * 864e5)).replace(/-/g, "/");
        return getJSON(`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${d}`);
      }));
      return days.filter((r) => r.status === "fulfilled" && r.value.image).map(({ value: { image } }) => ({
        url: wikiPhotoUrl(image),
        title: `${(image.description?.text || image.title || "").replace(/<[^>]+>/g, "").slice(0, 140)}${image.artist?.text ? " — " + image.artist.text.replace(/<[^>]+>/g, "") : ""}`,
        link: image.file_page || "https://commons.wikimedia.org/wiki/Commons:Picture_of_the_day"
      }));
    }
  },
  unsplash: {
    name: "Unsplash",
    variant: (s) => `${s.unsplashTopic}|${s.unsplashKey ? "key" : "nokey"}`, // new topic or newly added key → refetch today
    async load(s) {
      if (!s.unsplashKey) throw new Error("add your free Unsplash Access Key in settings");
      const q = new URLSearchParams({ query: s.unsplashTopic || "nature", count: 8, orientation: "landscape", content_filter: "high", client_id: s.unsplashKey });
      const photos = await getJSON(`https://api.unsplash.com/photos/random?${q}`);
      const ref = "utm_source=customizable_tab&utm_medium=referral"; // Unsplash attribution requirement
      return photos.map((p) => ({
        url: `${p.urls.raw}&w=2560&q=80&fm=jpg&fit=crop`,
        title: p.alt_description || p.description || "",
        link: `${p.links.html}?${ref}`,
        author: p.user.name, authorLink: `${p.user.links.html}?${ref}`, siteName: "Unsplash", siteLink: `https://unsplash.com/?${ref}`,
        ping: p.links.download_location // must be called when the photo is shown (Unsplash API guideline)
      }));
    }
  },
  picsum: {
    name: "Lorem Picsum (Unsplash photos)",
    async load() {
      const today = isoDate(), w = 2560, h = 1440;
      return Array.from({ length: 8 }, (_, i) => ({ url: `https://picsum.photos/seed/ctab-${today}-${i}/${w}/${h}`, title: "Photo via Lorem Picsum / Unsplash", link: "https://picsum.photos" }));
    }
  }
};

// Commons originals can be 20MB+, so use a resized copy. Wikimedia only renders standard thumbnail
// widths (2560 is refused), so pick 3840 or 1920 by rewriting the width in the feed's thumbnail URL.
function wikiPhotoUrl(image) {
  const w = image.image?.width || 0, size = w > 3840 ? 3840 : w > 1920 ? 1920 : 0;
  const thumb = image.thumbnail?.source;
  if (size && thumb && /\/\d+px-/.test(thumb)) return thumb.replace(/\/\d+px-/, `/${size}px-`);
  return image.image?.source || thumb;
}

// Today's list for the chosen source, fetched at most once per local day (also prefetched at midnight
// by the background worker). If the source is down or has nothing usable, the next source is tried;
// offline, the last good list is kept.
async function dailyList(s) {
  const source = DAILY_SOURCES[s.dailySource] ? s.dailySource : "bing";
  const key = `${isoDate()}|${source}|${DAILY_SOURCES[source].variant?.(s) || ""}`;
  const data = await chrome.storage.local.get(["dailyKey", "wallpaperList"]);
  if (data.dailyKey === key && data.wallpaperList?.length) return data.wallpaperList;
  for (const name of [source, ...["bing", "wikimedia", "picsum"].filter((n) => n !== source)]) {
    try {
      const list = (await DAILY_SOURCES[name].load(s)).filter((p) => /^https:/.test(p.url));
      if (!list.length) throw new Error("no usable pictures today");
      if (name !== source) list.forEach((p) => (p.title = `[${DAILY_SOURCES[source].name} unavailable today] ${p.title}`));
      await chrome.storage.local.set({ dailyKey: key, wallpaperList: list, wallpaperIdx: 0, wallpaperUrl: list[0].url });
      return list;
    } catch (err) {
      console.warn(`Daily wallpaper (${name}) failed:`, err);
    }
  }
  return data.wallpaperList || [];
}

// ---- Scene by time of day ----
const DAY_SLOTS = [["night", 0, 5], ["morning", 5, 11], ["day", 11, 17], ["evening", 17, 21], ["night", 21, 24]];
const daySlot = (d = new Date()) => DAY_SLOTS.find(([, from, to]) => d.getHours() >= from && d.getHours() < to)[0];
// The live scene to show now: the schedule's pick for this part of the day, or the chosen scene
const currentScene = (s) => (s.sceneSchedule?.on ? s.sceneSchedule[daySlot()] : s.liveScene) || s.liveScene;

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
