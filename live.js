// Live wallpapers: animated 3D scenes drawn on a <canvas>. Galaxy, aurora and liquid run on the GPU
// (WebGL); the rest use canvas 2D. Rendering pauses while the tab is hidden, caps resolution and
// frame rate per quality level, and falls back to a 2D scene if WebGL is unavailable.
const LIVE_SCENES = {
  webcity: "Web City",
  galaxy: "Spiral galaxy",
  warp: "Starfield warp",
  synthwave: "Synthwave",
  globe: "Dotted globe",
  aurora: "Aurora",
  fluid: "Liquid",
  festival: "Festival lights",
  snow: "Snowfall",
  rain: "Monsoon rain"
};
const LIVE_QUALITY = {
  low: { scale: 0.5, fps: 30, n: 0.5 },
  medium: { scale: 0.75, fps: 60, n: 1 },
  high: { scale: 1, fps: 60, n: 1.6 }
};

const hexRgb = (h) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || "");
  const n = parseInt(m ? m[1] : "7aa2ff", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mixRgb = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
// Rotates an RGB color's hue by `deg` (keeps lightness and saturation): the scenes' second color
function hueShift([r, g, b], deg) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [r, g, b].map((v) => Math.round(v * 255));
  const sat = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (((h * 60 + deg) % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * sat, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r1, g1, b1].map((v) => Math.round((v + m) * 255));
}
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

// ---- Canvas 2D scenes ----
function warp(canvas, env) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const N = Math.round(900 * env.n), s = new Float32Array(N * 3);
  const reset = (i, far) => { s[i * 3] = (Math.random() - 0.5) * 2; s[i * 3 + 1] = (Math.random() - 0.5) * 2; s[i * 3 + 2] = far ? 1 : Math.random(); };
  for (let i = 0; i < N; i++) reset(i, false);
  const styles = [rgba(mixRgb([255, 255, 255], env.accent, 0.2)), rgba(mixRgb([255, 255, 255], env.accent, 0.6), 0.75), rgba(env.accent2, 0.45)];

  return {
    draw(t, w, h, m, dt) {
      ctx.fillStyle = "#02030a"; ctx.fillRect(0, 0, w, h);
      const cx = w / 2 - m.x * w * 0.15, cy = h / 2 - m.y * h * 0.15, f = Math.max(w, h) * 0.5;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, f * 0.6);
      g.addColorStop(0, rgba(env.accent, 0.12)); g.addColorStop(1, rgba(env.accent, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const paths = [new Path2D(), new Path2D(), new Path2D()], step = dt * 0.28;
      for (let i = 0; i < N; i++) {
        const z = s[i * 3 + 2] - step;
        if (z <= 0.02) { reset(i, true); continue; }
        s[i * 3 + 2] = z;
        const x = s[i * 3], y = s[i * 3 + 1], z0 = Math.min(1, z + step * 5);
        const sx = cx + (x / z) * f, sy = cy + (y / z) * f;
        if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) { reset(i, true); continue; }
        const p = paths[z < 0.33 ? 0 : z < 0.66 ? 1 : 2];
        p.moveTo(cx + (x / z0) * f, cy + (y / z0) * f); p.lineTo(sx, sy);
      }
      ctx.lineCap = "round";
      paths.forEach((p, b) => { ctx.strokeStyle = styles[b]; ctx.lineWidth = (3 - b) * Math.max(1, h / 900); ctx.stroke(p); });
    }
  };
}

