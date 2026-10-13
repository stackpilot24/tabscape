# Privacy Policy — Tabscape

_Last updated: 12 October 2026_

Tabscape replaces your browser's new tab page. **The developer does not collect, store, sell or share any of your data.** There are no accounts, no analytics and no tracking.

## What is stored, and where

| Data | Where it lives |
|---|---|
| Your settings: links, app dock, layout, theme, widgets, to-dos, notes, habits, countdowns, profiles | Your browser's extension storage. If you are signed in to the browser with sync turned on, it syncs between your own devices through your browser account. |
| Uploaded wallpaper image or video | Only on this device (IndexedDB). It is never uploaded anywhere. |
| Caches (weather, daily photo list, feed headlines, prices, focus-session counts) | Only on this device (extension local storage). |

Uninstalling the extension deletes all of this data.

## Services the extension contacts

The extension talks directly to these services from your browser, and only when the matching feature is turned on. The developer runs no server and receives nothing.

| Feature | Service | What is sent |
|---|---|---|
| Daily photo wallpaper (the source you pick) | Bing (`bing.com`), NASA APOD (`api.nasa.gov`), Wikimedia (`api.wikimedia.org`, `upload.wikimedia.org`, `thumb.wikimedia.org`), Unsplash (`api.unsplash.com`, `images.unsplash.com`) or Lorem Picsum (`picsum.photos`) | A request for recent pictures with your chosen topic, plus your own NASA or Unsplash key if you entered one. For Unsplash, a "photo used" notice is sent once per photo, as Unsplash requires. |
| Weather | Open-Meteo (`open-meteo.com`) | Your city name, or approximate coordinates |
| Weather: automatic location | Browser geolocation, then BigDataCloud (`bigdatacloud.net`) to name the city | Coordinates, rounded by the browser |
| Weather: fallback location | ipapi (`ipapi.co`) | Your IP address (inherent in any web request) |
| Link and dock icons | Google favicon service (`google.com/s2/favicons`) | The domain of each link |
| Search suggestions (off by default) | Google or DuckDuckGo suggestion endpoints | What you type in the search box |
| News widget (optional) | The RSS feed you enter | A request for the feed |
| Crypto widget (optional) | CoinGecko (`coingecko.com`) | The coin names you chose |
| GitHub widget (optional) | GitHub API (`api.github.com`) | The username you entered |

Searches you submit go to the search engine you chose, just like searching from the address bar.

## Permissions

- **storage, unlimitedStorage**: save your settings and an uploaded wallpaper.
- **geolocation**: show weather for where you are when no city is set.
- **alarms**: end a focus session on time, even when no new tab is open, and fetch the next daily photo just after midnight.
- **bing.com host access**: load the daily photo.
- **Optional: bookmarks, topSites**: requested only when you click *Import bookmarks* or *Import most visited*.
- **Optional: specific sites**: requested only for features you turn on: the suggestion service, your news feed, or exactly the sites you choose to block during focus sessions.

## Contact

Questions: [samyakjain1524@gmail.com]
