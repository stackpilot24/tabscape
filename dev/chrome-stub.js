// Dev-only stand-in for the chrome.* APIs the extension uses, backed by localStorage so the pages
// run at http://localhost. Changes made in one tab fire chrome.storage.onChanged in the others.
(() => {
  const listeners = [];
  const read = (area) => JSON.parse(localStorage.getItem("chrome." + area) || "{}");
  const write = (area, all, changes) => {
    localStorage.setItem("chrome." + area, JSON.stringify(all));
    if (Object.keys(changes).length) listeners.forEach((fn) => fn(changes, area)); // same tab
  };
  const area = (name) => ({
    async get(keys) {
      const all = read(name);
      if (keys == null) return all;
      const list = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
      return Object.fromEntries(list.filter((k) => k in all).map((k) => [k, all[k]]));
    },
    async set(items) {
      const all = read(name), changes = {};
      for (const [k, v] of Object.entries(items)) { changes[k] = { oldValue: all[k], newValue: v }; all[k] = v; }
      write(name, all, changes);
    },
    async remove(keys) {
      const all = read(name), changes = {};
      for (const k of [].concat(keys)) if (k in all) { changes[k] = { oldValue: all[k] }; delete all[k]; }
      write(name, all, changes);
    }
  });
  // Other tabs: diff the stored snapshot and replay it as chrome.storage.onChanged
  addEventListener("storage", (e) => {
    const m = /^chrome\.(local|sync)$/.exec(e.key || "");
    if (!m) return;
    const before = JSON.parse(e.oldValue || "{}"), after = JSON.parse(e.newValue || "{}"), changes = {};
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)]))
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changes[k] = { oldValue: before[k], newValue: after[k] };
    if (Object.keys(changes).length) listeners.forEach((fn) => fn(changes, m[1]));
  });
  window.chrome = {
    storage: { local: area("local"), sync: area("sync"), onChanged: { addListener: (fn) => listeners.push(fn) } },
    tabs: { getCurrent: async () => { throw new Error("chrome.tabs is unavailable on localhost"); } },
    // Optional permissions can't be granted outside the extension; features degrade gracefully
    permissions: { contains: async () => false, request: async () => false }
  };
})();
