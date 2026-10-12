const $ = (id) => document.getElementById(id);
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let S, flat = [];
const persist = () => saveSettings(S);
// Apply a settings change made on this page and re-render everything it affects
const set = (patch) => { Object.assign(S, patch); persist(); renderAll(); if (!$("drawer").hidden) renderDrawer(); };

function tick() {
  const now = new Date();
  $("clock").textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: !S.clock24 });
  $("date").textContent = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const hr = now.getHours();
  const part = hr < 5 ? "night" : hr < 12 ? "morning" : hr < 17 ? "afternoon" : hr < 22 ? "evening" : "night";
  $("greeting").textContent = S.userName ? `Good ${part}, ${S.userName}` : "";
  if (S.widgets.pomodoro) updatePomo();
  if (S.widgets.worldclock) updateZones();
}

// ---- Appearance ----
function applyTheme() {
  const b = document.body;
  b.classList.remove(...[...b.classList].filter((c) => /^(layout|size|style)-/.test(c)));
  b.classList.add(`layout-${S.layout}`, `size-${S.cardSize}`, `style-${S.cardStyle}`);
  b.classList.toggle("anim", S.animations && !reducedMotion.matches);
  b.style.setProperty("--accent", /^#[0-9a-f]{6}$/i.test(S.accent) ? S.accent : DEFAULTS.accent);
}

// ---- Links ----
function renderLinks() {
  flat = [];
  const named = S.groups.length > 1;
  $("grid").replaceChildren(...S.groups.filter((g) => g.links.length).map((g) => {
    const sec = el("section", "group");
    if (named) sec.append(el("h3", "", g.name));
    const cards = el("div", "cards");
    for (const l of g.links) {
      const n = flat.push({ ...l, group: g.name });
      const a = el("a", "card");
      a.href = l.url; a.title = l.title + "\n" + l.url;
      a.style.setProperty("--i", n);
      a.append(linkIcon(l, "ico"), el("span", "", l.title));
      if (S.shortcuts && n <= 9) a.append(el("kbd", "", n));
      cards.append(a);
    }
    sec.append(cards);
    return sec;
  }));
}

// 3D tilt + glare that follows the pointer
$("grid").addEventListener("pointermove", (e) => {
  const c = e.target.closest(".card");
  if (!c || !document.body.classList.contains("anim") || S.layout === "minimal") return;
  const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  c.style.setProperty("--rx", `${(0.5 - y) * 18}deg`);
  c.style.setProperty("--ry", `${(x - 0.5) * 18}deg`);
  c.style.setProperty("--gx", `${x * 100}%`);
  c.style.setProperty("--gy", `${y * 100}%`);
});
$("grid").addEventListener("pointerout", (e) => {
  const c = e.target.closest(".card");
  if (c && !c.contains(e.relatedTarget)) for (const p of ["--rx", "--ry"]) c.style.removeProperty(p);
});

// ---- Keyboard ----
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); togglePalette(); return; }
  if (e.key === "Escape") {
    if (!$("palette").hidden) closePalette();
    else if (!$("wpanel").hidden) closeWidgetPanel();
    else if (isEditing()) toggleEdit(false);
    else if (!$("drawer").hidden) toggleDrawer(false);
    else if (document.body.classList.contains("zen")) toggleZen();
    return;
  }
  if (e.target.matches("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "/") { e.preventDefault(); $("q").focus(); return; }
  if (!S.shortcuts) return;
  if (/^[1-9]$/.test(e.key) && flat[e.key - 1]) location.href = flat[e.key - 1].url;
  else if (e.key === "z") toggleZen();
  else if (e.key === "w") nextWallpaper();
  else if (e.key === "c") toggleDrawer();
  else if (e.key === "e") toggleEdit();
});

const toggleZen = () => document.body.classList.toggle("zen");

