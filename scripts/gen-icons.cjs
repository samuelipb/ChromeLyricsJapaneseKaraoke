// Genera los iconos PNG de la extensión (16/32/48/128) sin dependencias externas.
// Diseño: cuadro azul marino con 3 "líneas de letra"; la del medio resaltada (wipe).
// Uso: node scripts/gen-icons.cjs  → escribe en public/icon/*.png
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function png(S, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0);
  ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((S * 4 + 1) * S);
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0; // filtro 0
    rgba.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function draw(S) {
  const buf = Buffer.alloc(S * S * 4);
  const set = (x, y, r, g, b, a) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    const ba = buf[i + 3] / 255;
    const na = a / 255;
    const oa = na + ba * (1 - na);
    if (oa === 0) return;
    buf[i] = Math.round((r * na + buf[i] * ba * (1 - na)) / oa);
    buf[i + 1] = Math.round((g * na + buf[i + 1] * ba * (1 - na)) / oa);
    buf[i + 2] = Math.round((b * na + buf[i + 2] * ba * (1 - na)) / oa);
    buf[i + 3] = Math.round(oa * 255);
  };
  const rect = (x0, y0, w, h, r, g, b, a, rad = 0) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (rad > 0) {
          const cx = Math.min(x, w - 1 - x);
          const cy = Math.min(y, h - 1 - y);
          if (cx < rad && cy < rad) {
            const dx = rad - cx;
            const dy = rad - cy;
            if (dx * dx + dy * dy > rad * rad) continue;
          }
        }
        set(x0 + x, y0 + y, r, g, b, a);
      }
  };

  rect(0, 0, S, S, 31, 42, 68, 255, Math.round(S * 0.22)); // fondo azul marino redondeado
  const bh = Math.max(2, Math.round(S * 0.13));
  const gap = Math.max(1, Math.round(S * 0.1));
  const m = Math.round(S * 0.2);
  const maxW = S - 2 * m;
  let y = Math.round((S - (bh * 3 + gap * 2)) / 2);
  const rad = Math.floor(bh / 2);
  rect(m, y, Math.round(maxW * 0.62), bh, 255, 255, 255, 120, rad); // línea tenue
  y += bh + gap;
  const w2 = Math.round(maxW * 0.92);
  const split = Math.round(w2 * 0.58);
  rect(m, y, split, bh, 45, 127, 249, 255, rad); // parte iluminada (wipe)
  rect(m + split, y, w2 - split, bh, 255, 255, 255, 120, rad); // resto tenue
  y += bh + gap;
  rect(m, y, Math.round(maxW * 0.5), bh, 255, 255, 255, 120, rad); // línea tenue
  return buf;
}

const outDir = path.join(__dirname, '..', 'public', 'icon');
fs.mkdirSync(outDir, { recursive: true });
for (const S of [16, 32, 48, 128]) {
  fs.writeFileSync(path.join(outDir, `${S}.png`), png(S, draw(S)));
  console.log('escrito', `public/icon/${S}.png`);
}
