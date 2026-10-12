// App dock data: brand-drawn icons for a few apps, a catalog for the welcome screen and settings,
// and the button renderer. Apps without a built-in icon show their site icon on a white disc.
const BRAND_ICONS = {
  youtube: { color: "#ff0033", svg: '<rect x="4" y="6.5" width="16" height="11" rx="3.5" fill="#fff"/><path d="M10.5 9.6v4.8l4.2-2.4z" fill="#ff0033"/>' },
  gmail: { color: "#ffffff", svg: '<path d="M4 8.2v9.3h3v-7.1z" fill="#4285f4"/><path d="M17 10.4v7.1h3V8.2z" fill="#34a853"/><path d="M4 8.2 12 14l8-5.8V7.3c0-1.2-1.4-1.9-2.4-1.2L12 10.3 6.4 6.1C5.4 5.4 4 6.1 4 7.3z" fill="#ea4335"/><path d="M17 10.4V6.4l3 1.8z" fill="#fbbc04"/><path d="M7 10.4V6.4L4 8.2z" fill="#c5221f"/>' },
  telegram: { color: "#2aabee", svg: '<path d="M5.4 11.6 17 7.1c.6-.2 1.1.1.9.9l-2 9.3c-.1.6-.6.8-1.1.5l-3-2.2-1.5 1.4c-.2.2-.3.3-.6.3l.2-3.1 5.6-5.1c.2-.2 0-.3-.4-.1l-6.9 4.4-3-.9c-.6-.2-.6-.6.2-.9z" fill="#fff"/>' },
  whatsapp: { color: "#25d366", svg: '<path d="M12 4.6a7.4 7.4 0 0 0-6.4 11.2l-1 3.6 3.7-1A7.4 7.4 0 1 0 12 4.6z" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><path d="M9.4 8.3c.2-.4.4-.4.6-.4h.5c.2 0 .4.1.5.4l.7 1.6c.1.2 0 .4-.1.6l-.4.5c-.1.1-.1.3 0 .5.4.7 1.3 1.6 2.1 2 .2.1.4.1.5 0l.5-.6c.2-.2.4-.2.6-.1l1.5.7c.2.1.4.3.3.5 0 .5-.2 1.2-.8 1.5-.6.3-1.6.4-3.2-.4-1.5-.8-2.8-2.3-3.3-3.4-.5-1.1-.3-2 0-2.4z" fill="#fff"/>' },
  twitter: { color: "#1d9bf0", svg: '<path transform="translate(5.4 5.6) scale(.55)" d="M23.95 4.57a10 10 0 0 1-2.82.77 4.96 4.96 0 0 0 2.16-2.72c-.95.56-2 .96-3.12 1.19a4.92 4.92 0 0 0-8.38 4.48A13.94 13.94 0 0 1 1.64 3.16a4.92 4.92 0 0 0 1.52 6.57 4.9 4.9 0 0 1-2.23-.62v.06a4.92 4.92 0 0 0 3.95 4.83 4.96 4.96 0 0 1-2.21.08 4.93 4.93 0 0 0 4.6 3.42A9.87 9.87 0 0 1 0 19.54a13.94 13.94 0 0 0 7.55 2.21c9.05 0 14-7.5 14-13.98 0-.21 0-.42-.02-.63A9.94 9.94 0 0 0 24 4.59z" fill="#fff"/>' },
  discord: { color: "#5865f2", svg: '<path d="M7.1 8.3c1.5-.8 3.1-1.1 4.9-1.1s3.4.3 4.9 1.1c1.3 2 1.9 4.3 1.8 6.8-1.3 1-2.7 1.6-4.1 2l-.9-1.4c.6-.2 1.2-.5 1.7-.9l-.5-.4a9.4 9.4 0 0 1-5.8 0l-.5.4c.5.4 1.1.7 1.7.9l-.9 1.4c-1.4-.4-2.8-1-4.1-2-.1-2.5.5-4.8 1.8-6.8z" fill="#fff"/><circle cx="9.8" cy="12.6" r="1.15" fill="#5865f2"/><circle cx="14.2" cy="12.6" r="1.15" fill="#5865f2"/>' }
};

const APP_CATALOG = [
  { name: "YouTube", url: "https://www.youtube.com", icon: "youtube" },
  { name: "Gmail", url: "https://mail.google.com", icon: "gmail" },
  { name: "Telegram", url: "https://web.telegram.org", icon: "telegram" },
  { name: "WhatsApp", url: "https://web.whatsapp.com", icon: "whatsapp" },
  { name: "Twitter", url: "https://x.com", icon: "twitter" },
  { name: "Discord", url: "https://discord.com/app", icon: "discord" },
  { name: "Instagram", url: "https://www.instagram.com", icon: "", color: "#e1306c" },
  { name: "LinkedIn", url: "https://www.linkedin.com", icon: "", color: "#0a66c2" },
  { name: "Reddit", url: "https://www.reddit.com", icon: "", color: "#ff4500" },
  { name: "Spotify", url: "https://open.spotify.com", icon: "", color: "#1db954" },
  { name: "Netflix", url: "https://www.netflix.com", icon: "", color: "#e50914" },
  { name: "GitHub", url: "https://github.com", icon: "", color: "#6e7681" },
  { name: "Google Drive", url: "https://drive.google.com", icon: "", color: "#1fa463" },
  { name: "Calendar", url: "https://calendar.google.com", icon: "", color: "#4285f4" },
  { name: "Notion", url: "https://www.notion.so", icon: "", color: "#9b9b9b" },
  { name: "Slack", url: "https://app.slack.com", icon: "", color: "#611f69" },
  { name: "Facebook", url: "https://www.facebook.com", icon: "", color: "#1877f2" },
  { name: "Amazon", url: "https://www.amazon.com", icon: "", color: "#ff9900" }
];
const DEFAULT_DOCK = APP_CATALOG.slice(0, 6).map((a) => ({ ...a }));

// AI Tools launcher (bottom left); fixed list, shown with each site's own icon
const AI_TOOLS = [
  { name: "ChatGPT", url: "https://chatgpt.com" },
  { name: "Gemini", url: "https://gemini.google.com" },
  { name: "Copilot", url: "https://copilot.microsoft.com" },
  { name: "Claude", url: "https://claude.ai" },
  { name: "DeepSeek", url: "https://chat.deepseek.com" },
  { name: "Perplexity", url: "https://www.perplexity.ai" },
  { name: "Meta AI", url: "https://www.meta.ai" }
];

// One round dock button; `icon` is a BRAND_ICONS key, an emoji, an image URL, or empty (site icon)
function appButton(app) {
  const a = document.createElement("a");
  a.href = app.url;
  a.dataset.name = app.name;
  const brand = BRAND_ICONS[app.icon];
  if (brand) {
    a.style.setProperty("--c", brand.color);
    a.innerHTML = `<svg viewBox="0 0 24 24">${brand.svg}</svg>`; // static strings from BRAND_ICONS
  } else {
    a.style.setProperty("--c", "#fff");
    a.style.setProperty("--glow", app.color || "#ffffff");
    a.append(linkIcon({ url: app.url, icon: app.icon }, "appimg"));
  }
  return a;
}
