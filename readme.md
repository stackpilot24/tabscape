# Customizable TAB (Chrome Extension)

A minimal, fast, and feature-rich New Tab replacement for Google Chrome. Turn your browser start page into an organized dashboard with direct-launch quick links, automated daily 4K wallpapers, an integrated search bar, and a dedicated backend Admin Panel to keep configuration separate from your daily view.

---

## 🌟 Key Features

### 1. Main View (The Dashboard)
- **Direct-Launch Bookmark Grid:** High-res bookmark cards that open your exact deep links (Notion workspaces, GitHub repositories, Slack channels, internal analytics dashboards) without multi-step navigation.
- **Auto-Resolution Favicons:** Automatically fetches high-definition 128px favicons for any added URL using Google's favicon engine, with support for custom icon URLs or emoji badges.
- **Dynamic Daily Wallpapers (12:00 AM Midnight Trigger):**
  - Switches automatically to a fresh, curated 4K photo every midnight.
  - Supports automatic Bing daily landscape archive caching or Unsplash daily photo streams.
  - Stores the image locally in `chrome.storage.local` to prevent network lag or screen flicker on new tab opens.
- **Smart Universal Search:**
  - Fast search bar centered on the screen.
  - Multi-engine toggle: Search using Google, DuckDuckGo, Bing, Brave, or Ecosia directly.
  - Direct URL detection: Typing a valid domain navigates immediately without searching.
- **Minimalist Top Bar:**
  - Real-time digital clock (toggleable 12h/24h) and live date display.
  - Discrete Admin settings gear (`⚙`) that launches the backend management panel.

### 2. Backend Admin Panel (`options.html`)
- **Link & Bookmark Manager:**
  - Add links with three simple inputs: **Label / Title**, **Direct URL**, and optional **Custom Icon / Emoji**.
  - Reorder links with drag-and-drop or up/down priority controls.
  - In-place editing and deletion.
- **Wallpaper & Display Customizer:**
  - Wallpaper Modes:
    1. *Auto-Daily (Midnight Rotation)*
    2. *Custom Web URL*
    3. *Local File Upload (IndexedDB storage)*
    4. *Solid / Minimalist CSS Gradient*
  - Readability Sliders: Adjust background dimness ($0\% - 80\%$) and blur ($0\text{px} - 25\text{px}$) to maintain high text contrast on any wallpaper.
- **Search Engine Selector:** Pick your default search provider for the center bar.
- **Backup & Portability:**
  - Export all links, layouts, and preferences to a `.json` file.
  - Import `.json` backup to sync across other computers or browsers.

---

## 📂 Architecture & File Structure

```text
customizable-tab/
├── manifest.json         # Manifest V3 (name/description come from _locales)
├── _locales/{en,hi}/     # Store name & description (English, Hindi)
├── newtab.html/.css/.js  # Dashboard: links, dock, search + suggestions, focus line, palette, drawer
├── widgets.js            # All widgets (to-do, notes, pomodoro, calendar, RSS, habits, crypto, …)
├── widgetlayout.js       # Drag / resize / per-widget styling
├── welcome.js            # First-run welcome tour
├── live.js               # Live 3D wallpaper scenes (WebGL + canvas)
├── apps.js               # App dock catalog and brand icons
├── profiles.js           # Work / Personal profiles with schedules
├── shared.js             # Settings defaults, sync storage, themes, imports, pomodoro logic
├── background.js         # Service worker: focus-session timer and site blocking
├── blocked.html/.js      # "Stay focused" page shown for blocked sites
├── options.html/.css/.js # Settings page
├── dev.py, dev/          # Localhost dev server + chrome.* stand-in
├── build.py              # Packages Chrome / Firefox zips and the web demo
├── store/                # Store listing text, screenshots and promo tile
└── PRIVACY.md            # Privacy policy
```

---

## 🚀 Installation & Local Development

1. **Clone or Download:**
   ```bash
   git clone https://github.com/your-username/customizable-tab.git
   ```
2. **Open Extensions Manager:**
   In Google Chrome, navigate to:
   ```text
   chrome://extensions/
   ```
3. **Enable Developer Mode:**
   Toggle the **Developer mode** switch in the top-right corner.
4. **Load Unpacked:**
   Click **Load unpacked** in the top-left corner and select the `customizable-tab/` folder.
5. **Open a New Tab:**
   Press `Ctrl + T` (or `Cmd + T` on macOS) to see your custom dashboard.

---

## ⚙️ Chrome Manifest Specification (`manifest.json`)

