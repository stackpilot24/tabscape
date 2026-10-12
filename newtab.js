const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let S, flat = [];
const persist = () => saveSettings(S);
// Apply a settings change made on this page and re-render everything it affects
const set = (patch) => { Object.assign(S, patch); persist(); renderAll(); if (!$("drawer").hidden) renderDrawer(); };

let lastMinute = -1, lastDay = "";
function tick() {
  const now = new Date();
  if (now.getMinutes() !== lastMinute) {
    lastMinute = now.getMinutes();
    if (applyProfileSchedule(S)) { persist(); renderAll(); return; }
    if (S.wpMode === "live" && S.sceneSchedule.on) applyWallpaper(); // no-op unless the part of day changed
    if (isoDate(now) !== lastDay) { lastDay = isoDate(now); renderFocus(); }
  }
  $("clock").textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: !S.clock24 });
  $("date").textContent = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const hr = now.getHours();
  const part = hr < 5 ? "night" : hr < 12 ? "morning" : hr < 17 ? "afternoon" : hr < 22 ? "evening" : "night";
  $("greeting").textContent = S.userName ? `Good ${part}, ${S.userName}` : "";
  if (S.widgets.pomodoro) updatePomo();
  if (S.widgets.worldclock && now.getSeconds() === 0) updateZones();
}

