// Dashboard widgets. Each builder returns a .widget element; renderWidgets() places them via widgetlayout.js.
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

// Pomodoro: shared state in chrome.storage.local; the background ends sessions on time even with no tab open
let pomo = null, focusToday = { sessions: 0, minutes: 0 };
const pomoLeft = () => (pomo.endsAt ? Math.max(0, pomo.endsAt - Date.now()) : pomo.remaining);
const setPomo = (p) => { pomo = p; chrome.storage.local.set({ pomo }); updatePomo(); };
const resetPomo = () => setPomo({ mode: "work", endsAt: null, remaining: pomoLength(S, "work") });

function pomoWidget() {
  const w = widgetBox("Pomodoro", "pomo");
  const row = el("div", "row");
  const start = el("button", "", "Start");
  start.id = "pomoBtn";
  start.onclick = () => setPomo(pomo.endsAt
    ? { ...pomo, endsAt: null, remaining: pomoLeft() }
    : { ...pomo, endsAt: Date.now() + pomo.remaining });
  row.append(start, iconBtn("Reset", "Reset to a new focus session", resetPomo));
  const time = el("div", "pomo-time"); time.id = "pomoTime";
  const label = el("div", "pomo-label"); label.id = "pomoLabel";
  const bar = el("div", "pomo-bar"), fill = el("i");
  fill.id = "pomoBar"; bar.append(fill);
  const stats = el("div", "pomo-stats"); stats.id = "pomoStats";
  w.append(time, label, bar, row, stats);
  return w;
}

function updatePomo() {
  if (!$("pomoTime") || !pomo) return;
  const left = pomoLeft();
  if (pomo.endsAt && left === 0) {
    document.title = pomo.mode === "work" ? "⏰ Break time!" : "⏰ Back to work!";
    finishPomo(S, pomo.endsAt);
  }
  const s = Math.ceil(left / 1000), total = pomoLength(S, pomo.mode);
  $("pomoTime").textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  $("pomoLabel").textContent = (pomo.mode === "work" ? "Focus" : "Break") + (pomo.endsAt && pomo.mode === "work" && S.blockDuringFocus && S.blockSites.length ? " · sites blocked" : "");
  $("pomoBtn").textContent = pomo.endsAt ? "Pause" : "Start";
  $("pomoBar").style.width = `${Math.min(100, (1 - left / total) * 100)}%`;
  $("pomoStats").textContent = focusToday.sessions ? `Today: ${focusToday.sessions} session${focusToday.sessions > 1 ? "s" : ""} · ${focusToday.minutes} min` : "";
}

async function loadPomo() {
  const d = await chrome.storage.local.get(["pomo", "focusLog"]);
  pomo = d.pomo || { mode: "work", endsAt: null, remaining: pomoLength(S, "work") };
  focusToday = d.focusLog?.[isoDate()] || { sessions: 0, minutes: 0 };
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

// Fetch JSON/text with a cache in chrome.storage.local, so opening tabs doesn't hammer the APIs
async function cached(key, ttlMs, load) {
  const { [key]: c } = await chrome.storage.local.get(key);
  if (c && Date.now() - c.at < ttlMs) return c.data;
  try {
    const data = await load();
    await chrome.storage.local.set({ [key]: { at: Date.now(), data } });
    return data;
  } catch (err) {
    if (c) return c.data; // stale beats nothing
    throw err;
  }
}
const message = (text) => el("div", "wmsg", text);
const extLink = (text, href) => { const a = el("a", "", text); a.href = href; return a; };

// RSS / Atom headlines. Needs host access to the feed's site, granted in settings.
function rssWidget() {
  const w = widgetBox("News");
  const list = el("ul", "feed");
  w.append(list);
  if (!S.rssUrl) { list.append(message("Add a feed URL in settings → Widgets.")); return w; }
  const origin = new URL(S.rssUrl).origin + "/*";
  (async () => {
    if (!(await hasOrigins([origin]))) { list.replaceChildren(message("Allow access to this feed in settings → Widgets.")); return; }
    try {
      const items = await cached("rssCache:" + S.rssUrl, 30 * 60e3, async () => {
        const xml = new DOMParser().parseFromString(await (await fetch(S.rssUrl)).text(), "text/xml");
        const title = xml.querySelector("channel > title, feed > title")?.textContent.trim();
        const entries = [...xml.querySelectorAll("item, entry")].slice(0, 12).map((it) => ({
          t: it.querySelector("title")?.textContent.trim() || "(untitled)",
          u: it.querySelector("link")?.getAttribute("href") || it.querySelector("link")?.textContent.trim() || ""
        }));
        return { title, entries };
      });
      if (items.title) w.querySelector("h4").firstChild.textContent = items.title;
      list.replaceChildren(...items.entries.filter((e) => /^https?:/.test(e.u)).map((e) => { const li = el("li"); li.append(extLink(e.t, e.u)); return li; }));
    } catch (err) {
      console.error("RSS failed:", err);
      list.replaceChildren(message("Couldn't load this feed."));
    }
  })();
  return w;
}

function countdownWidget() {
  const w = widgetBox("Countdown");
  const list = el("div", "countdowns"), today = new Date(isoDate() + "T00:00");
  S.countdowns.sort((a, b) => a.date.localeCompare(b.date)).forEach((c, i) => {
    const days = Math.round((new Date(c.date + "T00:00") - today) / 864e5);
    const row = el("div", "cd");
    row.append(el("span", "", c.name),
      el("strong", "", days > 1 ? `${days} days` : days === 1 ? "Tomorrow" : days === 0 ? "Today 🎉" : `${-days}d ago`),
      iconBtn("✕", "Remove", () => { S.countdowns.splice(i, 1); persist(); renderWidgets(); }));
    list.append(row);
  });
  const form = el("form", "cd-add"), name = el("input"), date = el("input");
  name.placeholder = "Event"; name.required = true;
  date.type = "date"; date.required = true;
  form.append(name, date, el("button", "", "+"));
  form.onsubmit = (e) => {
    e.preventDefault();
    S.countdowns.push({ name: name.value.trim(), date: date.value });
    persist(); renderWidgets();
  };
  w.append(list, form);
  return w;
}

function habitsWidget() {
  const w = widgetBox("Habits");
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return isoDate(d); });
  const table = el("div", "habits");
  S.habits.forEach((h, i) => {
    const row = el("div", "habit");
    const streak = (() => { let n = 0; const d = new Date(); if (!h.days[isoDate(d)]) d.setDate(d.getDate() - 1); while (h.days[isoDate(d)]) { n++; d.setDate(d.getDate() - 1); } return n; })();
    const name = el("span", "", h.name);
    name.title = "Double-click to remove";
    name.ondblclick = () => { S.habits.splice(i, 1); persist(); renderWidgets(); };
    const dots = el("span", "dots");
    for (const d of days) {
      const b = el("button", h.days[d] ? "on" : "");
      b.title = d + (d === days[6] ? " (today)" : "");
      b.onclick = () => { if (h.days[d]) delete h.days[d]; else h.days[d] = true; persist(); renderWidgets(); };
      dots.append(b);
    }
    // keep only the last ~2 months of history so synced settings stay small
    for (const k of Object.keys(h.days)) if (k < isoDate(new Date(Date.now() - 62 * 864e5))) delete h.days[k];
    row.append(name, dots, el("small", "", streak ? `🔥${streak}` : ""));
    table.append(row);
  });
  const add = el("input");
  add.placeholder = "New habit, press Enter (double-click a name to remove)";
  add.onkeydown = (e) => {
    if (e.key !== "Enter" || !add.value.trim()) return;
    S.habits.push({ name: add.value.trim(), days: {} });
    persist(); renderWidgets();
  };
  w.append(table, add);
  return w;
}