function synthwave(canvas, env) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const A = env.accent, P = env.accent2;
  const ridge = (seed, n) => Array.from({ length: n + 1 }, (_, i) => {
    const x = i / n;
    const v = 0.5 + 0.25 * Math.sin(x * 7 + seed) + 0.15 * Math.sin(x * 17 + seed * 2) + 0.1 * Math.sin(x * 37 + seed * 3);
    return v * (0.25 + 0.75 * Math.abs(x - 0.5) * 2); // keep the middle low so the sun shows
  });
  const far = ridge(1.3, 90), near = ridge(4.1, 60);
  const stars = Array.from({ length: 160 }, () => [Math.random(), Math.random() * 0.75, Math.random() * 10]);
  const floorTop = "#0b0220", floor = "#05010d";

  function mountains(pts, hz, w, height, fill) {
    ctx.beginPath(); ctx.moveTo(0, hz);
    pts.forEach((v, i) => ctx.lineTo((i / (pts.length - 1)) * w, hz - v * height));
    ctx.lineTo(w, hz); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = rgba(P, 0.45); ctx.lineWidth = 1; ctx.stroke();
  }

  return {
    draw(t, w, h, m) {
      const hz = h * (0.6 + m.y * 0.02), vx = w / 2 - m.x * w * 0.04, H = h - hz;
      let g = ctx.createLinearGradient(0, 0, 0, hz);
      g.addColorStop(0, "#06021a"); g.addColorStop(0.65, rgba(mixRgb([24, 6, 48], P, 0.3))); g.addColorStop(1, rgba(mixRgb(P, [255, 190, 120], 0.25)));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, hz);
      ctx.fillStyle = "#fff";
      for (const [x, y, ph] of stars) { ctx.globalAlpha = 0.25 + 0.35 * Math.sin(t * 1.5 + ph); ctx.fillRect(x * w, y * hz, 1.5, 1.5); }
      ctx.globalAlpha = 1;

      const r = Math.min(w, h) * 0.22, sx = vx, sy = hz - r * 0.35;
      g = ctx.createRadialGradient(sx, sy, r * 0.7, sx, sy, r * 2.2);
      g.addColorStop(0, rgba(P, 0.35)); g.addColorStop(1, rgba(P, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, hz);
      ctx.save();
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.clip();
      g = ctx.createLinearGradient(0, sy - r, 0, sy + r);
      g.addColorStop(0, "#ffe680"); g.addColorStop(0.45, "#ff8a5c"); g.addColorStop(1, rgba(P));
      ctx.fillStyle = g;
      ctx.fillRect(sx - r, sy - r, 2 * r, r * 1.1);
      const drift = (t * 0.08) % 1;
      for (let i = 0, y = sy + r * 0.1; y < sy + r; i++) {
        const gap = r * (0.025 + (i + drift) * 0.016), band = r * Math.max(0.025, 0.1 - (i + drift) * 0.012);
        ctx.fillRect(sx - r, y + gap, 2 * r, band);
        y += gap + band;
      }
      ctx.restore();

      mountains(far, hz, w, h * 0.13, rgba(mixRgb([14, 4, 34], P, 0.12)));
      mountains(near, hz, w, h * 0.07, "#0a0219");

      g = ctx.createLinearGradient(0, hz, 0, h);
      g.addColorStop(0, floorTop); g.addColorStop(1, floor);
      ctx.fillStyle = g; ctx.fillRect(0, hz, w, H);

      const grid = new Path2D(), D = H * 0.9, phase = (t * 0.8) % 1, S = w * 0.09, camX = m.x * S * 2;
      for (let k = 0; k < 45; k++) {
        const z = k + 1 - phase, y = hz + D / z;
        if (y > h + 4) continue;
        grid.moveTo(0, y); grid.lineTo(w, y);
      }
      for (let i = -30; i <= 30; i++) {
        const X = i * S - camX;
        grid.moveTo(vx + X / 60, hz + D / 60); grid.lineTo(vx + X / 0.3, hz + D / 0.3);
      }
      ctx.save();
      ctx.beginPath(); ctx.rect(0, hz, w, H); ctx.clip();
      const lw = Math.max(1, h / 650);
      ctx.strokeStyle = rgba(A, 0.18); ctx.lineWidth = lw * 5; ctx.stroke(grid); // glow
      ctx.strokeStyle = rgba(A); ctx.lineWidth = lw; ctx.stroke(grid);
      ctx.restore();

      g = ctx.createLinearGradient(0, hz, 0, hz + H * 0.35);
      g.addColorStop(0, floorTop); g.addColorStop(1, "rgba(11,2,32,0)");
      ctx.fillStyle = g; ctx.fillRect(0, hz, w, H * 0.35);
      ctx.fillStyle = rgba(P, 0.8); ctx.fillRect(0, hz - 1, w, 2);
    }
  };
}

