// "Stay focused" page shown instead of a blocked site; offers the site again once the session ends
const target = new URLSearchParams(location.search).get("u") || "";
const $ = (id) => document.getElementById(id);
let pomo = null;

try { $("site").textContent = new URL(target).hostname.replace(/^www\./, ""); } catch { $("site").textContent = "This site"; }

function render() {
  const left = pomo?.mode === "work" && pomo.endsAt ? Math.max(0, pomo.endsAt - Date.now()) : 0;
  const s = Math.ceil(left / 1000);
  $("left").textContent = left ? `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : "Session over 🎉";
  $("go").hidden = left > 0 || !/^https?:/.test(target);
  $("go").href = target;
}

(async () => {
  const [settings, local] = await Promise.all([getSettings(), chrome.storage.local.get("pomo")]);
  pomo = local.pomo;
  document.documentElement.style.setProperty("--accent", settings.accent);
  if (settings.focus.text && settings.focus.date === isoDate()) {
    $("focus").hidden = false;
    $("focus").textContent = `Today's focus: “${settings.focus.text}”`;
  }
  render();
  setInterval(render, 1000);
  chrome.storage.onChanged.addListener((c, area) => { if (area === "local" && c.pomo) { pomo = c.pomo.newValue; render(); } });
})();