// ---- Appearance ----
function applyTheme() {
  const b = document.body;
  b.classList.remove(...[...b.classList].filter((c) => /^(layout|size|style)-/.test(c)));
  b.classList.add(`layout-${S.layout}`, `size-${S.cardSize}`, `style-${S.cardStyle}`);
  b.classList.toggle("anim", S.animations && !reducedMotion.matches);
  // Glass blur over an animated wallpaper is recomputed every frame; Smooth mode swaps it for tinted glass
  b.classList.toggle("smooth", S.smooth && S.wpMode === "live" && S.animations && !reducedMotion.matches);
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

// ---- App dock ----
function renderDock() {
  const d = $("apps");
  d.hidden = !S.dockVisible || !S.dock.length;
  d.replaceChildren(...S.dock.map(appButton));
}

// ---- AI Tools launcher (bottom left): pills slide out of the button and back in ----
function renderAi() {
  $("aibar").hidden = !S.aiTools;
  $("aiList").replaceChildren(...AI_TOOLS.map((t, i) => {
    const a = el("a", "aipill");
    a.href = t.url; a.title = t.name; a.tabIndex = -1;
    a.style.setProperty("--d", i);
    a.style.setProperty("--r", AI_TOOLS.length - 1 - i);
    a.append(linkIcon({ url: t.url, icon: "" }, "aiico"), el("span", "", t.name));
    return a;
  }));
}

function toggleAi(open = !$("aibar").classList.contains("open")) {
  const bar = $("aibar");
  bar.classList.remove("compact");
  if (open) {
    // Measure the fully open row (pills keep their size while hidden): too wide for the window
    // → icons only; reaching the app dock → slide the dock away while the row is open
    const room = innerWidth - bar.getBoundingClientRect().left - 16;
    if (bar.scrollWidth > room) bar.classList.add("compact");
    const dock = $("apps").getBoundingClientRect();
    document.body.classList.toggle("ai-over-dock", !$("apps").hidden && bar.getBoundingClientRect().left + bar.scrollWidth > dock.left - 12);
  } else {
    document.body.classList.remove("ai-over-dock");
  }
  bar.classList.toggle("open", open);
  $("aiToggle").setAttribute("aria-expanded", open);
  for (const a of $("aiList").children) a.tabIndex = open ? 0 : -1;
}
$("aiToggle").onclick = () => toggleAi();

// ---- Today's main focus ----
function renderFocus() {
  const box = $("focus"), today = isoDate();
  box.replaceChildren();
  if (!S.showFocus) return;
  if (S.focus.date !== today || !S.focus.text) {
    const i = el("input");
    i.id = "focusInput"; i.placeholder = "What's your main focus today?"; i.maxLength = 120;
    i.onkeydown = (e) => { if (e.key === "Enter" && i.value.trim()) set({ focus: { text: i.value.trim(), date: today, done: false } }); };
    box.append(i);
    return;
  }
  const cb = el("input"), label = el("label", S.focus.done ? "done" : "");
  cb.type = "checkbox"; cb.checked = S.focus.done;
  cb.onchange = () => set({ focus: { ...S.focus, done: cb.checked } });
  label.append(cb, el("span", "", S.focus.text));
  box.append(el("small", "", "TODAY"), label, iconBtn("✕", "Clear today's focus", () => set({ focus: { text: "", date: "", done: false } })));
}

// ---- Search suggestions: your links first, then the engine's suggestions (optional permission) ----
const SUGGEST = {
  google: { origin: "https://suggestqueries.google.com/*", url: (q) => `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}` },
  duckduckgo: { origin: "https://duckduckgo.com/*", url: (q) => `https://duckduckgo.com/ac/?type=list&q=${encodeURIComponent(q)}` }
};
const suggestSource = (engine) => SUGGEST[engine === "duckduckgo" ? "duckduckgo" : "google"];
let sItems = [], sSel = -1, sSeq = 0, sTimer;

async function updateSuggest() {
  const q = $("q").value.trim(), seq = ++sSeq;
  if (!q) return hideSuggest();
  const links = flat.map((l) => ({ l, s: fuzzy(q.toLowerCase(), l.title + " " + l.url) })).filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s).slice(0, 3).map(({ l }) => ({ text: l.title, hint: l.url.replace(/^https?:\/\//, ""), link: l }));
  let words = [];
  if (S.suggest) {
    try { words = ((await getJSON(suggestSource($("engine").value).url(q)))[1] || []).slice(0, 6).map((text) => ({ text })); }
    catch { /* no permission or offline: links only */ }
  }
  if (seq !== sSeq) return; // a newer keystroke already answered
  sItems = [...links, ...words];
  sSel = -1;
  drawSuggest();
}

function drawSuggest() {
  const ul = $("suggest");
  ul.hidden = !sItems.length;
  ul.replaceChildren(...sItems.map((it, i) => {
    const li = el("li", i === sSel ? "on" : "");
    li.setAttribute("role", "option");
    li.append(it.link ? linkIcon(it.link, "ico") : el("span", "ico", "🔎"), el("span", "", it.text));
    if (it.hint) li.append(el("small", "", it.hint));
    li.onmousedown = (e) => { e.preventDefault(); pickSuggest(it); };
    return li;
  }));
}
const hideSuggest = () => { sItems = []; $("suggest").hidden = true; };
const pickSuggest = (it) => { hideSuggest(); if (it.link) location.href = it.link.url; else goSearch(it.text); };

$("q").addEventListener("input", () => { clearTimeout(sTimer); sTimer = setTimeout(updateSuggest, 120); });
$("q").addEventListener("blur", () => setTimeout(hideSuggest, 100));
$("q").addEventListener("keydown", (e) => {
  if (e.key === "Escape" && sItems.length) { e.stopPropagation(); hideSuggest(); return; }
  if (!sItems.length || !["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) return;
  if (e.key === "Enter") { if (sSel >= 0) { e.preventDefault(); pickSuggest(sItems[sSel]); } return; }
  e.preventDefault();
  const n = sItems.length + 1; // the extra slot (-1) is "what you typed"
  sSel = (((sSel + 1 + (e.key === "ArrowDown" ? 1 : -1)) % n) + n) % n - 1;
  drawSuggest();
});

// ---- Keyboard ----
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); togglePalette(); return; }
  if (e.key === "Escape") {
    if (!$("palette").hidden) closePalette();
    else if (!$("wpanel").hidden) closeWidgetPanel();
    else if ($("aibar").classList.contains("open")) toggleAi(false);
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
async function dailyWallpaper() {
  const list = await dailyList(S);
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
  $("credit").replaceChildren();

  if (S.wpMode === "live") {
    bgKey = "";
    removeVideo();
    bg.classList.remove("show");
    Live.start($("live"), currentScene(S), { accent: S.accent, quality: S.liveQuality, animate: S.animations && !reducedMotion.matches });
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
  if (credit) showCredit(credit);

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

// "📷 Photo by <photographer> on <site>" when the source names the author, else the title linking to its page
function showCredit(p) {
  const a = (text, href) => { const l = el("a", "", text); l.href = href; l.target = "_blank"; l.rel = "noopener"; return l; };
  const box = $("credit");
  if (p.author) {
    box.append("📷 Photo by ", a(p.author, p.authorLink), " on ", a(p.siteName, p.siteLink));
    box.title = p.title;
  } else {
    box.append(a("📷 " + (p.title || DAILY_SOURCES[S.dailySource]?.name || "Photo of the day"), p.link || "#"));
    box.title = "Open the photo's source page";
  }
  if (p.ping && S.unsplashKey) reportView(p.ping);
}

// Unsplash asks apps to hit a photo's download_location once when it is used; remember which were sent
async function reportView(ping) {
  const { pinged = [] } = await chrome.storage.local.get("pinged");
  if (pinged.includes(ping)) return;
  fetch(`${ping}${ping.includes("?") ? "&" : "?"}client_id=${encodeURIComponent(S.unsplashKey)}`).catch(() => {});
  chrome.storage.local.set({ pinged: [...pinged, ping].slice(-50) });
}

async function nextWallpaper() {
  if (S.wpMode === "live") {
    const names = Object.keys(LIVE_SCENES);
    // a manual pick overrides the time-of-day schedule
    set({ liveScene: names[(names.indexOf(currentScene(S)) + 1) % names.length], sceneSchedule: { ...S.sceneSchedule, on: false } });
  } else if (S.wpMode === "daily") {
    const list = await dailyList(S);
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
    { label: "Wallpaper: Gradient", icon: "🎨", run: () => set({ wpMode: "gradient" }) }
  ];
  for (const [k, name] of Object.entries(LIVE_SCENES)) acts.push({ label: `Live wallpaper: ${name}`, icon: "🌌", run: () => set({ wpMode: "live", liveScene: k, sceneSchedule: { ...S.sceneSchedule, on: false } }) });
  acts.push({ label: "Live wallpaper: change by time of day", icon: "🕰", run: () => set({ wpMode: "live", sceneSchedule: { ...S.sceneSchedule, on: true } }) });
  for (const [k, src] of Object.entries(DAILY_SOURCES)) if (k !== "unsplash") acts.push({ label: `Daily photo: ${src.name}`, icon: "🌄", run: () => set({ wpMode: "daily", dailySource: k }) });
  for (const topic of ["nature", "space"]) acts.push({ label: `Daily photo: Unsplash ${topic}`, icon: "🌄", run: () => set({ wpMode: "daily", dailySource: "unsplash", unsplashTopic: topic }) });
  for (const l of ["centered", "sidebar", "minimal"]) acts.push({ label: `Layout: ${l[0].toUpperCase() + l.slice(1)}`, icon: "▦", run: () => set({ layout: l }) });
  for (const name of Object.keys(THEME_PRESETS)) acts.push({ label: `Theme: ${name}`, icon: "🎭", run: () => set(THEME_PRESETS[name]) });
  for (const name of ["", ...S.profiles.map((p) => p.name)]) {
    acts.push({ label: `Profile: ${name || "Main"}`, icon: "👤", run: () => { switchProfile(S, name); S.profileAuto = false; persist(); renderAll(); } });
  }
  acts.push({ label: "Edit app dock", icon: "⚓", run: () => (location.href = "options.html#dock") });
  acts.push({ label: "Import bookmarks or most visited", icon: "⭳", run: () => (location.href = "options.html#links") });
  acts.push({ label: "Show welcome tour", icon: "👋", run: showWelcome });
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
    const b = el("button", `scene ${k}` + (S.wpMode === "live" && currentScene(S) === k ? " on" : ""), name);
    b.onclick = () => set({ wpMode: "live", liveScene: k, sceneSchedule: { ...S.sceneSchedule, on: false } });
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

  const presets = el("div", "presets");
  for (const name of Object.keys(THEME_PRESETS)) {
    const b = el("button", "", name);
    b.onclick = () => set(THEME_PRESETS[name]);
    presets.append(b);
  }
  const codeBox = el("div", "codebox"), codeIn = el("input");
  codeIn.placeholder = "Paste a theme code (CTAB1:…)";
  const apply = el("button", "", "Apply");
  apply.onclick = () => {
    try { set(decodeTheme(codeIn.value)); } catch { codeIn.value = ""; codeIn.placeholder = "That isn't a valid theme code"; }
  };
  const copy = el("button", "", "Copy my theme");
  copy.onclick = async () => { await navigator.clipboard.writeText(encodeTheme(S)); copy.textContent = "Copied ✓"; };
  codeBox.append(codeIn, apply, copy);

  const profiles = [];
  if (S.profiles.length) {
    const row = el("div", "seg");
    for (const name of ["", ...S.profiles.map((p) => p.name)]) {
      const b = el("button", S.activeProfile === name ? "on" : "", name || "Main");
      b.onclick = () => { switchProfile(S, name); S.profileAuto = false; persist(); renderAll(); renderDrawer(); };
      row.append(b);
    }
    const auto = el("label", "toggle"), c = el("input");
    c.type = "checkbox"; c.checked = S.profileAuto;
    c.onchange = () => { S.profileAuto = c.checked; applyProfileSchedule(S); persist(); renderAll(); renderDrawer(); };
    auto.append(el("span", "", "Switch by schedule"), c);
    profiles.push(field("Profile", row, auto));
  }

  const more = el("a", "more", "All settings →");
  more.href = "options.html";

  d.replaceChildren(
    head,
    ...profiles,
    field("Theme presets", presets, codeBox),
    field("Background", seg("wpMode", [["live", "Live 3D"], ["daily", "Daily photo"], ["gradient", "Gradient"]])),
    field("3D scene", scenes, (() => {
      const l = el("label", "toggle"), c = el("input");
      c.type = "checkbox"; c.checked = S.sceneSchedule.on;
      c.onchange = () => set({ wpMode: "live", sceneSchedule: { ...S.sceneSchedule, on: c.checked } });
      l.append(el("span", "", "Change scene by time of day"), c);
      return l;
    })()),
    field("Scene quality", seg("liveQuality", [["low", "Battery"], ["medium", "Balanced"], ["high", "Ultra"]])),
    field("Dim", dim),
    field("Layout", seg("layout", [["centered", "Centered"], ["sidebar", "Sidebar"], ["minimal", "Minimal"]])),
    field("Accent", sw),
    field("Widgets", widgetButtons),
    field("Card size", seg("cardSize", [["s", "S"], ["m", "M"], ["l", "L"]])),
    field("Card style", seg("cardStyle", [["glass", "Glass"], ["solid", "Solid"], ["outline", "Outline"]])),
    toggle("Animations", "animations"),
    toggle("Smooth mode (no glass blur over 3D scenes)", "smooth"),
    toggle("AI Tools button", "aiTools"),
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
  applyTheme(); renderLinks(); renderDock(); renderAi(); renderFocus(); renderWidgets(); renderWeather(); applyWallpaper(); tick();
  $("engine").value = S.engine;
}

(async () => {
  S = await getSettings();
  if (applyProfileSchedule(S)) persist();
  await loadPomo();
  setupSearch(); renderAll(); scheduleMidnight();
  if (!S.onboarded) showWelcome();
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
    const typing = ["notes", "focusInput"].includes(document.activeElement?.id);
    S = s;
    if (typing) { applyTheme(); renderLinks(); renderWeather(); applyWallpaper(); } else renderAll();
    if (!$("drawer").hidden) renderDrawer();
  });
  chrome.storage.onChanged.addListener((c, area) => {
    if (area !== "local") return;
    if (c.pomo) { pomo = c.pomo.newValue; updatePomo(); }
    if (c.focusLog) { focusToday = c.focusLog.newValue?.[isoDate()] || { sessions: 0, minutes: 0 }; updatePomo(); }
    if (c.wallpaperIdx && S.wpMode === "daily") applyWallpaper();
  });
})();