function globe(canvas, env) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const N = Math.round(2400 * env.n), golden = Math.PI * (3 - Math.sqrt(5));
  const sphere = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
    sphere.set([Math.cos(th) * r, y, Math.sin(th) * r], i * 3);
  }
  const RINGS = [{ R: 1.45, tilt: 0.45, speed: 0.22 }, { R: 1.8, tilt: -0.75, speed: -0.14 }];
  const M = Math.round(240 * env.n);
  const shades = [0.95, 0.6, 0.3, 0.12];
  const dot = shades.map((a) => rgba(mixRgb([255, 255, 255], env.accent, 0.55), a));
  const ringDot = shades.map((a) => rgba(env.accent2, a));

  return {
    draw(t, w, h, m) {
      const cx = w / 2, cy = h / 2, F = Math.min(w, h) * 0.3 * 4;
      ctx.fillStyle = "#02040b"; ctx.fillRect(0, 0, w, h);
      let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, F * 0.6);
      g.addColorStop(0, rgba(env.accent, 0.2)); g.addColorStop(1, rgba(env.accent, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      const yaw = t * 0.12 + m.x * 0.8, pitch = 0.3 + m.y * 0.4;
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const proj = (x, y, z, out) => {
        const x1 = x * cyw - z * syw, z1 = x * syw + z * cyw;
        out[0] = x1; out[1] = y * cp - z1 * sp; out[2] = y * sp + z1 * cp;
      };
      const p = [0, 0, 0], rScreen = F / 4;
      const shade = (z, span) => Math.min(3, Math.max(0, Math.floor(((z / span + 1) / 2) * 4)));

      for (let b = 3; b >= 0; b--) {
        ctx.fillStyle = dot[b];
        for (let i = 0; i < N; i++) {
          proj(sphere[i * 3], sphere[i * 3 + 1], sphere[i * 3 + 2], p);
          if (shade(p[2], 1) !== b) continue;
          const k = F / (4 + p[2]), s = Math.max(1, k * 0.006);
          ctx.fillRect(cx + p[0] * k - s / 2, cy + p[1] * k - s / 2, s, s);
        }
        ctx.fillStyle = ringDot[b];
        for (const ring of RINGS) {
          const ct = Math.cos(ring.tilt), st = Math.sin(ring.tilt);
          for (let j = 0; j < M; j++) {
            const a = (j / M) * 6.283 + t * ring.speed, x = Math.cos(a) * ring.R, z = Math.sin(a) * ring.R;
            proj(x, -z * st, z * ct, p);
            if (shade(p[2], ring.R) !== b) continue;
            const k = F / (4 + p[2]), sx = p[0] * k, sy = p[1] * k;
            if (p[2] > 0 && sx * sx + sy * sy < rScreen * rScreen) continue; // hidden behind the globe
            const s = Math.max(1, k * 0.008);
            ctx.fillRect(cx + sx - s / 2, cy + sy - s / 2, s, s);
          }
        }
      }
      g = ctx.createRadialGradient(cx, cy, rScreen * 0.92, cx, cy, rScreen * 1.25);
      g.addColorStop(0, rgba(env.accent, 0)); g.addColorStop(0.3, rgba(env.accent, 0.18)); g.addColorStop(1, rgba(env.accent, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  };
}

// Night city: parallax skyline layers, a swaying corner web and a masked hero swinging across on web lines
function webcity(canvas, env) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const A = env.accent, neon = mixRgb(A, [255, 255, 255], 0.25);
  const stars = Array.from({ length: 140 }, () => [Math.random(), Math.random() * 0.5, Math.random() * 6]);
  let W = 0, H = 0, layers = [], beacons = [];

  // Each skyline layer (with lit windows) is pre-rendered once per size; frames just blit it
  function buildLayers(w, h) {
    W = w; H = h; beacons = [];
    const specs = [
      { depth: 0.2, minW: 0.03, maxW: 0.07, minH: 0.3, maxH: 0.55, body: mixRgb([18, 20, 38], A, 0.1), win: 0.25, lit: 0.25 },
      { depth: 0.5, minW: 0.05, maxW: 0.1, minH: 0.2, maxH: 0.45, body: [10, 11, 22], win: 0.45, lit: 0.3 },
      { depth: 1, minW: 0.08, maxW: 0.15, minH: 0.08, maxH: 0.26, body: [3, 3, 8], win: 0.6, lit: 0.2 }
    ];
    layers = specs.map((sp, li) => {
      const c = document.createElement("canvas"), pad = Math.round(w * 0.08);
      c.width = w + pad * 2; c.height = h;
      const g = c.getContext("2d"), cell = Math.max(2, Math.round(w * 0.0032));
      for (let x = 0; x < c.width;) {
        const bw = w * (sp.minW + Math.random() * (sp.maxW - sp.minW)), bh = h * (sp.minH + Math.random() * (sp.maxH - sp.minH)), top = h - bh;
        g.fillStyle = rgba(sp.body);
        g.fillRect(x, top, bw - 1, bh);
        for (let wy = top + cell * 2; wy < h - cell; wy += cell * 2.2) {
          for (let wx = x + cell; wx < x + bw - cell * 2; wx += cell * 2) {
            if (Math.random() > sp.lit) continue;
            const a = sp.win * (0.5 + Math.random() * 0.5);
            g.fillStyle = Math.random() < 0.88 ? `rgba(255,${(195 + Math.random() * 45) | 0},140,${a})` : rgba(neon, a);
            g.fillRect(wx, wy, cell, cell * 1.3);
          }
        }
        if (li < 2 && bh > h * 0.4 && Math.random() < 0.6) { // antenna with a blinking light
          g.fillStyle = rgba(sp.body);
          g.fillRect(x + bw / 2 - 1, top - h * 0.05, 2, h * 0.05);
          beacons.push({ li, x: x + bw / 2, y: top - h * 0.05, ph: Math.random() * 6 });
        }
        x += bw + Math.random() * w * 0.01;
      }
      return { c, pad, depth: sp.depth };
    });
  }

  function web(t, w, h, m, R) {
    const spokes = 9, rings = 13, mx = ((m.x + 1) / 2) * w, my = ((m.y + 1) / 2) * h;
    const pt = (s, r) => {
      const a = (s / (spokes - 1)) * (Math.PI / 2), rr = (r / rings) * R;
      const sway = Math.sin(t * 1.3 + r * 0.5 + s) * rr * 0.012;
      const x = Math.cos(a) * rr + sway, y = Math.sin(a) * rr + sway * 0.5;
      const dx = mx - x, dy = my - y, pull = Math.exp(-(dx * dx + dy * dy) / (R * R * 0.05)) * 0.15; // threads lean toward the cursor
      return [x + dx * pull, y + dy * pull];
    };
    ctx.strokeStyle = "rgba(230,235,255,.3)";
    ctx.lineWidth = Math.max(1, h / 900);
    ctx.beginPath();
    for (let s = 0; s < spokes; s++) { const [x, y] = pt(s, rings); ctx.moveTo(0, 0); ctx.lineTo(x, y); }
    for (let r = 1; r <= rings; r++) {
      let [px, py] = pt(0, r);
      ctx.moveTo(px, py);
      for (let s = 1; s < spokes; s++) {
        const [x, y] = pt(s, r), qx = (px + x) / 2, qy = (py + y) / 2;
        ctx.quadraticCurveTo(qx * 0.94, qy * 0.94, x, y); // threads sag toward the hub
        px = x; py = y;
      }
    }
    ctx.stroke();
  }

  // Pendulum swings left to right, then a pause before the next pass
  const SWING = 2.6, PAUSE = 6, ARC = 0.85;
  function swing(t, w, h) {
    const L = h * 0.55, step = 2 * Math.sin(ARC) * L, n = Math.ceil((w * 1.4) / step);
    const tc = t % (n * SWING + PAUSE);
    if (tc > n * SWING) return null;
    const k = Math.floor(tc / SWING), f = (tc % SWING) / SWING;
    const th = -ARC + 2 * ARC * (0.5 - 0.5 * Math.cos(Math.PI * f));
    const ax = -w * 0.2 + Math.sin(ARC) * L + k * step, ay = -h * 0.12;
    return { ax, ay, x: ax + Math.sin(th) * L, y: ay + Math.cos(th) * L, th };
  }

  function hero(x, y, th, s) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(-th); ctx.scale(s, s);
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.shadowColor = rgba(A, 0.9); ctx.shadowBlur = s * 0.3;
    ctx.strokeStyle = "#07070d";
    ctx.lineWidth = 0.11;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0.05, 0.32); // web arm
    ctx.lineTo(0.32, 0.46); ctx.lineTo(0.46, 0.34); // free arm
    ctx.moveTo(0.1, 0.72); ctx.lineTo(0.34, 0.94); ctx.lineTo(0.24, 1.2); // legs
    ctx.moveTo(0.1, 0.72); ctx.lineTo(-0.06, 0.98); ctx.lineTo(0.04, 1.24);
    ctx.stroke();
    ctx.lineWidth = 0.2;
    ctx.beginPath(); ctx.moveTo(0.05, 0.34); ctx.lineTo(0.1, 0.7); ctx.stroke(); // torso
    ctx.fillStyle = "#07070d";
    ctx.beginPath(); ctx.arc(-0.07, 0.22, 0.1, 0, Math.PI * 2); ctx.fill(); // head
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,.9)"; // mask eye
    ctx.beginPath(); ctx.ellipse(-0.12, 0.2, 0.035, 0.018, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  return {
    draw(t, w, h, m) {
      if (w !== W || h !== H) buildLayers(w, h);
      let g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#03040c"); g.addColorStop(0.55, rgba(mixRgb([12, 10, 30], A, 0.12))); g.addColorStop(1, rgba(mixRgb([20, 8, 22], A, 0.45)));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#fff";
      for (const [x, y, ph] of stars) { ctx.globalAlpha = 0.2 + 0.3 * Math.sin(t * 1.4 + ph); ctx.fillRect(x * w, y * h, 1.4, 1.4); }
      ctx.globalAlpha = 1;

      const mr = Math.min(w, h) * 0.09, mx = w * 0.78 - m.x * w * 0.01, my = h * 0.2 - m.y * h * 0.01;
      g = ctx.createRadialGradient(mx, my, mr, mx, my, mr * 4);
      g.addColorStop(0, "rgba(255,240,220,.2)"); g.addColorStop(1, "rgba(255,240,220,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#f3eee2";
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(120,110,100,.12)";
      for (const [cx, cy, cr] of [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.3], [-0.1, 0.4, 0.15]]) {
        ctx.beginPath(); ctx.arc(mx + cx * mr, my + cy * mr, cr * mr, 0, Math.PI * 2); ctx.fill();
      }

      const sw = swing(t, w, h);
      layers.forEach((L, i) => {
        const ox = -L.pad - m.x * L.pad * L.depth, oy = m.y * h * 0.015 * L.depth;
        ctx.drawImage(L.c, ox, oy);
        ctx.fillStyle = "#ff3b3b";
        for (const b of beacons) {
          if (b.li !== i || Math.sin(t * 2.5 + b.ph) < 0.6) continue;
          ctx.beginPath(); ctx.arc(b.x + ox, b.y + oy, Math.max(1.5, h / 500), 0, Math.PI * 2); ctx.fill();
        }
        if (i === 0) { // haze between the far and middle skyline
          g = ctx.createLinearGradient(0, h * 0.5, 0, h);
          g.addColorStop(0, rgba(A, 0)); g.addColorStop(1, rgba(A, 0.14));
          ctx.fillStyle = g; ctx.fillRect(0, h * 0.5, w, h * 0.5);
        }
        if (i === 1 && sw) {
          const px = -m.x * L.pad * 0.7;
          ctx.strokeStyle = "rgba(240,240,255,.75)"; ctx.lineWidth = Math.max(1, h / 700);
          ctx.beginPath(); ctx.moveTo(sw.ax + px, sw.ay); ctx.lineTo(sw.x + px, sw.y); ctx.stroke();
          hero(sw.x + px, sw.y, sw.th, h * 0.09);
        }
      });
      web(t, w, h, m, Math.min(w, h) * 0.45);
    }
  };
}

// Static backdrop rendered once per size; scenes blit it instead of redrawing gradients every frame
function backdrop(w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  paint(c.getContext("2d"), w, h);
  return c;
}
// Soft round glow, drawn scaled with drawImage (far cheaper than a radial gradient per frame)
const glowSprites = new Map();
function glow(rgb) {
  const key = rgb.join();
  if (!glowSprites.has(key)) {
    const c = document.createElement("canvas"), g = c.getContext("2d");
    c.width = c.height = 64;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(rgb)); gr.addColorStop(0.4, rgba(rgb, 0.45)); gr.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowSprites.set(key, c);
  }
  return glowSprites.get(key);
}