```json
{
  "manifest_version": 3,
  "name": "Customizable TAB",
  "version": "1.0.0",
  "description": "A minimal, customizable new tab dashboard with direct deep links and daily wallpapers.",
  "chrome_url_overrides": {
    "newtab": "newtab.html"
  },
  "options_ui": {
    "page": "options.html",
    "open_in_tab": true
  },
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "https://www.bing.com/*"
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

---

## 🔄 Daily Midnight Wallpaper Algorithm (`newtab.js`)

The extension checks the local date every time a tab opens and fetches a replacement background if midnight has passed:

```javascript
async function loadDailyWallpaper() {
  const today = new Date().toISOString().slice(0, 10); // Format: YYYY-MM-DD
  const data = await chrome.storage.local.get(["wallpaperDate", "wallpaperUrl"]);

  if (data.wallpaperDate === today && data.wallpaperUrl) {
    document.body.style.backgroundImage = `url('${data.wallpaperUrl}')`;
    return;
  }

  // Fetch Bing daily image JSON archive
  try {
    const res = await fetch("https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=en-US");
    const json = await res.json();
    const fullUrl = `https://www.bing.com${json.images[0].urlbase}_1920x1080.jpg`;

    await chrome.storage.local.set({
      wallpaperDate: today,
      wallpaperUrl: fullUrl
    });

    document.body.style.backgroundImage = `url('${fullUrl}')`;
  } catch (err) {
    console.error("Failed to fetch daily wallpaper:", err);
  }
}
```

---

## 📦 Publishing to the Chrome Web Store

1. **Create Distribution Archive:**
   Select all project files inside the directory and compress them into a `.zip` file (do not zip the parent container folder).
2. **Access Google Developer Console:**
   Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/) and sign in with your Google account.
3. **Upload Item:**
   Click **Add new item**, upload the `.zip` archive, and complete store metadata:
   - Provide a clear product description.
   - Attach at least one 1280x800 resolution promotional screenshot.
   - Upload a 128x128 store icon.
4. **Privacy Policy Disclosure:**
   In the Privacy tab, declare single-purpose use and state that all links, bookmarks, and settings are stored locally on the client machine via `chrome.storage.local`.
5. **Submit for Review:**
   Submit for review. Typical approval timelines take between 24 and 72 hours.
---

## 🆕 v1.1 Additions

- **Link Groups:** Organize links into named sections (Work, Dev, Social). Drag links between groups in the Admin Panel.
- **Keyboard Shortcuts:** `1`–`9` open the first nine links, `/` focuses the search bar (click the page first; Chrome starts focus in the address bar).
- **Widgets (toggle in Admin Panel):** Weather (Open-Meteo, no API key), To-do list, Quick notes, Pomodoro timer (25/5).
- **Cross-Device Sync:** Settings, links, to-dos and notes sync through `chrome.storage.sync`, falling back to local storage if the sync quota is full. Uploaded wallpaper files stay on each device.
- **Versioned Settings:** `SCHEMA_VERSION` + `MIGRATIONS` in `shared.js` upgrade saved data (and old backup files) automatically on update.

## 🛠 Build

```bash
python build.py               # -> .dist/customizable-tab-<version>.zip
python build.py --bump patch  # bump manifest version, then build
```

## ✨ v1.2 Additions

- **Live 3D Wallpapers:** Seven animated scenes that react to the mouse: Web City (night skyline with depth layers, a swaying web that leans toward the cursor, and a masked hero swinging across on web lines), Spiral galaxy, Aurora and Liquid (WebGL), plus Starfield warp, Synthwave and Dotted globe (canvas). Tinted by your accent color. Rendering pauses when the tab is hidden, caps resolution/frame rate per quality level (Battery / Balanced / Ultra), recovers from GPU context loss, and falls back to a 2D scene if WebGL is unavailable. With animations off or OS "reduce motion" on, a still frame is shown.
- **Layouts:** Centered, Sidebar (widgets in a sticky right column), and Minimal (giant clock with a dock of link icons).
- **Theme:** Accent color, card size (S/M/L), card style (Glass/Solid/Outline), personal greeting.
- **Animations:** Wallpaper cross-fade, slow Ken Burns zoom and mouse parallax on photos, staggered entrance, 3D tilt + glare on link cards.
- **Command Palette (`Ctrl+K`):** Fuzzy-search links and actions (change scene/layout, next wallpaper, zen mode, search the web).
- **Customize Drawer:** Change background, scene, quality, layout, accent, cards and dim directly on the new tab page.
- **Wallpaper Browser:** Step through the last 8 Bing daily images (`W` or the header button), with photo credit.
- **Zen Mode (`Z`):** Hide everything but the clock.
- **New Widgets:** Quote of the day, Calendar, World clock (configurable time zones).

- **Video Wallpapers:** Upload a looping MP4/WebM (e.g. an animated wallpaper you own) in *Local Image / Video*.
- **Auto-Location Weather:** Leave the city blank to use your current location (browser geolocation, falling back to IP lookup); hover for today's high/low.
- **Admin Panel Navigation:** *Back to dashboard* button and a docked *Live preview* of the new tab that updates as you change settings.
- **App Dock:** A fixed row of colored app buttons at the bottom center — YouTube, Gmail, Telegram, WhatsApp, Twitter (X) and Discord — always visible, one click to open.
- **Free-Form Widgets:** The dashboard never scrolls; widgets float on top. Press `E` (or the grid button) to drag them anywhere, resize from the corner, and style each one with ⚙: background darkness & tint, blur, opacity, font, text size, text color, corners, border. *Style all* sets the default look; layouts are saved as screen percentages so they adapt to any display.

Shortcuts: `1`–`9` open links · `/` search · `W` next wallpaper · `Z` zen · `C` customize · `E` arrange widgets · `Ctrl+K` palette · `Esc` close.


## 🚀 v1.3 Additions

- **Welcome tour:** On first run you set your name, pick a look, choose dock apps, import links and choose widgets. Replay it from Ctrl+K or Settings.
- **Editable app dock:** Add apps from an 18-app catalog or your own URL/emoji, reorder them, hide the dock, and 🔒 lock it so it never changes. It is locked by default.
- **Import links:** One click turns your bookmarks bar (one group per folder) or most-visited sites into link groups. Uses optional permissions.
- **Search suggestions:** Your matching links appear first, then Google/DuckDuckGo suggestions. Opt-in.
- **Theme presets and sharing:** Eight presets, plus "Copy my theme" codes (`CTAB1:…`) that anyone can paste in.
- **Today's main focus:** A daily goal under the greeting with a checkbox. It resets each day.
- **Focus mode:** Configurable Pomodoro lengths, daily and weekly focus stats, and optional blocking of chosen sites during focus sessions (redirects to a "Stay focused" page). Sessions end on time via the background worker.
- **New widgets:** News (RSS), Countdown, Habit tracker with streaks, Crypto prices (CoinGecko) and GitHub activity.
- **Profiles:** Work and Personal setups, each with its own links, dock, widgets, layout and background, switching automatically by day and time.
- **Six more live scenes:** Ocean (sun, moon and sky colors follow your local time), Cloudy sky and Underwater (WebGL), Fireflies, Matrix rain and Constellation, for 16 scenes in total.
- **Scene by time of day:** Pick a scene for morning (5–11), day (11–17), evening (17–21) and night (21–5); the dashboard switches on its own.
- **Daily photo sources:** Bing, NASA Astronomy Picture of the Day (optional free API key), Wikimedia Commons Picture of the Day, and Lorem Picsum (Unsplash photos). A credit link opens each photo's source page. The background worker fetches the next picture at 00:01 local time, and if a source is down the next one is used automatically.
- **Unsplash daily photos:** Choose the Nature, Space or a custom topic. It needs the user's own free Access Key (unsplash.com/oauth/applications → New Application) and uses one request per day. The photographer and Unsplash are credited with links, and the required download notice is sent once per photo. Without a key, the dashboard falls back to the next source.
- **AI Tools launcher:** Bottom-left button that slides out ChatGPT, Gemini, Copilot, Claude, DeepSeek, Perplexity and Meta AI, and folds them back in on a second click. If the row would cover the app dock, the dock slides away; on narrow windows the pills become icons only.
- **Smoothness:** Smooth mode (default on) replaces glass blur with tinted glass while a 3D scene animates, since blur over a moving wallpaper is recomputed every frame. Scenes adapt their resolution when frames run late, widget dragging uses GPU transforms, and the world clock redraws once a minute.
- **Seasonal scenes:** Festival lights (diyas, lanterns, fireworks), Snowfall and Monsoon rain.
- **Distribution:** Firefox build, static web demo, Hindi store listing, privacy policy, store screenshots → see `store/LISTING.md`.

```bash
python build.py --target all   # Chrome/Edge zip, Firefox zip, web demo
python dev.py                  # run at http://localhost:8000
```
