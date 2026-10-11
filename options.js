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
async function save(patch, msg = "Saved", keepWidgetData = false) {
  // To-dos and notes are edited on the new tab page; don't clobber them with stale copies
  if (!keepWidgetData) {
    const latest = await getSettings();
    S.todos = latest.todos; S.notes = latest.notes;
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

// ---- Wallpaper ----
async function renderPreview() {
  document.querySelectorAll(".mode").forEach((m) => m.classList.toggle("on", m.dataset.mode === S.wpMode));
  $("dimVal").textContent = S.dim; $("blurVal").textContent = S.blur;
  $("previewDim").style.opacity = S.dim / 100;
  const p = $("preview");
  p.style.filter = `blur(${S.blur / 3}px)`;
  let url = null;
  if (S.wpMode === "daily") url = (await chrome.storage.local.get("wallpaperUrl")).wallpaperUrl;
  else if (S.wpMode === "url") url = S.wpUrl;
  else if (S.wpMode === "file") {
    const f = await getWallpaperFile().catch(() => null);
    $("fileStatus").textContent = f ? "Image stored ✓" : "No image uploaded";
    if (f) url = URL.createObjectURL(f);
  }
  p.style.backgroundImage = url ? `url("${url}")` : S.gradient;
}

document.querySelectorAll("[name=wpMode]").forEach((r) => {
  r.onchange = () => save({ wpMode: r.value }).then(renderPreview);
});
$("wpUrl").onchange = (e) => save({ wpUrl: e.target.value.trim() }).then(renderPreview);
$("gradient").onchange = (e) => save({ gradient: e.target.value.trim() || DEFAULTS.gradient }).then(renderPreview);
$("wpFile").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  await putWallpaperFile(f);
  toast("Image uploaded"); renderPreview();
};
for (const k of ["dim", "blur"]) {
  $(k).oninput = (e) => { S[k] = +e.target.value; renderPreview(); };
  $(k).onchange = (e) => save({ [k]: +e.target.value });
}

// ---- Widgets ----
document.querySelectorAll("[data-widget]").forEach((c) => {
  c.onchange = () => save({ widgets: { ...S.widgets, [c.dataset.widget]: c.checked } });
});
$("weatherCity").onchange = (e) => save({ weatherCity: e.target.value.trim() });
$("tempUnit").onchange = (e) => save({ tempUnit: e.target.value });

// ---- Search, clock & shortcuts ----
for (const k in ENGINES) $("engine").add(new Option(k[0].toUpperCase() + k.slice(1), k));
$("engine").onchange = (e) => save({ engine: e.target.value });
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
  renderGroups(); renderPreview();
}

(async () => {
  S = await getSettings();
  showStorage((await chrome.storage.local.get("cfg")).cfg ? "local" : "sync");
  fillForm();
})();