// ---- Wallpaper ----
// Fetch Bing's last 8 daily images once per local calendar day; cache them in storage
async function dailyList() {
  const today = localDate();
  const data = await chrome.storage.local.get(["wallpaperDate", "wallpaperList", "wallpaperUrl"]);
  if (data.wallpaperDate === today && data.wallpaperList?.length) return data.wallpaperList;
  try {
    const res = await fetch("https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=en-US");
    const json = await res.json();
    const list = json.images.map((i) => ({ url: `https://www.bing.com${i.urlbase}_UHD.jpg`, title: i.copyright || "", link: i.copyrightlink || "" }));
    await chrome.storage.local.set({ wallpaperDate: today, wallpaperList: list, wallpaperIdx: 0, wallpaperUrl: list[0].url });
    return list;
  } catch (err) {
    console.error("Failed to fetch daily wallpaper:", err);
    return data.wallpaperList || (data.wallpaperUrl ? [{ url: data.wallpaperUrl, title: "" }] : []);
  }
}

async function dailyWallpaper() {
  const list = await dailyList();
  const { wallpaperIdx: i = 0 } = await chrome.storage.local.get("wallpaperIdx");
  return list[i % list.length] || null;
}

let bgKey = "";
const removeVideo = () => $("live").querySelector("video")?.remove();

async function applyWallpaper() {
  const bg = $("bg"), blur = S.blur ? `blur(${S.blur}px)` : "";
  bg.style.filter = $("live").style.filter = blur;
  $("dim").style.opacity = S.dim / 100;
  $("nextWp").hidden = !["daily", "live"].includes(S.wpMode);
  $("credit").textContent = "";

  if (S.wpMode === "live") {
    bgKey = "";
    removeVideo();
    bg.classList.remove("show");
    Live.start($("live"), S.liveScene, { accent: S.accent, quality: S.liveQuality, animate: S.animations && !reducedMotion.matches });
    return;
  }
  Live.stop();

  let url = null, credit = null;
  if (S.wpMode === "daily") { credit = await dailyWallpaper(); url = credit?.url; }
  else if (S.wpMode === "url") url = S.wpUrl;
  else if (S.wpMode === "file") {
    const f = await getWallpaperFile().catch(() => null);
    if (f?.type.startsWith("video/")) {
      const key = "video:" + S.wpFileAt;
      if (key !== bgKey) { bgKey = key; removeVideo(); bg.classList.remove("show"); showVideo($("live"), f); }
      return;
    }
    if (f) url = URL.createObjectURL(f);
  }
  if (credit?.title) { $("credit").textContent = "📷 " + credit.title; $("credit").href = credit.link || "#"; }

  const key = url ? (S.wpMode === "file" ? "file:" + S.wpFileAt : url) : S.gradient;
  if (key === bgKey) return;
  bgKey = key;
  removeVideo();
  bg.classList.remove("show");
  if (url) await new Promise((res) => { const i = new Image(); i.onload = i.onerror = res; i.src = url; });
  if (key !== bgKey) return; // a newer wallpaper was requested while this one loaded
  bg.style.backgroundImage = url ? `url("${url}")` : S.gradient;
  bg.classList.toggle("photo", !!url);
  requestAnimationFrame(() => bg.classList.add("show"));
}

async function nextWallpaper() {
  if (S.wpMode === "live") {
    const names = Object.keys(LIVE_SCENES);
    set({ liveScene: names[(names.indexOf(S.liveScene) + 1) % names.length] });
  } else if (S.wpMode === "daily") {
    const list = await dailyList();
    if (!list.length) return;
    const { wallpaperIdx: i = 0 } = await chrome.storage.local.get("wallpaperIdx");
    const j = (i + 1) % list.length;
    await chrome.storage.local.set({ wallpaperIdx: j, wallpaperUrl: list[j].url });
    applyWallpaper();
  }
}

// Mouse parallax for photo wallpapers
addEventListener("pointermove", (e) => {
  if (!document.body.classList.contains("anim") || S.wpMode === "live") return;
  $("bg").style.setProperty("--px", `${(e.clientX / innerWidth - 0.5) * -24}px`);
  $("bg").style.setProperty("--py", `${(e.clientY / innerHeight - 0.5) * -24}px`);
});

// Rotate wallpaper at midnight for tabs left open overnight
function scheduleMidnight() {
  const n = new Date(), next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 5);
  setTimeout(() => { applyWallpaper(); scheduleMidnight(); }, next - n);
}