// Festival night: fireworks, rising sky lanterns, warm bokeh and a row of flickering diyas
function festival(canvas, env) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const A = env.accent, warm = [[255, 190, 90], [255, 140, 60], [255, 215, 130], A];
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const bokeh = Array.from({ length: Math.round(36 * env.n) }, () => ({ x: Math.random(), y: Math.random(), r: 0.01 + Math.random() * 0.035, s: 0.004 + Math.random() * 0.01, c: pick(warm), a: 0.08 + Math.random() * 0.12 }));
  const lantern = (init) => ({ x: Math.random(), y: init ? Math.random() : 1.1, s: 0.012 + Math.random() * 0.018, size: 0.012 + Math.random() * 0.016, ph: Math.random() * 6 });
  const lanterns = Array.from({ length: Math.round(14 * env.n) }, () => lantern(true));
  const BURST = [A, [255, 215, 90], [255, 110, 180], [120, 255, 170], [140, 190, 255]];
  let sparks = [], nextBurst = 0.5, bg = null;
  const flame = [255, 160, 60];

  function burst(w, h) {
    const x = w * (0.15 + Math.random() * 0.7), y = h * (0.12 + Math.random() * 0.3), c = pick(BURST), n = Math.round(70 * env.n) + 20;
    const speed = Math.min(w, h) * (0.18 + Math.random() * 0.12);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + Math.random() * 0.1, v = speed * (0.6 + Math.random() * 0.4);
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c });
    }
  }

  return {
    draw(t, w, h, m, dt) {
      if (bg?.width !== w || bg?.height !== h) bg = backdrop(w, h, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, "#06040f"); gr.addColorStop(0.6, "#180a1f"); gr.addColorStop(1, rgba(mixRgb(A, [40, 12, 12], 0.65)));
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      });
      ctx.drawImage(bg, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      for (const b of bokeh) {
        b.y -= b.s * dt; if (b.y < -0.1) b.y = 1.1;
        const x = b.x * w - m.x * 15, y = b.y * h, r = b.r * Math.min(w, h) * 2;
        ctx.globalAlpha = b.a;
        ctx.drawImage(glow(b.c), x - r, y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      if (t > nextBurst) { burst(w, h); nextBurst = t + 1 + Math.random() * 2; }
      const grav = h * 0.12;
      sparks = sparks.filter((p) => (p.life -= dt * 0.55) > 0);
      for (const p of sparks) {
        const px = p.x, py = p.y;
        p.vx *= 1 - dt * 0.9; p.vy = p.vy * (1 - dt * 0.9) + grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.strokeStyle = rgba(p.c, p.life); ctx.lineWidth = Math.max(1, h / 500);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      for (const l of lanterns) {
        l.y -= l.s * dt; if (l.y < -0.1) Object.assign(l, lantern(false));
        const s = l.size * Math.min(w, h) * 2, x = l.x * w + Math.sin(t * 0.5 + l.ph) * s - m.x * 30, y = l.y * h;
        const flick = 0.85 + 0.15 * Math.sin(t * 7 + l.ph * 3);
        ctx.globalAlpha = 0.35 * flick;
        ctx.drawImage(glow(flame), x - s * 3, y - s * 3, s * 6, s * 6);
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgba(255,${(150 + 40 * flick) | 0},70,.9)`;
        ctx.beginPath(); ctx.moveTo(x - s * 0.45, y - s * 0.6); ctx.lineTo(x + s * 0.45, y - s * 0.6); ctx.lineTo(x + s * 0.32, y + s * 0.6); ctx.lineTo(x - s * 0.32, y + s * 0.6); ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      // diyas along the bottom
      const size = Math.max(14, h * 0.035), n = Math.ceil(w / (size * 4)), base = h - size * 0.6;
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * (w / n), f = 0.8 + 0.2 * Math.sin(t * 9 + i * 1.7);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.4 * f;
        ctx.drawImage(glow(flame), x - size * 3, base - size * 3.9, size * 6, size * 6);
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgba(255,${(200 + 40 * f) | 0},120,.95)`;
        ctx.beginPath(); ctx.ellipse(x, base - size * 0.75, size * 0.18, size * 0.45 * f, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#7a3414";
        ctx.beginPath(); ctx.ellipse(x, base - size * 0.25, size * 0.7, size * 0.32, 0, 0, Math.PI); ctx.fill();
      }
    }
  };
}

// Pre-rendered pine-forest layer with snowy tips
function pineLayer(w, h, { horizon, minH, maxH, color, snow, spacing }) {
  const c = document.createElement("canvas"), pad = Math.round(w * 0.08);
  c.width = w + pad * 2; c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = color;
  g.fillRect(0, h * horizon, c.width, h);
  for (let x = -20; x < c.width + 20; x += spacing * (0.6 + Math.random() * 0.8)) {
    const th = h * (minH + Math.random() * (maxH - minH)), tw = th * 0.42, base = h * horizon + Math.random() * h * 0.02;
    g.fillStyle = color;
    for (let k = 0; k < 3; k++) {
      const top = base - th + k * th * 0.25, bot = base - th * (0.45 - k * 0.2);
      g.beginPath(); g.moveTo(x, top); g.lineTo(x + tw * (0.5 + k * 0.25), bot); g.lineTo(x - tw * (0.5 + k * 0.25), bot); g.closePath(); g.fill();
      g.fillStyle = snow;
      g.beginPath(); g.moveTo(x, top); g.lineTo(x + tw * 0.16, top + th * 0.08); g.lineTo(x - tw * 0.16, top + th * 0.08); g.closePath(); g.fill();
      g.fillStyle = color;
    }
  }
  return { c, pad };
}

// Snowy night: three pine layers in depth, flakes falling between them, wind follows the mouse
function snow(canvas, env) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const A = env.accent, N = Math.round(420 * env.n);
  const flakes = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7, ph: Math.random() * 6 }));
  let W = 0, H = 0, layers = [], bg = null;
  const band = (lo, hi) => flakes.filter((f) => f.z >= lo && f.z < hi);
  const bands = [band(0, 0.55), band(0.55, 0.8), band(0.8, 1.01)];

  function drawFlakes(list, t, w, h, m, dt) {
    const wind = m.x * 0.06 + Math.sin(t * 0.3) * 0.02;
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.beginPath();
    for (const f of list) {
      f.y += (0.025 + f.z * 0.07) * dt;
      f.x += (wind * f.z + Math.sin(t + f.ph) * 0.004) * dt;
      if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); }
      if (f.x > 1.02) f.x -= 1.04; else if (f.x < -0.02) f.x += 1.04;
      const r = (0.6 + f.z * 2.2) * (h / 900);
      ctx.moveTo(f.x * w + r, f.y * h); ctx.arc(f.x * w, f.y * h, r, 0, 6.283);
    }
    ctx.fill();
  }

  return {
    draw(t, w, h, m, dt) {
      if (w !== W || h !== H) {
        W = w; H = h;
        layers = [
          { ...pineLayer(w, h, { horizon: 0.72, minH: 0.12, maxH: 0.22, color: "#3a5478", snow: "#c9d8ee", spacing: w * 0.03 }), depth: 0.2 },
          { ...pineLayer(w, h, { horizon: 0.82, minH: 0.16, maxH: 0.3, color: "#1d2d47", snow: "#dfe8f6", spacing: w * 0.05 }), depth: 0.5 },
          { ...pineLayer(w, h, { horizon: 0.93, minH: 0.22, maxH: 0.42, color: "#0b1322", snow: "#eef3fb", spacing: w * 0.09 }), depth: 1 }
        ];
        bg = backdrop(w, h, (g, w, h) => {
          let gr = g.createLinearGradient(0, 0, 0, h);
          gr.addColorStop(0, "#081428"); gr.addColorStop(0.6, "#1f3a63"); gr.addColorStop(1, rgba(mixRgb(A, [70, 100, 150], 0.6)));
          g.fillStyle = gr; g.fillRect(0, 0, w, h);
          const mx = w * 0.22, my = h * 0.2, mr = Math.min(w, h) * 0.07;
          gr = g.createRadialGradient(mx, my, mr, mx, my, mr * 5);
          gr.addColorStop(0, "rgba(220,235,255,.25)"); gr.addColorStop(1, "rgba(220,235,255,0)");
          g.fillStyle = gr; g.fillRect(0, 0, w, h);
          g.fillStyle = "#eef4ff"; g.beginPath(); g.arc(mx, my, mr, 0, 6.283); g.fill();
        });
      }
      ctx.drawImage(bg, 0, 0);
      layers.forEach((L, i) => {
        drawFlakes(bands[i], t, w, h, m, dt);
        ctx.drawImage(L.c, -L.pad - m.x * L.pad * L.depth, 0);
      });
      ctx.fillStyle = "#e9f0fa";
      ctx.fillRect(0, h * 0.965, w, h * 0.04);
    }
  };
}