// Prices from CoinGecko's public API (no key; cached 5 minutes)
function cryptoWidget() {
  const w = widgetBox("Crypto");
  const list = el("div", "crypto");
  w.append(list);
  const coins = S.cryptoCoins.filter(Boolean), cur = S.cryptoCurrency || "usd";
  if (!coins.length) { list.append(message("Pick coins in settings → Widgets.")); return w; }
  (async () => {
    try {
      const data = await cached(`cryptoCache:${coins}:${cur}`, 5 * 60e3, () =>
        getJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coins.join(","))}&vs_currencies=${cur}&include_24hr_change=true`));
      const fmt = new Intl.NumberFormat([], { style: "currency", currency: cur.toUpperCase(), maximumFractionDigits: 2 });
      list.replaceChildren(...coins.filter((c) => data[c]).map((c) => {
        const ch = data[c][`${cur}_24h_change`] || 0, row = el("div", "coin");
        row.append(el("span", "", c[0].toUpperCase() + c.slice(1)), el("strong", "", fmt.format(data[c][cur])),
          el("small", ch >= 0 ? "up" : "down", `${ch >= 0 ? "▲" : "▼"} ${Math.abs(ch).toFixed(1)}%`));
        return row;
      }));
    } catch (err) {
      console.error("Crypto failed:", err);
      list.replaceChildren(message("Prices unavailable right now."));
    }
  })();
  return w;
}

// Recent public activity from the GitHub API (no key; cached 15 minutes)
function githubWidget() {
  const w = widgetBox("GitHub");
  const list = el("ul", "feed");
  w.append(list);
  const user = S.githubUser.trim();
  if (!user) { list.append(message("Add your GitHub username in settings → Widgets.")); return w; }
  w.querySelector("h4").firstChild.textContent = "GitHub · " + user;
  const verb = { PushEvent: "Pushed to", PullRequestEvent: "Pull request in", IssuesEvent: "Issue in", WatchEvent: "Starred",
                 CreateEvent: "Created", ForkEvent: "Forked", IssueCommentEvent: "Commented in", ReleaseEvent: "Released" };
  (async () => {
    try {
      const events = await cached("githubCache:" + user, 15 * 60e3, async () =>
        (await getJSON(`https://api.github.com/users/${encodeURIComponent(user)}/events/public?per_page=20`))
          .map((e) => ({ type: e.type, repo: e.repo.name, at: e.created_at })));
      if (!events.length) { list.replaceChildren(message("No recent public activity.")); return; }
      list.replaceChildren(...events.slice(0, 8).map((e) => {
        const li = el("li");
        li.append(document.createTextNode((verb[e.type] || e.type.replace("Event", "")) + " "), extLink(e.repo, "https://github.com/" + e.repo),
          el("small", "", " · " + new Date(e.at).toLocaleDateString([], { month: "short", day: "numeric" })));
        return li;
      }));
    } catch (err) {
      console.error("GitHub failed:", err);
      list.replaceChildren(message("Couldn't load GitHub activity."));
    }
  })();
  return w;
}

const WIDGETS = {
  todo: ["To-do", todoWidget], notes: ["Notes", notesWidget], pomodoro: ["Pomodoro", pomoWidget],
  quote: ["Quote", quoteWidget], calendar: ["Calendar", calendarWidget], worldclock: ["World clock", worldClockWidget],
  rss: ["News", rssWidget], countdown: ["Countdown", countdownWidget], habits: ["Habits", habitsWidget],
  crypto: ["Crypto", cryptoWidget], github: ["GitHub", githubWidget]
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

