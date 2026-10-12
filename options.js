const $ = (id) => document.getElementById(id);
let S;

function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 1500);
}
function showStorage(where) {
  $("storage").textContent = where === "sync" ? "✓ Synced to Chrome account" : "Saved on this device only (sync quota full)";
  $("storage").className = where;
}
// Edited on the new tab page; re-read before saving so this page never overwrites them with stale copies
const DASHBOARD_KEYS = ["todos", "notes", "focus", "habits", "countdowns", "widgetLayout", "widgetStyle", "onboarded"];
async function save(patch, msg = "Saved", keepWidgetData = false) {
  if (!keepWidgetData) {
    const latest = await getSettings();
    if (latest.activeProfile === S.activeProfile) for (const k of DASHBOARD_KEYS) S[k] = latest[k];
  }
  Object.assign(S, patch);
  showStorage(await saveSettings(S));
  toast(msg);
}
const normUrl = (u) => (/^[a-z][\w+.-]*:/i.test(u) ? u : "https://" + u);

function input(value, cls, onChange) {
  const i = el("input", cls);
  i.value = value;
  i.onchange = () => onChange(i.value.trim());
  return i;
}
function btn(text, onClick, cls) {
  const b = el("button", cls, text);
  b.type = "button"; b.onclick = onClick;
  return b;
}

// ---- Groups & links ----
let drag = null; // { g, i } of the link being dragged
const saveGroups = () => save({ groups: S.groups }).then(renderGroups);

function moveLink(gi, i) {
  if (!drag) return;
  const [l] = S.groups[drag.g].links.splice(drag.i, 1);
  S.groups[gi].links.splice(i, 0, l);
  drag = null;
  saveGroups();
}

function linkRow(g, gi, l, i) {
  const li = el("li");
  li.draggable = true;
  li.ondragstart = () => { drag = { g: gi, i }; li.classList.add("drag"); };
  li.ondragend = () => li.classList.remove("drag");
  li.ondragover = (e) => e.preventDefault();
  li.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); moveLink(gi, i); };
  const move = (d) => () => {
    const j = i + d;
    if (j < 0 || j >= g.links.length) return;
    [g.links[i], g.links[j]] = [g.links[j], g.links[i]];
    saveGroups();
  };
  li.append(
    linkIcon(l, "ico"),
    input(l.title, "", (v) => { l.title = v; saveGroups(); }),
    input(l.url, "url", (v) => { l.url = normUrl(v); saveGroups(); }),
    input(l.icon, "", (v) => { l.icon = v; saveGroups(); }),
    btn("↑", move(-1)), btn("↓", move(1)),
    btn("✕", () => { g.links.splice(i, 1); saveGroups(); }, "del")
  );
  return li;
}

function renderGroups() {
  const sel = $("lGroup"), prev = sel.value;
  sel.replaceChildren(...S.groups.map((g, gi) => new Option(g.name, gi)));
  if (prev && prev < S.groups.length) sel.value = prev;

  $("groups").replaceChildren(...S.groups.map((g, gi) => {
    const box = el("div", "group");
    const moveGroup = (d) => () => {
      const j = gi + d;
      if (j < 0 || j >= S.groups.length) return;
      [S.groups[gi], S.groups[j]] = [S.groups[j], S.groups[gi]];
      saveGroups();
    };
    const head = el("div", "ghead");
    head.append(
      input(g.name, "gname", (v) => { g.name = v || "Untitled"; saveGroups(); }),
      btn("↑", moveGroup(-1)), btn("↓", moveGroup(1)),
      btn("Delete group", () => {
        if (g.links.length && !confirm(`Delete "${g.name}" and its ${g.links.length} link(s)?`)) return;
        S.groups.splice(gi, 1);
        saveGroups();
      }, "del")
    );
    const ul = el("ul", "links");
    ul.ondragover = (e) => e.preventDefault();
    ul.ondrop = (e) => { e.preventDefault(); moveLink(gi, g.links.length); };
    ul.append(...g.links.map((l, i) => linkRow(g, gi, l, i)));
    if (!g.links.length) ul.append(el("li", "empty", "Drop links here"));
    box.append(head, ul);
    return box;
  }));
}