// Monsoon: slanted rain in depth over hills and a lake with ripples, plus the odd lightning flash
function rain(canvas, env) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const A = env.accent, N = Math.round(650 * env.n);
  const drops = Array.from({ length: N }, () => ({ x: Math.random() * 1.4 - 0.2, y: Math.random(), z: 0.3 + Math.random() * 0.7 }));
  const hill = (seed, n) => Array.from({ length: n + 1 }, (_, i) => 0.5 + 0.3 * Math.sin(i / n * 5 + seed) + 0.2 * Math.sin(i / n * 13 + seed * 2));
  const far = hill(0.7, 60), near = hill(2.3, 40);
  let ripples = [], flash = 0, nextFlash = 6, bolt = null, bg = null;

  function hills(g, pts, base, height, color, w) {
    g.fillStyle = color;
    g.beginPath(); g.moveTo(0, base);
    pts.forEach((v, i) => g.lineTo((i / (pts.length - 1)) * w, base - v * height));
    g.lineTo(w, base); g.closePath(); g.fill();
  }

  return {
    draw(t, w, h, m, dt) {
      const lake = h * 0.74;
      if (bg?.width !== w || bg?.height !== h) bg = backdrop(w, h, (g) => {
        let gr = g.createLinearGradient(0, 0, 0, lake);
        gr.addColorStop(0, "#0b1216"); gr.addColorStop(1, rgba(mixRgb(A, [40, 60, 66], 0.75)));
        g.fillStyle = gr; g.fillRect(0, 0, w, lake);
        hills(g, far, lake, h * 0.16, "#1a272c", w);
        hills(g, near, lake, h * 0.09, "#0e171a", w);
        gr = g.createLinearGradient(0, lake, 0, h);
        gr.addColorStop(0, rgba(mixRgb(A, [30, 48, 54], 0.8))); gr.addColorStop(1, "#05090b");
        g.fillStyle = gr; g.fillRect(0, lake, w, h - lake);
      });
      ctx.drawImage(bg, 0, 0);

      // ripples on the lake
      if (dt) for (let k = 0; k < 40 * dt * env.n * 3; k++) ripples.push({ x: Math.random() * w, y: lake + Math.random() * (h - lake), r: 0, life: 1 });
      ripples = ripples.filter((r) => (r.life -= dt * 1.3) > 0);
      ctx.lineWidth = 1;
      for (const r of ripples) {
        r.r += dt * h * 0.03;
        const depth = (r.y - lake) / (h - lake);
        ctx.strokeStyle = `rgba(200,230,235,${r.life * 0.35})`;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r * (0.5 + depth), r.r * 0.25 * (0.5 + depth), 0, 0, 6.283); ctx.stroke();
      }

      // rain in three depth bands
      const wind = 0.18 + m.x * 0.25, paths = [new Path2D(), new Path2D(), new Path2D()];
      for (const d of drops) {
        d.y += (0.9 + d.z * 1.2) * dt; d.x += wind * d.z * dt;
        if (d.y > 1) { d.y = -0.05; d.x = Math.random() * 1.4 - 0.2 - wind * 0.3; }
        const len = (0.015 + d.z * 0.035) * h, x = d.x * w, y = d.y * h;
        const p = paths[d.z < 0.55 ? 0 : d.z < 0.8 ? 1 : 2];
        p.moveTo(x, y); p.lineTo(x - wind * len * 0.9, y - len);
      }
      paths.forEach((p, i) => { ctx.strokeStyle = `rgba(190,215,225,${0.18 + i * 0.16})`; ctx.lineWidth = (0.6 + i * 0.5) * Math.max(1, h / 900); ctx.stroke(p); });

      // lightning
      if (t > nextFlash) {
        flash = 1; nextFlash = t + 7 + Math.random() * 10;
        bolt = [[w * (0.2 + Math.random() * 0.6), 0]];
        while (bolt[bolt.length - 1][1] < lake * 0.8) { const [x, y] = bolt[bolt.length - 1]; bolt.push([x + (Math.random() - 0.5) * w * 0.05, y + h * 0.05]); }
      }
      if (flash > 0) {
        ctx.fillStyle = `rgba(220,235,255,${flash * 0.25})`; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = `rgba(255,255,255,${flash})`; ctx.lineWidth = 2;
        ctx.beginPath(); bolt.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        flash -= dt * 2.5;
      }
    }
  };
}

