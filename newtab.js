const $ = (id) => document.getElementById(id);
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
let S, flat = [];
const persist = () => saveSettings(S);

function tick() {
  const now = new Date();
  $("clock").textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: !S.clock24 });
  $("date").textContent = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  if (S.widgets.pomodoro) updatePomo();
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
      const n = flat.push(l);
      const a = el("a", "card");
      a.href = l.url; a.title = l.url;
      a.append(linkIcon(l, "ico"), el("span", "", l.title));
      if (S.shortcuts && n <= 9) a.append(el("kbd", "", n));
      cards.append(a);
    }
    sec.append(cards);
    return sec;
  }));
}

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "/") { e.preventDefault(); $("q").focus(); }
  else if (S.shortcuts && /^[1-9]$/.test(e.key) && flat[e.key - 1]) location.href = flat[e.key - 1].url;
});

// ---- Wallpaper ----
// Fetch Bing's daily image once per local calendar day; cache URL in storage
async function loadDailyWallpaper() {
  const today = localDate();
  const data = await chrome.storage.local.get(["wallpaperDate", "wallpaperUrl"]);
  if (data.wallpaperDate === today && data.wallpaperUrl) return data.wallpaperUrl;
  try {
    const res = await fetch("https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=en-US");
    const json = await res.json();
    const url = `https://www.bing.com${json.images[0].urlbase}_UHD.jpg`;
    await chrome.storage.local.set({ wallpaperDate: today, wallpaperUrl: url });
    return url;
  } catch (err) {
    console.error("Failed to fetch daily wallpaper:", err);
    return data.wallpaperUrl || null;
  }
}

async function applyWallpaper() {
  const bg = $("bg");
  bg.style.filter = `blur(${S.blur}px)`;
  $("dim").style.opacity = S.dim / 100;
  let url = null;
  if (S.wpMode === "daily") url = await loadDailyWallpaper();
  else if (S.wpMode === "url") url = S.wpUrl;
  else if (S.wpMode === "file") {
    const f = await getWallpaperFile().catch(() => null);
    if (f) url = URL.createObjectURL(f);
  }
  bg.style.backgroundImage = url ? `url("${url}")` : S.gradient;
}

// Rotate wallpaper at midnight for tabs left open overnight
function scheduleMidnight() {
  const n = new Date(), next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 5);
  setTimeout(() => { applyWallpaper(); scheduleMidnight(); }, next - n);
}

// ---- Search ----
function setupSearch() {
  const sel = $("engine");
  for (const k in ENGINES) sel.add(new Option(k[0].toUpperCase() + k.slice(1), k));
  sel.value = S.engine;
  $("search").onsubmit = (e) => {
    e.preventDefault();
    const q = $("q").value.trim();
    if (!q) return;
    const hasScheme = /^https?:\/\//i.test(q);
    const isUrl = hasScheme || /^[^\s/]+\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(q) || /^localhost(:\d+)?(\/\S*)?$/i.test(q);
    location.href = isUrl ? (hasScheme ? q : (q.startsWith("localhost") ? "http://" : "https://") + q)
                          : ENGINES[sel.value] + encodeURIComponent(q);
  };
}

// ---- Weather (Open-Meteo, no API key; cached for 30 minutes) ----
const wxIcon = (c) => c === 0 ? "☀️" : c <= 3 ? "⛅" : c <= 48 ? "🌫️" : c <= 67 ? "🌧️" : c <= 77 ? "🌨️" : c <= 82 ? "🌦️" : c <= 86 ? "🌨️" : "⛈️";

async function renderWeather() {
  const w = $("weather");
  w.textContent = "";
  if (!S.widgets.weather || !S.weatherCity) return;
  const key = `${S.weatherCity}|${S.tempUnit}`;
  let { weatherCache: c } = await chrome.storage.local.get("weatherCache");
  if (!c || c.key !== key || Date.now() - c.at > 30 * 60e3) {
    try {
      const city = encodeURIComponent(S.weatherCity.split(",")[0].trim());
      const geo = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${city}`)).json();
      const p = geo.results?.[0];
      if (!p) throw new Error(`City "${S.weatherCity}" not found`);
      const f = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,weather_code&temperature_unit=${S.tempUnit}`)).json();
      c = { key, at: Date.now(), name: p.name, temp: Math.round(f.current.temperature_2m), code: f.current.weather_code };
      await chrome.storage.local.set({ weatherCache: c });
    } catch (err) {
      console.error("Weather failed:", err);
      if (!c || c.key !== key) return;
    }
  }
  w.textContent = `${wxIcon(c.code)} ${c.temp}°${S.tempUnit === "celsius" ? "C" : "F"} · ${c.name}`;
}

// ---- Widgets ----
function todoWidget() {
  const w = el("div", "widget");
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
  w.append(el("h4", "", "To-do"), list, add);
  return w;
}

function notesWidget() {
  const w = el("div", "widget");
  const ta = el("textarea");
  ta.id = "notes"; ta.value = S.notes; ta.placeholder = "Quick notes…";
  let t;
  ta.oninput = () => { clearTimeout(t); t = setTimeout(() => { S.notes = ta.value; persist(); }, 800); };
  w.append(el("h4", "", "Notes"), ta);
  return w;
}

// Pomodoro state lives in local storage so it's shared by all open tabs
const POMO = { work: 25 * 60e3, break: 5 * 60e3 };
let pomo = { mode: "work", endsAt: null, remaining: POMO.work };
const pomoLeft = () => (pomo.endsAt ? Math.max(0, pomo.endsAt - Date.now()) : pomo.remaining);
const setPomo = (p) => { pomo = p; chrome.storage.local.set({ pomo }); updatePomo(); };

function pomoWidget() {
  const w = el("div", "widget pomo");
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
  w.append(el("h4", "", "Pomodoro"), time, label, row);
  return w;
}

function updatePomo() {
  if (!$("pomoTime")) return;
  let left = pomoLeft();
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
}

function renderWidgets() {
  const ws = [];
  if (S.widgets.todo) ws.push(todoWidget());
  if (S.widgets.notes) ws.push(notesWidget());
  if (S.widgets.pomodoro) ws.push(pomoWidget());
  $("widgets").replaceChildren(...ws);
  updatePomo();
}

function renderAll() {
  renderLinks(); renderWidgets(); renderWeather(); applyWallpaper(); tick();
  $("engine").value = S.engine;
}

(async () => {
  S = await getSettings();
  pomo = (await chrome.storage.local.get("pomo")).pomo || pomo;
  setupSearch(); renderAll(); scheduleMidnight();
  setInterval(tick, 1000);
  $("clock").onclick = () => { S.clock24 = !S.clock24; persist(); tick(); };

  // Live-update when settings change in another tab, the admin panel, or another device
  onSettingsChanged((s) => {
    if (JSON.stringify(s) === JSON.stringify(S)) return;
    const typing = document.activeElement?.id === "notes";
    S = s;
    if (typing) { renderLinks(); renderWeather(); applyWallpaper(); } else renderAll();
  });
  chrome.storage.onChanged.addListener((c, area) => { if (area === "local" && c.pomo) { pomo = c.pomo.newValue; updatePomo(); } });
})();
