// Generates Lantern app icons as PNGs (pure Node, no deps) into public/icons.
// Draws: peach->lavender->deep-violet gradient sky and a warm golden lantern.
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(OUT, { recursive: true });

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function encodePNG(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const s = y * (w * 4 + 1) + 1 + x * 4;
      const p = (y * w + x) * 4;
      raw[s] = rgba[p];
      raw[s + 1] = rgba[p + 1];
      raw[s + 2] = rgba[p + 2];
      raw[s + 3] = rgba[p + 3];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function lerpC(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

const SKY = [
  [244, 214, 196], // warm peach (top)
  [205, 172, 230], // lavender
  [60, 48, 92], // violet
  [36, 30, 56], // deep night (bottom)
];

function skyColor(t) {
  const seg = t * (SKY.length - 1);
  const i = Math.min(Math.floor(seg), SKY.length - 2);
  return lerpC(SKY[i], SKY[i + 1], seg - i);
}

function makeIcon(size, maskable) {
  const cx = size / 2;
  const cy = size / 2;
  const safe = maskable ? 0.5 : 0.82;
  const glowR = size * 0.4;
  const bodyR = size * 0.2 * safe * 1.6;

  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = y / size;
      let col = skyColor(t);
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);

      // warm glow around lantern
      if (d < glowR) col = lerpC(col, [232, 178, 108], (1 - d / glowR) * 0.8);
      // lantern orb
      if (d < bodyR) {
        const g = d / bodyR;
        col = lerpC([252, 208, 130], [255, 232, 168], Math.max(0, 1 - g));
      }
      const idx = (y * size + x) * 4;
      rgba[idx] = col[0];
      rgba[idx + 1] = col[1];
      rgba[idx + 2] = col[2];
      rgba[idx + 3] = 255;
    }
  }
  return rgba;
}

for (const [name, maskable] of [
  ["icon-192.png", false],
  ["icon-512.png", false],
  ["icon-512-maskable.png", true],
]) {
  const size = name.startsWith("icon-192") ? 192 : 512;
  const png = encodePNG(size, size, makeIcon(size, maskable));
  fs.writeFileSync(path.join(OUT, name), png);
  console.log("wrote", name, png.length, "bytes");
}