$("addForm").onsubmit = (e) => {
  e.preventDefault();
  if (!S.groups.length) S.groups.push({ name: "Favorites", links: [] });
  const g = S.groups[+$("lGroup").value || 0];
  g.links.push({ title: $("lTitle").value.trim(), url: normUrl($("lUrl").value.trim()), icon: $("lIcon").value.trim() });
  ["lTitle", "lUrl", "lIcon"].forEach((id) => ($(id).value = ""));
  saveGroups();
};
$("groupForm").onsubmit = (e) => {
  e.preventDefault();
  S.groups.push({ name: $("gName").value.trim(), links: [] });
  e.target.reset();
  saveGroups();
};

// ---- Import from the browser ----
async function importLinks(kind) {
  try {
    const groups = await importBrowserLinks(kind);
    const n = groups.reduce((t, g) => t + g.links.length, 0);
    if (!n) return toast("Nothing to import");
    const isExample = JSON.stringify(S.groups) === JSON.stringify(DEFAULTS.groups);
    S.groups = isExample ? groups : [...S.groups, ...groups];
    await saveGroups();
    toast(`Imported ${n} links`);
  } catch (err) {
    toast(err.message === "permission denied" ? "Permission not granted" : "Import failed: " + err.message);
  }
}
$("importBookmarks").onclick = () => importLinks("bookmarks");
$("importTop").onclick = () => importLinks("topSites");

// ---- App dock ----
const saveDock = () => save({ dock: S.dock }).then(renderDock);

function renderDock() {
  const locked = S.dockLocked;
  for (const e of $("dockForm").elements) e.disabled = locked;
  $("dockList").replaceChildren(...S.dock.map((app, i) => {
    const li = el("li", "dockrow"), icon = appButton(app);
    icon.removeAttribute("href");
    icon.className = "dockicon";
    const move = (d) => () => {
      const j = i + d;
      if (j < 0 || j >= S.dock.length) return;
      [S.dock[i], S.dock[j]] = [S.dock[j], S.dock[i]];
      saveDock();
    };
    const iconInput = input(BRAND_ICONS[app.icon] ? "" : app.icon, "", (v) => { app.icon = v; saveDock(); });
    iconInput.placeholder = BRAND_ICONS[app.icon] ? "Built-in icon" : "Site icon";
    li.append(icon,
      input(app.name, "", (v) => { app.name = v || app.name; saveDock(); }),
      input(app.url, "url", (v) => { app.url = normUrl(v); saveDock(); }),
      iconInput,
      btn("↑", move(-1)), btn("↓", move(1)),
      btn("✕", () => { S.dock.splice(i, 1); saveDock(); }, "del"));
    li.querySelectorAll("input, button").forEach((e) => (e.disabled = locked));
    return li;
  }));
  if (!S.dock.length) $("dockList").append(el("li", "empty", "The dock is empty"));
}

for (const app of APP_CATALOG) $("dockCatalog").add(new Option(app.name, app.url));
$("dockCatalog").onchange = (e) => {
  const app = APP_CATALOG.find((a) => a.url === e.target.value);
  e.target.value = "";
  if (!app || S.dockLocked) return;
  S.dock.push({ ...app });
  saveDock();
};
$("dockForm").onsubmit = (e) => {
  e.preventDefault();
  S.dock.push({ name: $("dName").value.trim(), url: normUrl($("dUrl").value.trim()), icon: $("dIcon").value.trim() });
  ["dName", "dUrl", "dIcon"].forEach((id) => ($(id).value = ""));
  saveDock();
};
$("dockLocked").onchange = (e) => save({ dockLocked: e.target.checked }, e.target.checked ? "Dock locked" : "Dock unlocked").then(renderDock);
$("dockVisible").onchange = (e) => save({ dockVisible: e.target.checked });

