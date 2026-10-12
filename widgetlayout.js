// Free-form widget layout: widgets float over the dashboard and can be dragged anywhere, resized
// and styled one by one. Rects are stored as percentages of the viewport so a layout adapts to any
// screen size; styles fall back to the global S.widgetStyle unless a widget overrides them.
const WIDGET_FONTS = {
  system: ["System", '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif'],
  display: ["Display", '"Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif'],
  serif: ["Serif", 'Georgia, "Times New Roman", serif'],
  mono: ["Mono", '"Cascadia Code", Consolas, "Courier New", monospace'],
  condensed: ["Condensed", 'Bahnschrift, "Arial Narrow", sans-serif'],
  hand: ["Handwritten", '"Segoe Print", "Comic Sans MS", cursive']
};
const WIDGET_HEIGHT = { todo: 260, notes: 240, pomodoro: 230, quote: 180, calendar: 310, worldclock: 190, rss: 300, countdown: 210, habits: 230, crypto: 190, github: 280 }; // default px
const MIN_W = 170, MIN_H = 80, GRID = 8;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const layoutOf = (id) => (S.widgetLayout[id] ??= {});
const widgetStyleOf = (id) => ({ ...S.widgetStyle, ...S.widgetLayout[id]?.style });
const isEditing = () => document.body.classList.contains("editing");

// Unsaved widgets stack in columns beside the content: right edge first, then the left edge
// (sidebar layout keeps the left side free for its content), then further columns inward
function defaultRects(ids) {
  const W = innerWidth, H = innerHeight, colW = 290, gap = 14, top = 76, out = {};
  const sides = S.layout === "sidebar" ? ["right"] : ["right", "left"];
  const colX = (c) => {
    const k = Math.floor(c / sides.length);
    return sides[c % sides.length] === "right" ? W - 20 - colW - k * (colW + gap) : 20 + k * (colW + gap);
  };
  let col = 0, y = top;
  for (const id of ids) {
    const h = WIDGET_HEIGHT[id] || 220;
    if (y + h > H - 16 && y > top) { y = top; col++; }
    out[id] = { x: (colX(col) / W) * 100, y: (y / H) * 100, w: (colW / W) * 100, h: (h / H) * 100 };
    y += h + gap;
  }
  return out;
}

function placeWidget(w, r) {
  const W = innerWidth, H = innerHeight;
  const pw = clamp((r.w / 100) * W, MIN_W, W), ph = clamp((r.h / 100) * H, MIN_H, H);
  Object.assign(w.style, {
    width: pw + "px", height: ph + "px",
    left: clamp((r.x / 100) * W, 0, W - pw) + "px", top: clamp((r.y / 100) * H, 0, H - ph) + "px",
    zIndex: r.z || 1
  });
}

function paintWidget(w, st) {
  const tint = st.tint === "light" ? [255, 255, 255] : st.tint === "accent" ? hexRgb(S.accent) : [0, 0, 0];
  Object.assign(w.style, {
    background: `rgba(${tint.join(",")},${st.bg / 100})`,
    backdropFilter: st.blur ? `blur(${st.blur}px)` : "none",
    opacity: st.opacity / 100,
    fontFamily: (WIDGET_FONTS[st.font] || WIDGET_FONTS.system)[1],
    fontSize: st.size + "%",
    color: st.color,
    borderRadius: st.radius + "px",
    borderColor: st.border ? "" : "transparent"
  });
}

const repaintWidgets = () => document.querySelectorAll(".widget").forEach((w) => paintWidget(w, widgetStyleOf(w.dataset.id)));
addEventListener("resize", () => {
  const ids = [...document.querySelectorAll(".widget")].map((w) => w.dataset.id), defs = defaultRects(ids);
  document.querySelectorAll(".widget").forEach((w) => placeWidget(w, layoutOf(w.dataset.id).rect || defs[w.dataset.id]));
});

// Positions, paints and (in edit mode) adds the move/resize/style handles to a rendered widget
function decorateWidget(w, id, rect) {
  placeWidget(w, rect);
  paintWidget(w, widgetStyleOf(id));
  if (!isEditing()) return;
  const shield = el("div", "wshield"), tools = el("div", "wtools"), grip = el("div", "wresize");
  shield.title = "Drag to move";
  grip.title = "Drag to resize";
  shield.onpointerdown = (e) => dragWidget(e, w, id, "move");
  grip.onpointerdown = (e) => dragWidget(e, w, id, "resize");
  tools.append(
    iconBtn("⚙", "Style this widget", () => openWidgetPanel(id, w)),
    iconBtn("✕", "Hide this widget", () => set({ widgets: { ...S.widgets, [id]: false } })));
  w.append(shield, tools, grip);
}

function dragWidget(e, w, id, mode) {
  if (e.button !== 0) return;
  e.preventDefault();
  closeWidgetPanel();
  const W = innerWidth, H = innerHeight, sx = e.clientX, sy = e.clientY, b = w.getBoundingClientRect();
  const z = Math.max(1, ...Object.values(S.widgetLayout).map((l) => l.rect?.z || 0)) + 1;
  const snap = (v) => Math.round(v / GRID) * GRID;
  w.style.zIndex = z;
  w.classList.add("dragging");
  const move = (ev) => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (mode === "move") {
      w.style.left = clamp(snap(b.left + dx), 0, W - b.width) + "px";
      w.style.top = clamp(snap(b.top + dy), 0, H - b.height) + "px";
    } else {
      w.style.width = clamp(snap(b.width + dx), MIN_W, W - b.left) + "px";
      w.style.height = clamp(snap(b.height + dy), MIN_H, H - b.top) + "px";
    }
  };
  const up = () => {
    removeEventListener("pointermove", move);
    removeEventListener("pointerup", up);
    w.classList.remove("dragging");
    const r = w.getBoundingClientRect();
    layoutOf(id).rect = { x: (r.left / W) * 100, y: (r.top / H) * 100, w: (r.width / W) * 100, h: (r.height / H) * 100, z };
    persist();
  };
  addEventListener("pointermove", move);
  addEventListener("pointerup", up);
}

