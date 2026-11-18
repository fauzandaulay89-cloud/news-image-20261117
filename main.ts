// news-image-20261117: one image summing up Tuesday 17 November 2026 world news.
// Node 22+ stdlib only, no network at runtime. Draws a 1024x1024 PNG from scratch
// (own rasteriser + own PNG encoder) and writes it to /output/entry.png.
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Deterministic: every pixel is a pure function of constants below.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;
const img = Buffer.alloc(W * H * 3);

// ---------- palette ----------
const PAPER = [247, 243, 234];
const INK = [24, 32, 44];
const NAVY = [15, 42, 68];
const NAVY2 = [22, 58, 90];
const GOLD = [212, 175, 55];
const WHITE = [255, 255, 255];
const GREY = [110, 118, 130];
const LIGHTGREY = [226, 222, 212];
const RED = [192, 57, 43];
const ORANGE = [230, 126, 34];
const YELLOW = [241, 196, 15];
const BLUE = [46, 134, 193];
const SKY = [133, 193, 233];
const TEAL = [23, 165, 137];
const PURPLE = [125, 60, 152];
const STEEL = [93, 109, 126];
const GREEN = [39, 174, 96];

// ---------- raster helpers ----------
function px(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2];
}
function rect(x, y, w, h, c) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c);
}
function circle(cx, cy, r, c) {
  for (let y = -r; y <= r; y++) {
    const dx = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -dx; x <= dx; x++) px(cx + x, cy + y, c);
  }
}
function ring(cx, cy, r, t, c) {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++) {
      px(Math.round(cx + (r + k) * Math.cos(rad)), Math.round(cy + (r + k) * Math.sin(rad)), c);
    }
  }
}
function line(x0, y0, x1, y1, c, w = 1) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) px(x + a, y + b, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function tri(x0, y0, x1, y1, x2, y2, c) {
  const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d;
      const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d;
      const cc = 1 - a - b;
      if (a >= 0 && b >= 0 && cc >= 0) px(x, y, c);
    }
  }
}

// ---------- 5x7 bitmap font (own design, rows as 5-bit numbers) ----------
const FONT = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 6, 8, 16, 31], '3': [30, 1, 1, 14, 1, 1, 30],
  '4': [2, 6, 10, 18, 31, 2, 2], '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [14, 16, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14], '9': [14, 17, 17, 15, 1, 1, 14],
  ' ': [0, 0, 0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12],
  ',': [0, 0, 0, 0, 12, 4, 8], "'": [4, 4, 8, 0, 0, 0, 0],
  ':': [0, 12, 12, 0, 12, 12, 0], '-': [0, 0, 0, 14, 0, 0, 0],
  '/': [1, 2, 2, 4, 8, 8, 16], '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
};
function textWidth(s, scale) {
  return s.length * 6 * scale - scale;
}
function drawText(s, cx, y, scale, c, centered = true) {
  const x0 = centered ? cx - Math.floor(textWidth(s, scale) / 2) : cx;
  for (let n = 0; n < s.length; n++) {
    const g = FONT[s[n]] ?? FONT[' '];
    const gx = x0 + n * 6 * scale;
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if ((g[r] >> (4 - col)) & 1) rect(gx + col * scale, y + r * scale, scale, scale, c);
      }
    }
  }
}