// ---- Search ----
function goSearch(q) {
  const hasScheme = /^https?:\/\//i.test(q);
  const isUrl = hasScheme || /^[^\s/]+\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(q) || /^localhost(:\d+)?(\/\S*)?$/i.test(q);
  location.href = isUrl ? (hasScheme ? q : (q.startsWith("localhost") ? "http://" : "https://") + q)
                        : ENGINES[$("engine").value] + encodeURIComponent(q);
}
function setupSearch() {
  const sel = $("engine");
  for (const k in ENGINES) sel.add(new Option(k[0].toUpperCase() + k.slice(1), k));
  sel.value = S.engine;
  $("search").onsubmit = (e) => {
    e.preventDefault();
    const q = $("q").value.trim();
    if (q) goSearch(q);
  };
}

// ---- Weather (Open-Meteo, no API key; cached for 30 minutes) ----
// With no city set, the location comes from the browser (geolocation permission), falling back to IP lookup.
const wxIcon = (c) => c === 0 ? "☀️" : c <= 3 ? "⛅" : c <= 48 ? "🌫️" : c <= 67 ? "🌧️" : c <= 77 ? "🌨️" : c <= 82 ? "🌦️" : c <= 86 ? "🌨️" : "⛈️";
const getJSON = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); };

async function locate() {
  try {
    const { latitude, longitude } = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(
      (p) => res(p.coords), rej, { timeout: 8000, maximumAge: 30 * 60e3 }));
    const r = await getJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`).catch(() => ({}));
    return { latitude, longitude, name: r.city || r.locality || r.principalSubdivision || "Current location" };
  } catch (err) {
    console.warn("Geolocation unavailable, using IP location:", err.message || err);
    const r = await getJSON("https://ipapi.co/json/");
    return { latitude: r.latitude, longitude: r.longitude, name: r.city || "Current location" };
  }
}

async function cityLocation(city) {
  const geo = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city.split(",")[0].trim())}`);
  const p = geo.results?.[0];
  if (!p) throw new Error(`City "${city}" not found`);
  return p;
}

