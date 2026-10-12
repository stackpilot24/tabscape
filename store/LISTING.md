# Store Listing Kit — Customizable TAB 1.3.0

Everything needed to submit to the Chrome Web Store, Microsoft Edge Add-ons and Firefox Add-ons.

## Packages

```bash
python build.py --target all
# .dist/customizable-tab-1.3.0.zip          -> Chrome Web Store, Edge Add-ons, Opera
# .dist/customizable-tab-1.3.0-firefox.zip  -> addons.mozilla.org
# .dist/demo/                               -> static web demo (GitHub Pages / Netlify)
```

## Assets (in `store/screenshots/`)

| File | Use |
|---|---|
| `home.png` (1280×800) | Screenshot 1: Web City scene, links, widgets, dock |
| `sidebar.png` | Screenshot 2: Aurora, sidebar layout, habits and countdown |
| `minimal.png` | Screenshot 3: Synthwave, minimal layout |
| `drawer.png` | Screenshot 4: Customize drawer with themes and 3D scenes |
| `edit.png` | Screenshot 5: drag, resize and style widgets |
| `welcome.png` | Screenshot 6: first-run welcome tour |
| `palette.png` | Extra: Ctrl+K command palette |
| `promo-440x280.png` | Small promo tile |
| `icons/icon128.png` | Store icon |

---

## Listing text: English

**Name:** Customizable TAB

**Short description (≤132 chars):**
Live 3D wallpapers, an app dock, drag-anywhere widgets and focus tools on every new tab.

**Detailed description:**

Turn every new tab into a dashboard that feels alive.

🌌 **Live 3D wallpapers.** Ten animated scenes that react to your mouse: Web City, Festival Lights, Snowfall, Monsoon Rain, Spiral Galaxy, Synthwave, Aurora, Liquid, Starfield and Dotted Globe. Or use a fresh daily photo, your own image, or a looping video. Scenes pause when the tab is hidden and include a battery-saver mode.

⚓ **App dock.** Colorful one-click buttons for the apps you use most, such as YouTube, Gmail, WhatsApp, Telegram and Discord. Lock the dock so it never changes.

🧩 **Widgets you can put anywhere.** To-do, notes, Pomodoro, calendar, world clock, quote of the day, news (RSS), countdowns, habit tracker, crypto prices and GitHub activity. Drag, resize and style each one: font, size, transparency, blur and color.

🎯 **Focus tools.** Set today's main focus, run Pomodoro sessions with daily stats, and block distracting sites while you focus.

⚡ **Fast navigation.** Link groups with favicons, search with suggestions, a Ctrl+K command palette, keyboard shortcuts, and one-click import of your bookmarks or most-visited sites.

🎨 **Make it yours.** Theme presets, accent colors, three layouts, Work and Personal profiles that switch on a schedule, and shareable theme codes.

🔒 **Private by design.** No accounts, no analytics, no tracking. Your settings stay in your browser.

**Category:** Productivity
**Language:** English (plus a Hindi listing)

---

## Listing text: Hindi (हिन्दी)

**संक्षिप्त विवरण:**
हर नए टैब पर लाइव 3D वॉलपेपर, ऐप डॉक, कहीं भी रखे जा सकने वाले विजेट और फ़ोकस टूल।

**विस्तृत विवरण:**

हर नए टैब को एक जीवंत डैशबोर्ड में बदलिए।

🌌 **लाइव 3D वॉलपेपर:** माउस के साथ चलने वाले 10 एनिमेटेड दृश्य: वेब सिटी, त्योहार की रोशनी (दीये और आतिशबाज़ी), बर्फ़बारी, मानसून की बारिश, आकाशगंगा, सिंथवेव, ऑरोरा और भी बहुत कुछ। या रोज़ नई फ़ोटो, अपनी इमेज या वीडियो लगाइए।

⚓ **ऐप डॉक:** YouTube, Gmail, WhatsApp, Telegram और Discord जैसे पसंदीदा ऐप एक क्लिक में खोलिए। डॉक को लॉक भी किया जा सकता है।

🧩 **कहीं भी रखिए विजेट:** टू-डू, नोट्स, पोमोडोरो, कैलेंडर, विश्व घड़ी, समाचार, काउंटडाउन, आदत ट्रैकर, क्रिप्टो और GitHub। हर विजेट का आकार, फ़ॉन्ट और पारदर्शिता बदलिए।

🎯 **फ़ोकस टूल:** आज का मुख्य लक्ष्य लिखिए, पोमोडोरो से काम कीजिए और फ़ोकस के दौरान ध्यान भटकाने वाली साइटें ब्लॉक कीजिए।

🔒 **पूरी तरह निजी:** कोई अकाउंट नहीं, कोई ट्रैकिंग नहीं। आपकी सेटिंग्स आपके ब्राउज़र में ही रहती हैं।

---

## Privacy tab answers (Chrome Web Store)

**Single purpose:**
Replaces the new tab page with a customizable dashboard (wallpapers, links, app dock, widgets and focus tools).

**Permission justifications:**

| Permission | Justification |
|---|---|
| `storage`, `unlimitedStorage` | Saves the user's dashboard settings and an optional uploaded wallpaper image or video. |
| `geolocation` | Shows local weather when the user hasn't typed a city. |
| `alarms` | Ends a Pomodoro focus session on time and lifts site blocking, even when no new tab is open. |
| Host `https://www.bing.com/*` | Loads Bing's daily wallpaper photo. |
| Optional `bookmarks` | Requested only when the user clicks "Import bookmarks bar". |
| Optional `topSites` | Requested only when the user clicks "Import most visited". |
| Optional hosts | Requested per site, only for features the user turns on: search suggestions, an RSS feed, or the specific sites the user blocks during focus sessions. |
| Remote code | None. All code ships in the package. |

**Data usage:** tick nothing under "collects". The developer collects no user data. Certify the three disclosures (not sold, not used for unrelated purposes, not used for creditworthiness).

**Privacy policy URL:** publish `PRIVACY.md` (for example the GitHub file link or a GitHub Pages page) and paste its URL.

---

## Submission checklist

1. Fill in `[your contact email]` in `PRIVACY.md` and publish it at a public URL.
2. Chrome: https://chrome.google.com/webstore/devconsole (one-time $5 registration). Upload the Chrome zip, add the screenshots, promo tile and text above, then fill in the Privacy tab.
3. Edge: https://partner.microsoft.com/dashboard/microsoftedge (free). Use the same zip and assets.
4. Firefox: https://addons.mozilla.org/developers/ (free). Upload the `-firefox.zip`. Because it isn't minified, no source upload is needed.
5. Web demo: push `.dist/demo/` to a `gh-pages` branch, or drag it into Netlify Drop, then link it from the listing as "Try it in your browser".
6. Trademark note: keep third-party character names (such as Spider-Man) out of the name, description and screenshots. App names in the dock (YouTube and so on) are fine as navigation links.