// ---- WebGL shader scenes ----
const GLSL_LIB = `precision mediump float;
uniform vec2 R; uniform float T; uniform vec2 M; uniform vec3 C; uniform vec3 C2;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+.17;a*=.5;}return v;}
`;

const AURORA = `void main(){
  vec2 uv=gl_FragCoord.xy/R; float asp=R.x/R.y;
  vec3 col=mix(vec3(.005,.01,.03),vec3(.02,.04,.1),uv.y);
  float s=h(floor(uv*vec2(asp,1.)*350.));
  col+=vec3(.9)*step(.997,s)*(.6+.4*sin(T*3.+s*90.));
  float x=uv.x*asp+M.x*.15;
  for(int i=0;i<3;i++){
    float fi=float(i);
    float base=.45+fi*.1+.08*sin(x*1.1+T*.12+fi*2.)+.12*(fbm(vec2(x*.9+fi*3.,T*.06))-.5)+M.y*.03;
    float d=uv.y-base;
    float rays=fbm(vec2(x*14.+fi*7.,T*.25));
    float a=smoothstep(-.01,0.,d)*exp(-max(d,0.)*(5.+fi*2.))*(.35+.9*rays*rays);
    a+=exp(-d*d*2000.)*.5;
    vec3 c=mix(vec3(.15,1.,.55),C,clamp(d*2.5+fi*.2,0.,1.));
    c=mix(c,C2,clamp(d*1.5-.3,0.,1.));
    col+=c*a*(.55-fi*.12);
  }
  float hill=.12+.04*sin(uv.x*asp*3.+1.)+.03*fbm(vec2(uv.x*asp*4.,1.));
  col=mix(col,vec3(.003,.006,.012),smoothstep(hill+.003,hill,uv.y));
  gl_FragColor=vec4(col,1.);
}`;