// ---------- PNG encoder (zlib + CRC32, stdlib only) ----------
const CRC_TABLE = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}
function encodePNG() {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    img.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- pictograms (each drawn inside a panel, cx = panel centre) ----------
function picBridge(cx, cy) {
  // sea
  rect(cx - 118, cy + 62, 236, 34, [176, 208, 226]);
  line(cx - 118, cy + 72, cx + 118, cy + 72, BLUE, 2);
  line(cx - 118, cy + 84, cx + 118, cy + 84, BLUE, 2);
  // towers
  rect(cx - 96, cy - 30, 12, 92, STEEL);
  rect(cx + 84, cy - 30, 12, 92, STEEL);
  rect(cx - 102, cy - 38, 24, 10, STEEL);
  rect(cx + 78, cy - 38, 24, 10, STEEL);
  // deck, left and right spans
  rect(cx - 118, cy + 52, 96, 10, INK);
  rect(cx + 22, cy + 52, 96, 10, INK);
  // broken middle span, tilted down
  line(cx - 22, cy + 52, cx + 22, cy + 78, RED, 7);
  // suspension cables
  line(cx - 90, cy - 36, cx - 22, cy + 52, GREY, 2);
  line(cx + 90, cy - 36, cx + 22, cy + 52, GREY, 2);
  // blast smoke + sparks over the break
  circle(cx - 8, cy + 8, 16, [200, 200, 200]);
  circle(cx + 14, cy - 2, 12, [220, 220, 220]);
  circle(cx + 2, cy - 14, 9, [235, 235, 235]);
  tri(cx, cy - 34, cx + 8, cy - 14, cx - 8, cy - 14, ORANGE);
  tri(cx - 16, cy - 22, cx - 2, cy - 8, cx - 20, cy - 4, YELLOW);
  tri(cx + 18, cy - 24, cx + 4, cy - 8, cx + 22, cy - 6, YELLOW);
}
function picSummit(cx, cy) {
  // table arc
  line(cx - 108, cy + 78, cx + 108, cy + 78, [120, 90, 60], 8);
  rect(cx - 108, cy + 82, 216, 8, [120, 90, 60]);
  // three flags: China (red + star), Russia (white/blue/red), USA (stripes + canton)
  const poles = [-84, 0, 84];
  for (let i = 0; i < 3; i++) line(cx + poles[i], cy - 62, cx + poles[i], cy + 78, INK, 3);
  rect(cx - 81, cy - 62, 62, 34, RED);
  circle(cx - 66, cy - 45, 6, YELLOW);
  rect(cx + 3, cy - 62, 62, 34, WHITE);
  rect(cx + 3, cy - 51, 62, 11, BLUE);
  rect(cx + 3, cy - 40, 62, 12, RED);
  rect(cx + 87, cy - 62, 62, 34, WHITE);
  for (let s = 0; s < 4; s++) rect(cx + 87, cy - 62 + s * 9, 62, 4, RED);
  rect(cx + 87, cy - 62, 26, 18, NAVY);
  circle(cx + 100, cy - 53, 3, WHITE);
  // handshake dots under flags
  circle(cx - 52, cy + 58, 9, TEAL);
  circle(cx + 52, cy + 58, 9, TEAL);
  circle(cx, cy + 58, 9, GOLD);
}
function picChip(cx, cy) {
  // pins
  for (let i = 0; i < 5; i++) {
    rect(cx - 66 + i * 28, cy - 78, 10, 14, GREY);
    rect(cx - 66 + i * 28, cy + 64, 10, 14, GREY);
    rect(cx - 78, cy - 66 + i * 28, 14, 10, GREY);
    rect(cx + 64, cy - 66 + i * 28, 14, 10, GREY);
  }
  rect(cx - 64, cy - 64, 128, 128, INK);
  rect(cx - 52, cy - 52, 104, 104, NAVY2);
  rect(cx - 34, cy - 34, 68, 68, [30, 80, 120]);
  drawText('AI', cx, cy - 21, 6, WHITE);
  // circuit traces
  line(cx - 52, cy - 44, cx - 40, cy - 44, GOLD, 2);
  line(cx + 40, cy + 44, cx + 52, cy + 44, GOLD, 2);
  circle(cx - 40, cy - 44, 4, GOLD);
  circle(cx + 40, cy + 44, 4, GOLD);
}
function picStrike(cx, cy) {
  // target rings
  ring(cx, cy + 6, 62, 5, RED);
  ring(cx, cy + 6, 44, 4, WHITE);
  ring(cx, cy + 6, 26, 4, RED);
  circle(cx, cy + 6, 10, RED);
  // explosion starburst
  for (let a = 0; a < 8; a++) {
    const rad = (a * Math.PI) / 4;
    const x1 = cx + Math.round(70 * Math.cos(rad)), y1 = cy + 6 + Math.round(70 * Math.sin(rad));
    const x2 = cx + Math.round(96 * Math.cos(rad + 0.18)), y2 = cy + 6 + Math.round(96 * Math.sin(rad + 0.18));
    const x3 = cx + Math.round(96 * Math.cos(rad - 0.18)), y3 = cy + 6 + Math.round(96 * Math.sin(rad - 0.18));
    tri(x1, y1, x2, y2, x3, y3, a % 2 ? YELLOW : ORANGE);
  }
  circle(cx, cy + 6, 16, ORANGE);
  circle(cx, cy + 6, 8, YELLOW);
}
function picJet(cx, cy) {
  // rising sun
  circle(cx + 52, cy - 28, 42, RED);
  circle(cx + 52, cy - 28, 30, [220, 90, 80]);
  // contrails
  line(cx - 118, cy + 66, cx - 30, cy + 30, SKY, 4);
  line(cx - 118, cy + 82, cx - 30, cy + 46, SKY, 4);
  // jet silhouette: delta fuselage + swept wings (climbing to the right)
  tri(cx - 30, cy + 30, cx + 96, cy - 6, cx - 30, cy + 46, INK);
  tri(cx - 6, cy + 22, cx + 34, cy - 34, cx + 30, cy + 18, INK);
  tri(cx - 8, cy + 46, cx + 26, cy + 70, cx + 28, cy + 36, INK);
  tri(cx - 30, cy + 30, cx - 58, cy + 22, cx - 30, cy + 46, STEEL);
  circle(cx + 78, cy - 2, 5, WHITE);
}
function picVirus(cx, cy) {
  // spikes
  for (let a = 0; a < 12; a++) {
    const rad = (a * Math.PI) / 6;
    const x1 = cx + Math.round(52 * Math.cos(rad)), y1 = cy + Math.round(52 * Math.sin(rad));
    const x2 = cx + Math.round(78 * Math.cos(rad)), y2 = cy + Math.round(78 * Math.sin(rad));
    line(x1, y1, x2, y2, RED, 5);
    circle(x2, y2, 7, RED);
  }
  circle(cx, cy, 52, [231, 76, 60]);
  circle(cx - 18, cy - 14, 10, [192, 57, 43]);
  circle(cx + 16, cy + 12, 12, [192, 57, 43]);
  circle(cx + 20, cy - 20, 7, [192, 57, 43]);
  circle(cx - 14, cy + 20, 6, [192, 57, 43]);
  // small dots around
  circle(cx - 96, cy - 52, 6, RED);
  circle(cx + 98, cy + 40, 6, RED);
  circle(cx + 92, cy - 58, 5, ORANGE);
  circle(cx - 100, cy + 48, 5, ORANGE);
}

// ---------- layout ----------
const PANELS = [
  { accent: STEEL, title: ['CRIMEAN BRIDGE', 'HIT'], sub: ['UKRAINE STRIKES,', 'RUSSIA HITS KYIV'], pic: picBridge },
  { accent: TEAL, title: ['XI, PUTIN, TRUMP', 'TO MEET AT APEC'], sub: ['TRILATERAL SUMMIT', 'IN SHENZHEN'], pic: picSummit },
  { accent: PURPLE, title: ['US TIGHTENS', 'AI CHIP BAN'], sub: ['EXPORT CURBS', 'ON CHINA'], pic: picChip },
  { accent: ORANGE, title: ['US STRIKES IRAN', 'MISSILE SITE'], sub: ['QESHM ISLAND,', 'HORMUZ TENSE'], pic: picStrike },
  { accent: BLUE, title: ['JAPAN SCRAMBLES', 'JETS AT RUSSIA'], sub: ['AIRSPACE', 'VIOLATION'], pic: picJet },
  { accent: RED, title: ['US LOSES MEASLES', 'FREE STATUS'], sub: ['5,400 CASES,', 'AFTER 26 YEARS'], pic: picVirus },
];

function draw() {
  rect(0, 0, W, H, PAPER);

  // header
  rect(0, 0, W, 140, NAVY);
  rect(0, 140, W, 6, GOLD);
  // small globe mark
  circle(78, 70, 34, SKY);
  circle(78, 70, 34, NAVY2);
  ring(78, 70, 34, 3, SKY);
  line(44, 70, 112, 70, SKY, 2);
  line(78, 36, 78, 104, SKY, 2);
  // title
  drawText('17 NOVEMBER 2026', 552, 34, 5, WHITE);
  drawText('TUESDAY - THE WORLD IN ONE IMAGE', 552, 96, 2, GOLD);

  // panels: 3 cols x 2 rows
  const pw = 312, ph = 380, gx = 30, gy = 162, gap = 14;
  for (let i = 0; i < 6; i++) {
    const col = i % 3, row = Math.floor(i / 3);
    const x = gx + col * (pw + gap), y = gy + row * (ph + 16);
    const p = PANELS[i];
    rect(x, y, pw, ph, WHITE);
    rect(x, y, pw, 10, p.accent);
    // thin border
    rect(x, y, pw, 2, LIGHTGREY);
    rect(x, y + ph - 2, pw, 2, LIGHTGREY);
    rect(x, y, 2, ph, LIGHTGREY);
    rect(x + pw - 2, y, 2, ph, LIGHTGREY);
    const cx = x + pw / 2;
    p.pic(cx, y + 118);
    drawText(p.title[0], cx, y + 218, 3, INK);
    if (p.title[1]) drawText(p.title[1], cx, y + 248, 3, INK);
    drawText(p.sub[0], cx, y + 292, 2, GREY);
    if (p.sub[1]) drawText(p.sub[1], cx, y + 312, 2, GREY);
    // thin rule above sub
    rect(cx - 40, y + 282, 80, 3, p.accent);
  }

  // footer strip
  rect(0, 948, W, 76, NAVY);
  drawText('ALSO: DEPARDIEU ADMITS ASSAULT - FRANCE PROTESTS - MONGOLIA LEADER RESIGNS', 512, 978, 2, WHITE);
}

draw();
const png = encodePNG();
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), png);
