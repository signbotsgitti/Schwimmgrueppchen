// Erzeugt PNG-Icons ohne externe Abhängigkeiten (reines Node: zlib + PNG-Encoder).
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG = hex("#0b3d5c"), SUN = hex("#ffd166"), W1 = hex("#1e88c7"), W2 = hex("#3fb0e8"), W3 = hex("#8ad4f5");

function draw(size, maskable) {
  const s = size / 512;
  const radius = maskable ? 0 : 96 * s;
  return (x, y) => {
    // abgerundete Ecken (nur nicht-maskable)
    if (radius > 0) {
      const cx = Math.min(Math.max(x, radius), size - radius), cy = Math.min(Math.max(y, radius), size - radius);
      if ((x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) return [0, 0, 0, 0];
    }
    const X = x / s, Y = y / s;
    const wave = (base) => base + 20 * Math.sin((X / 128) * Math.PI * 2);
    let c = BG;
    if (Y > wave(420)) c = W3; else if (Y > wave(360)) c = W2; else if (Y > wave(300)) c = W1;
    else if ((X - 368) ** 2 + (Y - 150) ** 2 < 54 ** 2) c = SUN;
    return [...c, 255];
  };
}
mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", png(192, draw(192, false)));
writeFileSync("public/icons/icon-512.png", png(512, draw(512, false)));
writeFileSync("public/icons/icon-512-maskable.png", png(512, draw(512, true)));
console.log("Icons erzeugt: public/icons/icon-192.png, icon-512.png, icon-512-maskable.png");