const FLUID = `void main(){
  vec2 p=(gl_FragCoord.xy-.5*R)/R.y*2.5+M*.3;
  float t=T*.08;
  vec2 q=vec2(fbm(p+vec2(0.,t)),fbm(p+vec2(5.2,1.3)-t));
  vec2 r=vec2(fbm(p+3.*q+vec2(1.7,9.2)+t*1.5),fbm(p+3.*q+vec2(8.3,2.8)-t*1.2));
  float f=fbm(p+3.*r);
  vec3 col=mix(vec3(.02,.02,.06),C*.9,clamp(f*f*2.2,0.,1.));
  col=mix(col,C2,clamp(length(q)*.6-.2,0.,1.)*.75);
  col=mix(col,vec3(1.,.96,.92),clamp(r.x*r.x*r.x*1.3-.15,0.,1.)*.5);
  col*=.55+.6*f;
  vec2 uv=gl_FragCoord.xy/R;
  col*=.45+.55*pow(16.*uv.x*uv.y*(1.-uv.x)*(1.-uv.y),.25);
  gl_FragColor=vec4(col,1.);
}`;

function program(gl, vert, frag) {
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, vert));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(prog, 0, "p");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  const uniforms = {};
  return { prog, u: (name) => (uniforms[name] ??= gl.getUniformLocation(prog, name)) };
}
const getGL = (canvas) => {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false });
  if (!gl) throw new Error("WebGL unavailable");
  return gl;
};
const FULLSCREEN_VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}";