// ---- Wallpaper ----
let previewVideoKey = "";
async function renderPreview() {
  document.querySelectorAll(".mode").forEach((m) => m.classList.toggle("on", m.dataset.mode === S.wpMode));
  $("dimVal").textContent = S.dim; $("blurVal").textContent = S.blur;
  $("previewDim").style.opacity = S.dim / 100;
  const p = $("preview");
  p.style.filter = `blur(${S.blur / 3}px)`;
  $("motionNote").hidden = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (S.wpMode === "live") {
    p.style.backgroundImage = "none";
    p.querySelector("video")?.remove(); previewVideoKey = "";
    Live.start(p, S.liveScene, { accent: S.accent, quality: S.liveQuality, animate: S.animations });
    return;
  }
  Live.stop();
  let url = null, video = null;
  if (S.wpMode === "daily") url = (await chrome.storage.local.get("wallpaperUrl")).wallpaperUrl;
  else if (S.wpMode === "url") url = S.wpUrl;
  else if (S.wpMode === "file") {
    const f = await getWallpaperFile().catch(() => null);
    video = f?.type.startsWith("video/") ? f : null;
    $("fileStatus").textContent = !f ? "Nothing uploaded yet" : video ? "Video stored ✓" : "Image stored ✓";
    if (f && !video) url = URL.createObjectURL(f);
  }
  // Keep a playing preview video across slider changes; replace it only when the file changes
  const key = video ? "video:" + S.wpFileAt : "";
  if (key !== previewVideoKey) {
    p.querySelector("video")?.remove();
    if (video) showVideo(p, video);
    previewVideoKey = key;
  }
  p.style.backgroundImage = url ? `url("${url}")` : video ? "none" : S.gradient;
}

document.querySelectorAll("[name=wpMode]").forEach((r) => {
  r.onchange = () => save({ wpMode: r.value }).then(renderPreview);
});
for (const [k, name] of Object.entries(LIVE_SCENES)) $("liveScene").add(new Option(name, k));
for (const k of ["liveScene", "liveQuality"]) $(k).onchange = (e) => save({ [k]: e.target.value }).then(renderPreview);
$("wpUrl").onchange = (e) => save({ wpUrl: e.target.value.trim() }).then(renderPreview);
$("gradient").onchange = (e) => save({ gradient: e.target.value.trim() || DEFAULTS.gradient }).then(renderPreview);
$("wpFile").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > 200e6) return toast("File too large (max 200 MB)");
  await putWallpaperFile(f);
  await save({ wpFileAt: Date.now() }, f.type.startsWith("video/") ? "Video uploaded" : "Image uploaded");
  renderPreview();
};
for (const k of ["dim", "blur"]) {
  $(k).oninput = (e) => { S[k] = +e.target.value; renderPreview(); };
  $(k).onchange = (e) => save({ [k]: +e.target.value });
}

// ---- Layout & theme ----
for (const k of ["layout", "cardSize", "cardStyle"]) $(k).onchange = (e) => save({ [k]: e.target.value });
$("accent").onchange = (e) => save({ accent: e.target.value }).then(renderPreview);
$("animations").onchange = (e) => save({ animations: e.target.checked }).then(renderPreview);
$("userName").onchange = (e) => save({ userName: e.target.value.trim() });

for (const [name, t] of Object.entries(THEME_PRESETS)) {
  $("presets").append(btn(name, () => save(t, `Theme “${name}” applied`).then(fillForm), "soft"));
}
$("applyCode").onclick = () => {
  try { save(decodeTheme($("themeCode").value), "Theme applied").then(fillForm); $("themeCode").value = ""; }
  catch { toast("That isn't a valid theme code"); }
};
$("copyCode").onclick = async () => { await navigator.clipboard.writeText(encodeTheme(S)); toast("Theme code copied — share it with anyone"); };
$("replayWelcome").onclick = () => save({ onboarded: false }, "Open a new tab to see the welcome tour", true);

// ---- Widgets ----
document.querySelectorAll("[data-widget]").forEach((c) => {
  c.onchange = () => save({ widgets: { ...S.widgets, [c.dataset.widget]: c.checked } });
});
$("weatherCity").onchange = (e) => save({ weatherCity: e.target.value.trim() });
$("tempUnit").onchange = (e) => save({ tempUnit: e.target.value });
$("zones").onchange = (e) => save({ zones: e.target.value.split(",").map((z) => z.trim()).filter(Boolean) });
$("rssSave").onclick = async () => {
  const raw = $("rssUrl").value.trim();
  if (!raw) return save({ rssUrl: "" }, "Feed removed");
  let url;
  try { url = new URL(normUrl(raw)); } catch { return toast("That isn't a valid URL"); }
  if (!(await requestOrigins([url.origin + "/*"]))) return toast("Access not granted — the feed can't load without it");
  save({ rssUrl: url.href, widgets: { ...S.widgets, rss: true } }, "Feed saved").then(fillForm);
};
$("cryptoCoins").onchange = (e) => save({ cryptoCoins: e.target.value.toLowerCase().split(",").map((c) => c.trim().replace(/\s+/g, "-")).filter(Boolean) });
$("cryptoCurrency").onchange = (e) => save({ cryptoCurrency: e.target.value });
$("githubUser").onchange = (e) => save({ githubUser: e.target.value.trim().replace(/^@/, "") });

