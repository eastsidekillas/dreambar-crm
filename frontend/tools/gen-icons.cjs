/**
 * Генератор PWA-иконок DreamBar — без внешних инструментов (PNG через zlib).
 * Тёмный фон + золотой силуэт бокала-мартини. Запуск: node tools/gen-icons.cjs
 * Перегенерировать при смене брендинга.
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const BG = [15, 15, 26];       // #0f0f1a
const GOLD = [184, 146, 42];   // #B8922A
const SS = 4;                  // суперсэмплинг для сглаживания

// ── PNG encode ──────────────────────────────────────────────
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const stride = w * 4, raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ── geometry ────────────────────────────────────────────────
function roundRectSDF(x, y, W, H, r) {
  const qx = Math.abs(x - W / 2) - (W / 2 - r), qy = Math.abs(y - H / 2) - (H / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
}
function inTri(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}
function inRect(x, y, x0, y0, x1, y1) { return x >= x0 && x <= x1 && y >= y0 && y <= y1; }

/** Бокал-мартини в нормированных координатах [0..1] для точки (нормированной). */
function inGlass(nx, ny) {
  // чаша (перевёрнутый треугольник)
  if (inTri(nx, ny, 0.235, 0.305, 0.765, 0.305, 0.5, 0.575)) return true;
  // ножка
  if (inRect(nx, ny, 0.483, 0.55, 0.517, 0.735)) return true;
  // основание
  if (inRect(nx, ny, 0.39, 0.735, 0.61, 0.765)) return true;
  return false;
}

function render(size, { rounded }) {
  const W = size * SS, H = size * SS;
  const r = rounded ? 0.20 * W : 0; // скругление только у «any»
  const buf = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const inBg = roundRectSDF(x + 0.5, y + 0.5, W, H, r) <= 0;
    const col = inGlass((x + 0.5) / W, (y + 0.5) / H) ? GOLD : BG;
    const i = (y * W + x) * 4;
    if (inBg) { buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]; buf[i + 3] = 255; }
    else { buf[i + 3] = 0; }
  }
  // downsample SSxSS усреднением
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let R = 0, G = 0, B = 0, A = 0;
    for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) {
      const i = ((y * SS + dy) * W + (x * SS + dx)) * 4;
      const a = buf[i + 3]; A += a; R += buf[i] * a; G += buf[i + 1] * a; B += buf[i + 2] * a;
    }
    const o = (y * size + x) * 4, n = SS * SS;
    out[o] = A ? Math.round(R / A) : 0; out[o + 1] = A ? Math.round(G / A) : 0;
    out[o + 2] = A ? Math.round(B / A) : 0; out[o + 3] = Math.round(A / n);
  }
  return encodePNG(size, size, out);
}

const dir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(dir, { recursive: true });
const jobs = [
  ['icon-192.png', 192, { rounded: true }],
  ['icon-512.png', 512, { rounded: true }],
  ['icon-maskable-512.png', 512, { rounded: false }],
  ['apple-touch-icon.png', 180, { rounded: false }],
];
for (const [name, size, opt] of jobs) {
  fs.writeFileSync(path.join(dir, name), render(size, opt));
  console.log('wrote', name, size);
}