// Fullscreen fragment-shader scene
function glScene(frag) {
  return (canvas, env) => {
    const gl = getGL(canvas), { prog, u } = program(gl, FULLSCREEN_VERT, GLSL_LIB + frag);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one fullscreen triangle
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(u("C"), env.accent.map((v) => v / 255));
    gl.uniform3fv(u("C2"), env.accent2.map((v) => v / 255));
    return {
      draw(t, w, h, m) {
        gl.viewport(0, 0, w, h);
        gl.uniform2f(u("R"), w, h); gl.uniform1f(u("T"), t); gl.uniform2f(u("M"), m.x, -m.y);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };
  };
}

// Spiral galaxy: ~7k GPU points rotated in the vertex shader over a shader-drawn sky
const GALAXY_SKY = GLSL_LIB + `void main(){
  vec2 uv=gl_FragCoord.xy/R, c=(gl_FragCoord.xy-.5*R)/min(R.x,R.y);
  vec3 col=vec3(.012,.016,.04);
  float s=h(floor(uv*vec2(R.x/R.y,1.)*300.));
  col+=vec3(.7)*step(.996,s)*(.4+.6*fract(s*37.));
  col+=C*.22*exp(-dot(c,c)*9.);
  gl_FragColor=vec4(col,1.);
}`;
const GALAXY_VERT = `attribute vec3 p; attribute vec3 c;
uniform vec2 R; uniform float T; uniform vec2 M; varying vec3 vc;
void main(){
  float yaw=T*.05+M.x*.5, pitch=1.05+M.y*.25;
  float cy=cos(yaw), sy=sin(yaw), cp=cos(pitch), sp=sin(pitch);
  float x=p.x*cy-p.z*sy, z1=p.x*sy+p.z*cy;
  float y=p.y*cp-z1*sp, d=2.2+p.y*sp+z1*cp;
  float k=(min(R.x,R.y)*.6+max(R.x,R.y)*.4)*1.15/d;
  gl_Position=vec4(x*k/(.5*R.x),-y*k/(.5*R.y),0.,1.);
  gl_PointSize=max(2.,k*.008);
  vc=c;
}`;
const GALAXY_FRAG = `precision mediump float; varying vec3 vc;
void main(){ float r=length(gl_PointCoord-.5); gl_FragColor=vec4(vc*smoothstep(.5,.1,r),1.); }`;

function galaxy(canvas, env) {
  const gl = getGL(canvas);
  const N = Math.round(7000 * env.n), data = new Float32Array(N * 6);
  const core = [255, 232, 205];
  for (let i = 0; i < N; i++) {
    let x, y, z, r;
    if (i % 7 === 0) { // central bulge
      r = Math.abs(gauss()) * 0.08;
      const u = Math.random() * 6.283, v = Math.acos(2 * Math.random() - 1);
      x = r * Math.sin(v) * Math.cos(u); y = r * Math.cos(v) * 0.6; z = r * Math.sin(v) * Math.sin(u);
    } else {
      r = Math.random() ** 1.5;
      const a = (i % 3) * 2.094 + r * 6 + gauss() * 0.22, j = 0.05 * (1 - r * 0.5);
      x = Math.cos(a) * r + gauss() * j; y = gauss() * 0.04 * (1 - r) + gauss() * 0.008; z = Math.sin(a) * r + gauss() * j;
    }
    const col = r < 0.5 ? mixRgb(core, env.accent, r * 2) : mixRgb(env.accent, env.accent2, (r - 0.5) * 1.2);
    data.set([x, y, z, ...col.map((v) => (v / 255) * 0.9)], i * 6);
  }
  const sky = program(gl, FULLSCREEN_VERT, GALAXY_SKY), pts = program(gl, GALAXY_VERT, GALAXY_FRAG);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const cLoc = gl.getAttribLocation(pts.prog, "c");
  gl.useProgram(sky.prog);
  gl.uniform3fv(sky.u("C"), env.accent.map((v) => v / 255));
  gl.blendFunc(gl.ONE, gl.ONE);

  return {
    draw(t, w, h, m) {
      gl.viewport(0, 0, w, h);
      gl.disable(gl.BLEND);
      gl.useProgram(sky.prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.disableVertexAttribArray(cLoc);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(sky.u("R"), w, h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.enable(gl.BLEND);
      gl.useProgram(pts.prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(cLoc);
      gl.vertexAttribPointer(cLoc, 3, gl.FLOAT, false, 24, 12);
      gl.uniform2f(pts.u("R"), w, h); gl.uniform1f(pts.u("T"), t); gl.uniform2f(pts.u("M"), m.x, m.y);
      gl.drawArrays(gl.POINTS, 0, N);
    }
  };
}

const SCENE_BUILDERS = { webcity, festival, snow, rain, galaxy, warp, synthwave, globe, aurora: glScene(AURORA), fluid: glScene(FLUID) };

// ---- Controller: one running scene at a time ----
const Live = (() => {
  let host, canvas, scene, args, key = "", raf = 0, last = 0, t0 = 0, q, ro;
  // Adaptive resolution: if frames arrive late (busy CPU/GPU), render fewer pixels; recover slowly
  let dyn = 1, gapAvg = 0, settleUntil = 0, goodSince = 0;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => { mouse.tx = (e.clientX / innerWidth) * 2 - 1; mouse.ty = (e.clientY / innerHeight) * 2 - 1; });

  const now = () => (performance.now() - t0) / 1000;
  const drawOnce = () => scene && scene.draw(now(), canvas.width, canvas.height, mouse, 0);

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (ts - last < 1000 / q.fps - 2) return;
    const gap = ts - last, dt = Math.min(0.1, gap / 1000);
    last = ts;
    adapt(gap, ts);
    mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04;
    scene.draw(now(), canvas.width, canvas.height, mouse, dt);
  }
  function adapt(gap, ts) {
    if (ts < settleUntil) return; // ignore start-up and the frames right after a change
    const target = 1000 / q.fps;
    gapAvg = gapAvg ? gapAvg * 0.92 + gap * 0.08 : gap;
    if (gapAvg > target * 1.35 && dyn > 0.45) {
      dyn = Math.max(0.45, dyn * 0.85); resize(); goodSince = 0;
    } else if (gapAvg < target * 1.08 && dyn < 1) {
      goodSince ||= ts;
      if (ts - goodSince > 4000) { dyn = Math.min(1, dyn / 0.85); resize(); goodSince = 0; }
    } else {
      goodSince = 0;
    }
  }
  function play() {
    if (raf || !scene || !args.animate || document.hidden) return;
    last = performance.now();
    settleUntil = last + 2000; gapAvg = 0;
    raf = requestAnimationFrame(frame);
  }
  function pause() { cancelAnimationFrame(raf); raf = 0; }
  document.addEventListener("visibilitychange", () => (document.hidden ? pause() : play()));

  function resize() {
    const r = Math.min(devicePixelRatio || 1, 2) * q.scale * dyn;
    settleUntil = performance.now() + 1500; gapAvg = 0;
    canvas.width = Math.max(1, Math.round(host.clientWidth * r));
    canvas.height = Math.max(1, Math.round(host.clientHeight * r));
    drawOnce(); // resizing clears the canvas; repaint immediately to avoid a flash
  }

  function build(name, env) {
    canvas = document.createElement("canvas");
    canvas.className = "live-canvas";
    try {
      scene = (SCENE_BUILDERS[name] || galaxy)(canvas, env);
    } catch (err) {
      console.warn(`Live scene "${name}" failed, falling back to the 2D starfield:`, err);
      canvas = document.createElement("canvas");
      canvas.className = "live-canvas";
      scene = warp(canvas, env);
    }
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); pause(); });
    canvas.addEventListener("webglcontextrestored", () => { const a = args; key = ""; start(a.host, a.name, a); });
    host.prepend(canvas);
  }

  // opts: { accent: "#rrggbb", quality: "low|medium|high", animate: bool }
  function start(el, name, opts) {
    const k = [name, opts.accent, opts.quality, opts.animate].join("|");
    if (el === host && k === key) return;
    stop();
    host = el; key = k; args = { ...opts, host: el, name };
    q = LIVE_QUALITY[opts.quality] || LIVE_QUALITY.medium;
    dyn = 1;
    const accent = hexRgb(opts.accent);
    build(name, { accent, accent2: hueShift(accent, -45), n: q.n });
    t0 = performance.now() - 8000; // start a few seconds in so a still frame looks settled
    ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();
    play();
  }

  function stop() {
    pause();
    ro?.disconnect();
    canvas?.remove();
    host = canvas = scene = ro = null;
    key = "";
  }

  return { start, stop };
})();