// ---- Focus ----
$("showFocus").onchange = (e) => save({ showFocus: e.target.checked });
for (const [k, max] of [["pomoWork", 180], ["pomoBreak", 60]]) {
  $(k).onchange = (e) => {
    const v = Math.min(max, Math.max(1, Math.round(+e.target.value || DEFAULTS[k])));
    e.target.value = v;
    save({ [k]: v });
  };
}
async function saveBlocking(enable) {
  const sites = parseSites($("blockSites").value);
  $("blockSites").value = sites.join("\n");
  if (enable && sites.length && !(await requestOrigins(siteOrigins(sites)))) {
    $("blockDuringFocus").checked = false;
    return toast("Access not granted — sites can't be blocked without it");
  }
  save({ blockSites: sites, blockDuringFocus: enable }, enable ? `Blocking ${sites.length} site(s) during focus` : "Saved");
}
$("blockDuringFocus").onchange = (e) => saveBlocking(e.target.checked);
$("blockSave").onclick = () => { $("blockDuringFocus").checked = true; saveBlocking(true); };

async function showFocusStats() {
  const { focusLog = {} } = await chrome.storage.local.get("focusLog");
  const week = Object.entries(focusLog).filter(([d]) => d >= isoDate(new Date(Date.now() - 6 * 864e5)));
  const sessions = week.reduce((t, [, v]) => t + v.sessions, 0), minutes = week.reduce((t, [, v]) => t + v.minutes, 0);
  $("focusStats").textContent = sessions ? `Last 7 days: ${sessions} focus sessions · ${Math.floor(minutes / 60)} h ${minutes % 60} min` : "No focus sessions logged yet.";
}

// ---- Search, clock & shortcuts ----
for (const k in ENGINES) $("engine").add(new Option(k[0].toUpperCase() + k.slice(1), k));
$("engine").onchange = (e) => save({ engine: e.target.value });
$("suggest").onchange = async (e) => {
  if (e.target.checked && !(await requestOrigins(["https://suggestqueries.google.com/*", "https://duckduckgo.com/*"]))) {
    e.target.checked = false;
    return toast("Access not granted");
  }
  save({ suggest: e.target.checked });
};

// ---- Profiles ----
async function useProfile(name) {
  switchProfile(S, name);
  S.profileAuto = false;
  await save({}, `Switched to ${name || "Main"}`, true);
  fillForm();
}
function renderProfiles() {
  $("profileBanner").hidden = !S.activeProfile;
  $("profileBanner").textContent = `Editing profile “${S.activeProfile}” — links, dock, widgets, layout and background changes apply to this profile.`;
  $("profileAuto").checked = S.profileAuto;
  $("activeProfile").replaceChildren(new Option("Main", ""), ...S.profiles.map((p) => new Option(p.name, p.name)));
  $("activeProfile").value = S.activeProfile;
  $("profileList").replaceChildren(...S.profiles.map((p, i) => {
    const row = el("div", "profile"), days = el("span", "days");
    DAY_NAMES.forEach((d, di) => {
      const l = el("label"), c = el("input");
      c.type = "checkbox"; c.checked = p.days.includes(di);
      c.onchange = () => { p.days = c.checked ? [...p.days, di].sort() : p.days.filter((x) => x !== di); save({ profiles: S.profiles }, "Schedule saved", true); };
      l.append(c, d.slice(0, 2));
      days.append(l);
    });
    const time = (key) => {
      const t = el("input");
      t.type = "time"; t.value = p[key];
      t.onchange = () => { p[key] = t.value || p[key]; save({ profiles: S.profiles }, "Schedule saved", true); };
      return t;
    };
    row.append(el("strong", "", p.name), days, time("from"), el("span", "", "to"), time("to"),
      btn("Delete", async () => {
        if (!confirm(`Delete the profile “${p.name}”?`)) return;
        if (S.activeProfile === p.name) switchProfile(S, "");
        S.profiles.splice(i, 1);
        await save({}, "Profile deleted", true);
        fillForm();
      }, "del"));
    return row;
  }));
}
$("activeProfile").onchange = (e) => useProfile(e.target.value);
$("profileAuto").onchange = async (e) => {
  S.profileAuto = e.target.checked;
  applyProfileSchedule(S);
  await save({}, e.target.checked ? "Switching by schedule" : "Manual profile switching", true);
  fillForm();
};
$("profileForm").onsubmit = (e) => {
  e.preventDefault();
  const name = $("pName").value.trim();
  if (!name || S.profiles.some((p) => p.name === name)) return toast("Pick a new, unique name");
  S.profiles.push({ name, days: [1, 2, 3, 4, 5], from: "09:00", to: "18:00" });
  e.target.reset();
  save({ profiles: S.profiles }, `Profile “${name}” added — it starts as a copy of your current setup`, true).then(renderProfiles);
};
$("clock24").onchange = (e) => save({ clock24: e.target.checked });
$("shortcuts").onchange = (e) => save({ shortcuts: e.target.checked });

