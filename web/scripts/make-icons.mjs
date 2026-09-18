// Renders public/icons/icon.svg's shapes to the PNG sizes phones need:
// iOS ignores SVG apple-touch-icons, and Android only offers "Install
// app" when the manifest has 192px and 512px PNGs. No image libraries
// in the repo, so the (simple) icon geometry is rasterized here directly.
// Run from web/: node scripts/make-icons.mjs — keep it in sync with icon.svg.
import fs from 'node:fs';
import zlib from 'node:zlib';

const BG = [0x1c, 0x3d, 0x2e];
const FG = [0xf4, 0xef, 0xe6];

const distToSegment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

// Sample in the SVG's 512-unit space. Returns null (transparent), BG or FG.
function sample(x, y, { roundedCorners }) {
  if (roundedCorners) {
    const r = 96;
    const cx = Math.min(Math.max(x, r), 512 - r), cy = Math.min(Math.max(y, r), 512 - r);
    if (Math.hypot(x - cx, y - cy) > r) return null;
  }
  const inRect = (x0, y0, x1, y1) => x >= x0 && x < x1 && y >= y0 && y < y1;
  if (inRect(160, 176, 352, 216) || inRect(160, 236, 352, 276) || inRect(160, 296, 280, 336)) return FG;
  const d = Math.hypot(x - 330, y - 316);
  if (d >= 35 && d <= 49) return FG;
  if (distToSegment(x, y, 316, 316, 326, 326) <= 5 || distToSegment(x, y, 326, 326, 346, 302) <= 5) return FG;
  return BG;
}

function render(size, { roundedCorners, contentScale = 1 }) {
  const SS = 4; // 4x4 supersampling for smooth edges
  const px = Buffer.alloc(size * size * 4);
  const scale = 512 / (size * contentScale);
  const offset = (size - size * contentScale) / 2;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sj = 0; sj < SS; sj++) {
        for (let si = 0; si < SS; si++) {
          const x = (i + (si + 0.5) / SS - offset) * scale;
          const y = (j + (sj + 0.5) / SS - offset) * scale;
          const inside = x >= 0 && x < 512 && y >= 0 && y < 512;
          // Outside the scaled artwork (maskable padding) is solid background.
          const c = inside ? sample(x, y, { roundedCorners }) : (roundedCorners ? null : BG);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 1; }
        }
      }
      const o = (j * size + i) * 4;
      const n = SS * SS;
      px[o] = a ? Math.round(r / a) : 0;
      px[o + 1] = a ? Math.round(g / a) : 0;
      px[o + 2] = a ? Math.round(b / a) : 0;
      px[o + 3] = Math.round((a / n) * 255);
    }
  }
  return encodePng(size, px);
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../public/icons/', import.meta.url);
const files = {
  'icon-192.png': render(192, { roundedCorners: true }),
  'icon-512.png': render(512, { roundedCorners: true }),
  // Maskable: full-bleed background, artwork inside the 80% safe zone.
  'icon-maskable-512.png': render(512, { roundedCorners: false, contentScale: 0.8 }),
  // iOS rounds the corners itself and shows black behind transparency.
  'apple-touch-icon.png': render(180, { roundedCorners: false }),
};
for (const [name, buf] of Object.entries(files)) {
  fs.writeFileSync(new URL(name, out), buf);
  console.log(name, buf.length, 'bytes');
}
