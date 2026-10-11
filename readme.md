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
├── manifest.json         # Chrome Extension Manifest V3 configuration
├── newtab.html           # Main user-facing dashboard
├── newtab.css            # Dashboard styles (frosted cards, responsive grid)
├── newtab.js             # Wallpaper scheduler, bookmark renderer, search logic
├── options.html          # Backend Admin Panel interface
├── options.css           # Admin Panel styles & layout
├── options.js            # Link CRUD operations, storage handlers, import/export
└── icons/                # Extension store icons (16px, 48px, 128px)
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