// ---- Backup ----
$("export").onclick = () => {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
  const a = el("a");
  a.href = URL.createObjectURL(blob);
  a.download = `customizable-tab-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
};
$("import").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (typeof data !== "object" || !data) throw new Error("not a settings object");
    const s = normalize(data); // also upgrades backups from older versions
    if (!Array.isArray(s.groups)) throw new Error("groups must be an array");
    S = s;
    await save({}, "Backup imported", true);
    fillForm();
  } catch (err) {
    toast("Import failed: " + err.message);
  }
  e.target.value = "";
};

function fillForm() {
  document.querySelector(`[name=wpMode][value=${S.wpMode}]`).checked = true;
  $("wpUrl").value = S.wpUrl; $("gradient").value = S.gradient;
  $("dim").value = S.dim; $("blur").value = S.blur;
  $("engine").value = S.engine; $("clock24").checked = S.clock24; $("shortcuts").checked = S.shortcuts;
  document.querySelectorAll("[data-widget]").forEach((c) => (c.checked = S.widgets[c.dataset.widget]));
  $("weatherCity").value = S.weatherCity; $("tempUnit").value = S.tempUnit;
  $("liveScene").value = S.liveScene; $("liveQuality").value = S.liveQuality;
  $("layout").value = S.layout; $("accent").value = S.accent; $("cardSize").value = S.cardSize;
  $("cardStyle").value = S.cardStyle; $("animations").checked = S.animations; $("userName").value = S.userName;
  $("zones").value = S.zones.join(", ");
  $("dockLocked").checked = S.dockLocked; $("dockVisible").checked = S.dockVisible;
  $("rssUrl").value = S.rssUrl; $("cryptoCoins").value = S.cryptoCoins.join(", ");
  $("cryptoCurrency").value = S.cryptoCurrency; $("githubUser").value = S.githubUser;
  $("showFocus").checked = S.showFocus; $("pomoWork").value = S.pomoWork; $("pomoBreak").value = S.pomoBreak;
  $("blockDuringFocus").checked = S.blockDuringFocus; $("blockSites").value = S.blockSites.join("\n");
  $("suggest").checked = S.suggest;
  renderGroups(); renderDock(); renderProfiles(); renderPreview(); showFocusStats();
}

// ---- Navigation & live preview ----
$("back").onclick = async () => {
  // Reopen Chrome's real new tab (clean address bar); fall back to the extension page directly
  try { const tab = await chrome.tabs.getCurrent(); await chrome.tabs.update(tab.id, { url: "chrome://newtab/" }); }
  catch { location.href = "newtab.html"; }
};
function fitPreview() {
  const box = document.querySelector(".lp-frame"), f = $("lpFrame");
  const k = Math.min(box.clientWidth / 1440, box.clientHeight / 900);
  f.style.transform = `scale(${k})`;
  f.style.left = `${(box.clientWidth - 1440 * k) / 2}px`;
}
$("togglePreview").onclick = () => {
  const open = $("livePreview").hidden;
  $("livePreview").hidden = !open;
  document.body.classList.toggle("split", open);
  $("togglePreview").textContent = open ? "Hide live preview" : "Show live preview";
  if (open && !$("lpFrame").src) $("lpFrame").src = "newtab.html";
  if (open) fitPreview();
};
addEventListener("resize", () => { if (!$("livePreview").hidden) fitPreview(); });

(async () => {
  S = await getSettings();
  showStorage((await chrome.storage.local.get("cfg")).cfg ? "local" : "sync");
  fillForm();
})();
