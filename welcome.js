// First-run welcome: name, look, dock apps, links, layout & widgets. Each choice applies live behind
// the overlay; "Skip setup" keeps the defaults. It can be reopened from the command palette.
function showWelcome() {
  const box = $("welcome");
  let step = 0;

  const chip = (label, on, onClick) => { const b = el("button", "wchip" + (on ? " on" : ""), label); b.onclick = onClick; return b; };
  const rerender = () => render();

  const steps = [
    () => {
      const name = el("input");
      name.placeholder = "Your name (optional)"; name.value = S.userName; name.maxLength = 30;
      name.oninput = () => { S.userName = name.value.trim(); tick(); };
      name.onchange = persist;
      setTimeout(() => name.focus(), 50);
      return [el("h2", "", "Welcome 👋"), el("p", "", "Let's make this new tab yours — it takes about 30 seconds. What should we call you?"), name];
    },
    () => {
      const grid = el("div", "wthemes");
      for (const [name, t] of Object.entries(THEME_PRESETS)) {
        const on = S.wpMode === t.wpMode && (t.wpMode !== "live" || S.liveScene === t.liveScene) && S.accent === t.accent;
        const b = el("button", "wtheme scene " + (t.liveScene || "galaxy") + (on ? " on" : ""), name);
        if (t.wpMode === "daily") b.style.background = "linear-gradient(135deg, #f6d365, #fda085 50%, #5b8def)";
        b.onclick = () => { set(t); rerender(); };
        grid.append(b);
      }
      return [el("h2", "", "Pick a look"), el("p", "", "Animated 3D scenes or a fresh photo every day. You can change everything later with the Customize button."), grid];
    },
    () => {
      const grid = el("div", "wapps");
      for (const app of APP_CATALOG) {
        const i = S.dock.findIndex((d) => d.url === app.url), b = el("button", "wapp" + (i >= 0 ? " on" : ""));
        b.append(appButton(app), el("span", "", app.name));
        b.querySelector("a").removeAttribute("href");
        b.onclick = () => {
          if (i >= 0) S.dock.splice(i, 1);
          else if (S.dock.length < 8) S.dock.push({ ...app });
          persist(); renderDock(); rerender();
        };
        grid.append(b);
      }
      return [el("h2", "", "Your app dock"), el("p", "", `Pick up to 8 apps for the bar at the bottom — ${S.dock.length}/8 chosen.`), grid];
    },
    () => {
      const status = el("p", "wstatus");
      const isExample = JSON.stringify(S.groups) === JSON.stringify(DEFAULTS.groups);
      const importer = (kind, label) => chip(label, false, async () => {
        try {
          const groups = await importBrowserLinks(kind);
          const n = groups.reduce((t, g) => t + g.links.length, 0);
          if (!n) { status.textContent = "Nothing to import there yet."; return; }
          set({ groups: isExample ? groups : [...S.groups, ...groups] });
          status.textContent = `Imported ${n} links ✓`;
        } catch (err) {
          status.textContent = err.message === "permission denied" ? "No problem — you can import later in settings." : "Import isn't available here.";
        }
      });
      const row = el("div", "wrow");
      row.append(importer("bookmarks", "⭐ Import bookmarks bar"), importer("topSites", "🔥 Import most visited"));
      return [el("h2", "", "Bring your links"), el("p", "", "Turn your bookmarks bar or most-visited sites into one-click cards. Chrome will ask for permission once."), row, status];
    },
    () => {
      const layouts = el("div", "wrow");
      for (const [k, n] of [["centered", "Centered"], ["sidebar", "Sidebar"], ["minimal", "Minimal"]]) {
        layouts.append(chip(n, S.layout === k, () => { set({ layout: k }); rerender(); }));
      }
      const widgets = el("div", "wrow");
      for (const id of ["weather", "todo", "pomodoro", "calendar", "habits", "quote", "countdown", "notes"]) {
        const name = id === "weather" ? "Weather" : WIDGETS[id][0];
        widgets.append(chip(name, S.widgets[id], () => { set({ widgets: { ...S.widgets, [id]: !S.widgets[id] } }); rerender(); }));
      }
      const focus = chip("🎯 Daily main focus", S.showFocus, () => { set({ showFocus: !S.showFocus }); rerender(); });
      return [el("h2", "", "Layout & widgets"), el("p", "", "Widgets float on the dashboard — press E anytime to drag, resize and restyle them."),
        el("h3", "", "Layout"), layouts, el("h3", "", "Widgets"), widgets, focus];
    }
  ];

  const finish = () => { box.hidden = true; set({ onboarded: true }); };

  function render() {
    const card = el("div", "wcard"), dots = el("div", "wdots"), nav = el("div", "wnav");
    steps.forEach((_, i) => dots.append(el("i", i === step ? "on" : "")));
    const skip = el("button", "ghost", "Skip setup");
    skip.onclick = finish;
    const back = el("button", "ghost", "Back");
    back.hidden = step === 0;
    back.onclick = () => { step--; render(); };
    const last = step === steps.length - 1, next = el("button", "primary", last ? "Start using it →" : "Next");
    next.onclick = () => { if (last) finish(); else { step++; render(); } };
    nav.append(skip, el("span", "grow"), back, next);
    card.append(dots, ...steps[step](), nav);
    box.replaceChildren(card);
    box.hidden = false;
  }
  render();
}
