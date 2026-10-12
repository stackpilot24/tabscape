// Profiles (e.g. Work / Personal): each keeps its own links, dock, widgets, layout and background.
// The live settings always hold the active profile's values, so every editor keeps working
// unchanged; switching stores the current values back and loads the other profile's.
const PROFILE_KEYS = ["groups", "dock", "widgets", "widgetLayout", "layout", "wpMode", "liveScene", "accent"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Name of the profile whose schedule covers `now`, or "" for the main setup
function scheduledProfile(s, now = new Date()) {
  const day = now.getDay(), hm = now.toTimeString().slice(0, 5);
  const inWindow = (p) => (p.from <= p.to ? hm >= p.from && hm < p.to : hm >= p.from || hm < p.to); // overnight windows wrap
  return s.profiles.find((p) => p.days.includes(day) && inWindow(p))?.name || "";
}

// Mutates `s`; returns false when nothing changed. A profile with no saved data starts as a copy
// of the current setup.
function switchProfile(s, name) {
  if (s.activeProfile === name || (name && !s.profiles.some((p) => p.name === name))) return false;
  const snapshot = Object.fromEntries(PROFILE_KEYS.map((k) => [k, structuredClone(s[k])]));
  if (s.activeProfile) {
    const cur = s.profiles.find((p) => p.name === s.activeProfile);
    if (cur) cur.data = snapshot;
  } else {
    s.mainData = snapshot;
  }
  const target = name ? s.profiles.find((p) => p.name === name).data : s.mainData;
  if (target) Object.assign(s, structuredClone(target));
  if (!name) delete s.mainData;
  s.activeProfile = name;
  return true;
}

// Applies the schedule when automatic switching is on; returns true if the profile changed
function applyProfileSchedule(s) {
  return s.profileAuto && s.profiles.length > 0 && switchProfile(s, scheduledProfile(s));
}