async function renderWeather() {
  const w = $("weather");
  if (!S.widgets.weather) { w.textContent = ""; return; }
  const key = `${S.weatherCity || "auto"}|${S.tempUnit}`;
  let { weatherCache: c } = await chrome.storage.local.get("weatherCache");
  if (!c || c.key !== key || Date.now() - c.at > 30 * 60e3) {
    try {
      const p = S.weatherCity ? await cityLocation(S.weatherCity) : await locate();
      const f = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto&temperature_unit=${S.tempUnit}`);
      c = { key, at: Date.now(), name: p.name, temp: Math.round(f.current.temperature_2m), code: f.current.weather_code,
            hi: Math.round(f.daily.temperature_2m_max[0]), lo: Math.round(f.daily.temperature_2m_min[0]) };
      await chrome.storage.local.set({ weatherCache: c });
    } catch (err) {
      console.error("Weather failed:", err);
      if (!c || c.key !== key) { w.textContent = ""; return; }
    }
  }
  const u = S.tempUnit === "celsius" ? "C" : "F";
  w.textContent = `${wxIcon(c.code)} ${c.temp}°${u} · ${c.name}`;
  w.title = c.hi != null ? `Today: high ${c.hi}°${u}, low ${c.lo}°${u}` : "";
}

// ---- Widgets ----
const widgetBox = (title, cls = "", action) => {
  const w = el("div", "widget " + cls), h = el("h4", "", title);
  if (action) h.append(action);
  w.append(h);
  return w;
};
const iconBtn = (text, title, onClick) => { const b = el("button", "", text); b.title = title; b.onclick = onClick; return b; };

function todoWidget() {
  const w = widgetBox("To-do");
  const list = el("ul", "todos");
  S.todos.forEach((t, i) => {
    const li = el("li", t.done ? "done" : "");
    const cb = el("input");
    cb.type = "checkbox"; cb.checked = t.done;
    cb.onchange = () => { t.done = cb.checked; persist(); renderWidgets(); };
    const x = el("button", "", "✕");
    x.onclick = () => { S.todos.splice(i, 1); persist(); renderWidgets(); };
    li.append(cb, el("span", "", t.text), x);
    list.append(li);
  });
  const add = el("input");
  add.id = "todoAdd"; add.placeholder = "Add a task and press Enter";
  add.onkeydown = (e) => {
    if (e.key !== "Enter" || !add.value.trim()) return;
    S.todos.push({ text: add.value.trim(), done: false });
    persist(); renderWidgets(); $("todoAdd").focus();
  };
  w.append(list, add);
  return w;
}

function notesWidget() {
  const w = widgetBox("Notes");
  const ta = el("textarea");
  ta.id = "notes"; ta.value = S.notes; ta.placeholder = "Quick notes…";
  let t;
  ta.oninput = () => { clearTimeout(t); t = setTimeout(() => { S.notes = ta.value; persist(); }, 800); };
  w.append(ta);
  return w;
}

// Pomodoro state lives in local storage so it's shared by all open tabs
const POMO = { work: 25 * 60e3, break: 5 * 60e3 };
let pomo = { mode: "work", endsAt: null, remaining: POMO.work };
const pomoLeft = () => (pomo.endsAt ? Math.max(0, pomo.endsAt - Date.now()) : pomo.remaining);
const setPomo = (p) => { pomo = p; chrome.storage.local.set({ pomo }); updatePomo(); };

function pomoWidget() {
  const w = widgetBox("Pomodoro", "pomo");
  const row = el("div", "row");
  const start = el("button", "", "Start");
  start.id = "pomoBtn";
  start.onclick = () => setPomo(pomo.endsAt
    ? { ...pomo, endsAt: null, remaining: pomoLeft() }
    : { ...pomo, endsAt: Date.now() + pomo.remaining });
  const reset = el("button", "", "Reset");
  reset.onclick = () => setPomo({ mode: "work", endsAt: null, remaining: POMO.work });
  row.append(start, reset);
  const time = el("div", "pomo-time"); time.id = "pomoTime";
  const label = el("div", "pomo-label"); label.id = "pomoLabel";
  const bar = el("div", "pomo-bar"), fill = el("i");
  fill.id = "pomoBar"; bar.append(fill);
  w.append(time, label, bar, row);
  return w;
}

function updatePomo() {
  if (!$("pomoTime")) return;
  const left = pomoLeft();
  if (pomo.endsAt && left === 0) {
    const next = pomo.mode === "work" ? "break" : "work";
    document.title = next === "break" ? "⏰ Break time!" : "⏰ Back to work!";
    setPomo({ mode: next, endsAt: null, remaining: POMO[next] });
    return;
  }
  const s = Math.ceil(left / 1000);
  $("pomoTime").textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  $("pomoLabel").textContent = pomo.mode === "work" ? "Focus" : "Break";
  $("pomoBtn").textContent = pomo.endsAt ? "Pause" : "Start";
  $("pomoBar").style.width = `${(1 - left / POMO[pomo.mode]) * 100}%`;
}

const QUOTES = [
  ["The best way out is always through.", "Robert Frost"],
  ["Well done is better than well said.", "Benjamin Franklin"],
  ["Programs must be written for people to read, and only incidentally for machines to execute.", "Harold Abelson"],
  ["Simple things should be simple, complex things should be possible.", "Alan Kay"],
  ["Premature optimization is the root of all evil.", "Donald Knuth"],
  ["Make it work, make it right, make it fast.", "Kent Beck"],
  ["Talk is cheap. Show me the code.", "Linus Torvalds"],
  ["We are what we repeatedly do. Excellence, then, is not an act, but a habit.", "Will Durant"],
  ["Stay hungry. Stay foolish.", "Stewart Brand"],
  ["Any sufficiently advanced technology is indistinguishable from magic.", "Arthur C. Clarke"],
  ["The only way to do great work is to love what you do.", "Steve Jobs"],
  ["Imagination is more important than knowledge.", "Albert Einstein"],
  ["The future is already here — it's just not very evenly distributed.", "William Gibson"],
  ["You miss 100% of the shots you don't take.", "Wayne Gretzky"],
  ["Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.", "Antoine de Saint-Exupéry"],
  ["Do. Or do not. There is no try.", "Yoda"],
  ["First, solve the problem. Then, write the code.", "John Johnson"],
  ["It always seems impossible until it's done.", "Nelson Mandela"]
];
let quoteIdx = Math.floor(Date.now() / 864e5) % QUOTES.length; // changes once a day

function quoteWidget() {
  const w = widgetBox("Quote", "quote", iconBtn("↻", "Another quote", () => {
    quoteIdx = (quoteIdx + 1 + Math.floor(Math.random() * (QUOTES.length - 1))) % QUOTES.length;
    renderWidgets();
  }));
  const [text, who] = QUOTES[quoteIdx];
  w.append(el("blockquote", "", `“${text}”`), el("cite", "", "— " + who));
  return w;
}

let calOffset = 0; // months from the current one
function calendarWidget() {
  const now = new Date(), first = new Date(now.getFullYear(), now.getMonth() + calOffset, 1);
  const title = first.toLocaleDateString([], { month: "long", year: "numeric" });
  const nav = el("span");
  nav.append(
    iconBtn("‹", "Previous month", () => { calOffset--; renderWidgets(); }),
    iconBtn("•", "Today", () => { calOffset = 0; renderWidgets(); }),
    iconBtn("›", "Next month", () => { calOffset++; renderWidgets(); }));
  const w = widgetBox(title, "", nav);
  const grid = el("div", "cal");
  for (let d = 0; d < 7; d++) grid.append(el("b", "", new Date(2023, 0, 1 + d).toLocaleDateString([], { weekday: "narrow" }))); // Jan 1 2023 was a Sunday
  const start = new Date(first); start.setDate(1 - first.getDay());
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const today = d.toDateString() === now.toDateString();
    grid.append(el("span", d.getMonth() !== first.getMonth() ? "out" : today ? "today" : "", d.getDate()));
  }
  w.append(grid);
  return w;
}

function worldClockWidget() {
  const w = widgetBox("World clock");
  const list = el("div", "zones"); list.id = "zones";
  w.append(list);
  return w;
}

function updateZones() {
  const list = $("zones");
  if (!list) return;
  const now = new Date(), here = now.toLocaleDateString("en-CA");
  list.replaceChildren(...S.zones.map((tz) => {
    const row = el("div"), name = el("span", "", tz.split("/").pop().replace(/_/g, " "));
    try {
      const time = now.toLocaleTimeString([], { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: !S.clock24 });
      const day = now.toLocaleDateString("en-CA", { timeZone: tz });
      if (day !== here) name.append(el("small", "", day > here ? "tomorrow" : "yesterday"));
      row.append(name, el("strong", "", time));
    } catch {
      row.append(name, el("small", "", "unknown time zone"));
    }
    return row;
  }));
}

const WIDGETS = {
  todo: ["To-do", todoWidget], notes: ["Notes", notesWidget], pomodoro: ["Pomodoro", pomoWidget],
  quote: ["Quote", quoteWidget], calendar: ["Calendar", calendarWidget], worldclock: ["World clock", worldClockWidget]
};

function renderWidgets() {
  const ids = Object.keys(WIDGETS).filter((id) => S.widgets[id]), defs = defaultRects(ids);
  $("widgets").replaceChildren(...ids.map((id, i) => {
    const w = WIDGETS[id][1]();
    w.dataset.id = id;
    w.style.setProperty("--i", i + 4);
    decorateWidget(w, id, layoutOf(id).rect || defs[id]);
    return w;
  }));
  renderEditBar();
  updatePomo(); updateZones();
}

// ---- Command palette ----
let pItems = [], pSel = 0;

function paletteActions() {
  const acts = [
    { label: "Next wallpaper", hint: "W", icon: "🖼", run: nextWallpaper },
    { label: "Toggle zen mode", hint: "Z", icon: "🌙", run: toggleZen },
    { label: "Customize appearance", hint: "C", icon: "🎨", run: () => toggleDrawer(true) },
    { label: "Edit widget layout", hint: "E", icon: "✥", run: () => toggleEdit(true) },
    { label: "Open all settings", icon: "⚙", run: () => (location.href = "options.html") },
    { label: `Switch to ${S.clock24 ? "12" : "24"}-hour clock`, icon: "🕑", run: () => set({ clock24: !S.clock24 }) },
    { label: `${S.animations ? "Disable" : "Enable"} animations`, icon: "✨", run: () => set({ animations: !S.animations }) },
    { label: "Wallpaper: Daily photo", icon: "🌄", run: () => set({ wpMode: "daily" }) },
    { label: "Wallpaper: Gradient", icon: "🎨", run: () => set({ wpMode: "gradient" }) }
  ];
  for (const [k, name] of Object.entries(LIVE_SCENES)) acts.push({ label: `Live wallpaper: ${name}`, icon: "🌌", run: () => set({ wpMode: "live", liveScene: k }) });
  for (const l of ["centered", "sidebar", "minimal"]) acts.push({ label: `Layout: ${l[0].toUpperCase() + l.slice(1)}`, icon: "▦", run: () => set({ layout: l }) });
  return acts;
}

// Subsequence match: consecutive letters and word starts score higher; -1 means no match
function fuzzy(q, s) {
  s = s.toLowerCase();
  let from = 0, prev = -2, score = 0;
  for (const ch of q) {
    const j = s.indexOf(ch, from);
    if (j < 0) return -1;
    score += j === prev + 1 ? 3 : 1;
    if (j === 0 || /[\s/.:-]/.test(s[j - 1])) score += 2;
    prev = j; from = j + 1;
  }
  return score - s.length * 0.01;
}

function renderPalette() {
  const q = $("pq").value.trim().toLowerCase().replace(/\s+/g, " ");
  const links = flat.map((l) => ({ label: l.title, hint: l.group + " · " + l.url.replace(/^https?:\/\//, ""), link: l, run: () => (location.href = l.url) }));
  const all = [...links, ...paletteActions()];
  pItems = q
    ? all.map((it) => ({ it, s: fuzzy(q, it.label + " " + (it.hint || "")) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s).map((x) => x.it)
    : all;
  pItems = pItems.slice(0, 9);
  if (q) pItems.push({ label: `Search “${$("pq").value.trim()}”`, hint: $("engine").value, icon: "🔎", run: () => goSearch($("pq").value.trim()) });
  pSel = Math.min(pSel, Math.max(0, pItems.length - 1));
  $("plist").replaceChildren(...(pItems.length ? pItems.map((it, i) => {
    const li = el("li", i === pSel ? "on" : "");
    li.append(it.link ? linkIcon(it.link, "ico") : el("div", "ico", it.icon || "›"), el("span", "", it.label));
    if (it.hint) li.append(el("small", "", it.hint));
    li.onmousemove = () => { if (pSel !== i) { pSel = i; renderPalette(); } };
    li.onclick = () => runPalette(i);
    return li;
  }) : [el("li", "empty", "No matches")]));
  $("plist").querySelector(".on")?.scrollIntoView({ block: "nearest" });
}

function runPalette(i) {
  const it = pItems[i];
  if (!it) return;
  closePalette();
  it.run();
}

function togglePalette() {
  if (!$("palette").hidden) return closePalette();
  $("palette").hidden = false;
  $("pq").value = ""; pSel = 0;
  renderPalette();
  $("pq").focus();
}
const closePalette = () => { $("palette").hidden = true; };

$("pq").oninput = () => { pSel = 0; renderPalette(); };
$("pq").onkeydown = (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    pSel = (pSel + (e.key === "ArrowDown" ? 1 : -1) + pItems.length) % Math.max(1, pItems.length);
    renderPalette();
  } else if (e.key === "Enter") { e.preventDefault(); runPalette(pSel); }
};
$("palette").onclick = (e) => { if (e.target === $("palette")) closePalette(); };

// ---- Customize drawer ----
const ACCENTS = ["#7aa2ff", "#a78bfa", "#f472b6", "#fb923c", "#facc15", "#34d399", "#22d3ee"];

function field(title, ...children) {
  const f = el("div", "field");
  f.append(el("label", "", title), ...children);
  return f;
}
function seg(key, options) {
  const row = el("div", "seg");
  for (const [value, label] of options) {
    const b = el("button", S[key] === value ? "on" : "", label);
    b.onclick = () => set({ [key]: value });
    row.append(b);
  }
  return row;
}
function toggle(label, key) {
  const l = el("label", "toggle"), c = el("input");
  c.type = "checkbox"; c.checked = S[key];
  c.onchange = () => set({ [key]: c.checked });
  l.append(el("span", "", label), c);
  return l;
}

function renderDrawer() {
  const d = $("drawer");
  const head = el("h2", "", "Customize");
  head.append(iconBtn("✕", "Close (Esc)", () => toggleDrawer(false)));

  const scenes = el("div", "scenes");
  for (const [k, name] of Object.entries(LIVE_SCENES)) {
    const b = el("button", `scene ${k}` + (S.wpMode === "live" && S.liveScene === k ? " on" : ""), name);
    b.onclick = () => set({ wpMode: "live", liveScene: k });
    scenes.append(b);
  }

  const sw = el("div", "swatches");
  for (const c of ACCENTS) {
    const b = el("button", S.accent === c ? "on" : "");
    b.style.background = c; b.title = c;
    b.onclick = () => set({ accent: c });
    sw.append(b);
  }
  const pick = el("input");
  pick.type = "color"; pick.value = S.accent; pick.title = "Custom color";
  pick.onchange = () => set({ accent: pick.value });
  sw.append(pick);

  const dim = el("input");
  dim.type = "range"; dim.min = 0; dim.max = 80; dim.value = S.dim;
  dim.oninput = () => ($("dim").style.opacity = dim.value / 100);
  dim.onchange = () => set({ dim: +dim.value });

  const widgetButtons = el("div", "seg");
  const editBtn = el("button", "", "Move & resize");
  editBtn.onclick = () => { toggleDrawer(false); toggleEdit(true); };
  const styleBtn = el("button", "", "Style all");
  styleBtn.onclick = () => openWidgetPanel(null, styleBtn);
  widgetButtons.append(editBtn, styleBtn);

  const more = el("a", "more", "All settings →");
  more.href = "options.html";

  d.replaceChildren(
    head,
    field("Background", seg("wpMode", [["live", "Live 3D"], ["daily", "Daily photo"], ["gradient", "Gradient"]])),
    field("3D scene", scenes),
    field("Scene quality", seg("liveQuality", [["low", "Battery"], ["medium", "Balanced"], ["high", "Ultra"]])),
    field("Dim", dim),
    field("Layout", seg("layout", [["centered", "Centered"], ["sidebar", "Sidebar"], ["minimal", "Minimal"]])),
    field("Accent", sw),
    field("Widgets", widgetButtons),
    field("Card size", seg("cardSize", [["s", "S"], ["m", "M"], ["l", "L"]])),
    field("Card style", seg("cardStyle", [["glass", "Glass"], ["solid", "Solid"], ["outline", "Outline"]])),
    toggle("Animations", "animations"),
    toggle("24-hour clock", "clock24"),
    more
  );
}

function toggleDrawer(open = $("drawer").hidden) {
  $("drawer").hidden = !open;
  if (open) renderDrawer();
}

// ---- Boot ----
function renderAll() {
  applyTheme(); renderLinks(); renderWidgets(); renderWeather(); applyWallpaper(); tick();
  $("engine").value = S.engine;
}

(async () => {
  S = await getSettings();
  pomo = (await chrome.storage.local.get("pomo")).pomo || pomo;
  setupSearch(); renderAll(); scheduleMidnight();
  setInterval(tick, 1000);
  setTimeout(() => document.body.classList.remove("intro"), 1800);
  $("clock").onclick = () => set({ clock24: !S.clock24 });
  $("nextWp").onclick = nextWallpaper;
  $("paletteBtn").onclick = togglePalette;
  $("zenBtn").onclick = toggleZen;
  $("customBtn").onclick = () => toggleDrawer();
  $("editBtn").onclick = () => toggleEdit();
  reducedMotion.onchange = renderAll;

  // Live-update when settings change in another tab, the admin panel, or another device
  onSettingsChanged((s) => {
    if (JSON.stringify(s) === JSON.stringify(S)) return;
    const typing = document.activeElement?.id === "notes";
    S = s;
    if (typing) { applyTheme(); renderLinks(); renderWeather(); applyWallpaper(); } else renderAll();
    if (!$("drawer").hidden) renderDrawer();
  });
  chrome.storage.onChanged.addListener((c, area) => {
    if (area !== "local") return;
    if (c.pomo) { pomo = c.pomo.newValue; updatePomo(); }
    if (c.wallpaperIdx && S.wpMode === "daily") applyWallpaper();
  });
})();
