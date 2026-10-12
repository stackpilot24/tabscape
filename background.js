// Background service worker: ends Pomodoro sessions on time (even with no tab open), blocks
// distracting sites while a focus session runs, prefetches the daily photo just after midnight,
// and opens the welcome tour after install.
if (typeof importScripts === "function") importScripts("apps.js", "shared.js"); // Firefox loads them via manifest scripts

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.tabs.create({}); // a new tab shows the dashboard and its welcome tour
  scheduleDaily();
});

// Daily photo: refresh the list at 00:01 local time and warm the HTTP cache with the first image,
// so the first new tab of the day opens instantly
function scheduleDaily() {
  const n = new Date();
  chrome.alarms.create("daily", { when: new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 1).getTime() });
}
async function prefetchDaily() {
  const s = await getSettings();
  if (s.wpMode !== "daily") return;
  const [first] = await dailyList(s);
  if (first) await fetch(first.url, { mode: "no-cors" }).catch(() => {});
}

const focusActive = (pomo) => pomo?.mode === "work" && pomo.endsAt > Date.now();
const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };
const isBlocked = (s, url) => { const h = hostOf(url); return s.blockSites.some((b) => h === b || h.endsWith("." + b)); };
const blockedPage = (url) => chrome.runtime.getURL(`blocked.html?u=${encodeURIComponent(url)}`);

async function syncAlarm(pomo) {
  await chrome.alarms.clear("pomo");
  if (pomo?.endsAt) chrome.alarms.create("pomo", { when: pomo.endsAt });
}

chrome.runtime.onStartup.addListener(async () => {
  scheduleDaily();
  syncAlarm((await chrome.storage.local.get("pomo")).pomo);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "daily") { scheduleDaily(); await prefetchDaily(); return; }
  if (alarm.name !== "pomo") return;
  const { pomo } = await chrome.storage.local.get("pomo");
  if (pomo?.endsAt && pomo.endsAt <= Date.now() + 1000) await finishPomo(await getSettings(), pomo.endsAt);
});

// Tabs only report URLs for sites the user granted access to — exactly the blocked list
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (!info.url || !/^https?:/.test(info.url)) return;
  const [{ pomo }, s] = await Promise.all([chrome.storage.local.get("pomo"), getSettings()]);
  if (s.blockDuringFocus && focusActive(pomo) && isBlocked(s, info.url)) chrome.tabs.update(tabId, { url: blockedPage(info.url) });
});

// Keep the end-of-session alarm in step with the timer, and when a focus session starts,
// also catch tabs that are already open on blocked sites
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local" || !changes.pomo) return;
  const pomo = changes.pomo.newValue;
  await syncAlarm(pomo);
  if (!focusActive(pomo)) return;
  const s = await getSettings();
  if (!s.blockDuringFocus || !s.blockSites.length) return;
  const tabs = await chrome.tabs.query({ url: siteOrigins(s.blockSites) }).catch(() => []);
  for (const t of tabs) if (isBlocked(s, t.url)) chrome.tabs.update(t.id, { url: blockedPage(t.url) });
});