// ---- Edit mode ----
function toggleEdit(on = !isEditing()) {
  document.body.classList.toggle("editing", on);
  if (on) document.body.classList.remove("zen");
  closeWidgetPanel();
  renderWidgets();
}

function renderEditBar() {
  const bar = $("editbar");
  bar.hidden = !isEditing();
  if (bar.hidden) return;
  const chips = el("div", "chips");
  for (const [id, [name]] of Object.entries(WIDGETS)) {
    const c = el("button", S.widgets[id] ? "on" : "", (S.widgets[id] ? "✓ " : "+ ") + name);
    c.onclick = () => set({ widgets: { ...S.widgets, [id]: !S.widgets[id] } });
    chips.append(c);
  }
  const reset = el("button", "", "Reset positions");
  reset.onclick = () => { for (const l of Object.values(S.widgetLayout)) delete l.rect; persist(); renderWidgets(); };
  const styleAll = el("button", "", "Style all");
  styleAll.onclick = () => openWidgetPanel(null, styleAll);
  const done = el("button", "primary", "Done");
  done.onclick = () => toggleEdit(false);
  bar.replaceChildren(el("span", "hint", "Drag to move · corner to resize · ⚙ to style"), chips, styleAll, reset, done);
}

// ---- Style panel (one widget, or every widget when id is null) ----
function styleControls(st, live, commit) {
  const row = (label, input, val) => { const l = el("label", "ctl"); l.append(el("span", "", label), input); if (val) l.append(val); return l; };
  const range = (label, key, min, max, unit) => {
    const i = el("input"), val = el("small", "", st[key] + unit);
    Object.assign(i, { type: "range", min, max, value: st[key] });
    i.oninput = () => { st[key] = +i.value; val.textContent = i.value + unit; live(); };
    i.onchange = commit;
    return row(label, i, val);
  };
  const select = (label, key, options) => {
    const s = el("select");
    for (const [v, n] of options) s.add(new Option(n, v));
    s.value = st[key];
    s.onchange = () => { st[key] = s.value; live(); commit(); };
    return row(label, s);
  };
  const color = (label, key) => {
    const i = el("input");
    Object.assign(i, { type: "color", value: st[key] });
    i.oninput = () => { st[key] = i.value; live(); };
    i.onchange = commit;
    return row(label, i);
  };
  const check = (label, key) => {
    const i = el("input");
    Object.assign(i, { type: "checkbox", checked: st[key] });
    i.onchange = () => { st[key] = i.checked; live(); commit(); };
    return row(label, i);
  };
  return [
    range("Background", "bg", 0, 95, "%"),
    select("Tint", "tint", [["dark", "Dark"], ["light", "Light"], ["accent", "Accent"]]),
    range("Blur", "blur", 0, 40, "px"),
    range("Opacity", "opacity", 15, 100, "%"),
    select("Font", "font", Object.entries(WIDGET_FONTS).map(([k, [n]]) => [k, n])),
    range("Text size", "size", 70, 170, "%"),
    color("Text color", "color"),
    range("Corners", "radius", 0, 32, "px"),
    check("Border", "border")
  ];
}

function openWidgetPanel(id, anchor) {
  const p = $("wpanel");
  const st = id ? widgetStyleOf(id) : S.widgetStyle;
  const sync = () => { if (id) layoutOf(id).style = { ...st }; };
  const head = el("h3", "", id ? `${WIDGETS[id][0]} style` : "All widgets");
  head.append(iconBtn("✕", "Close", closeWidgetPanel));
  const actions = el("div", "actions");
  if (id) {
    const all = el("button", "", "Apply to all");
    all.onclick = () => {
      S.widgetStyle = { ...st };
      for (const l of Object.values(S.widgetLayout)) delete l.style;
      persist(); repaintWidgets(); closeWidgetPanel();
    };
    const reset = el("button", "", "Reset");
    reset.onclick = () => { delete layoutOf(id).style; persist(); repaintWidgets(); openWidgetPanel(id, anchor); };
    actions.append(all, reset);
  } else {
    actions.append(el("small", "", "Widgets with their own style keep it — use Reset on them to follow these."));
  }
  p.replaceChildren(head, ...styleControls(st, () => { sync(); repaintWidgets(); }, () => { sync(); persist(); }), actions);
  p.hidden = false;
  const a = anchor.getBoundingClientRect(), pw = p.offsetWidth, ph = p.offsetHeight;
  p.style.left = clamp(a.right + 12 + pw > innerWidth ? a.left - pw - 12 : a.right + 12, 8, innerWidth - pw - 8) + "px";
  p.style.top = clamp(a.top, 8, innerHeight - ph - 8) + "px";
}
const closeWidgetPanel = () => { $("wpanel").hidden = true; };
