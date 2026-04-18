const fs = require('fs');
const zlib = require('zlib');
const size = 512;
function makeCrcTable() {
  const c = [];
  for (let n = 0; n < 256; n++) {
    let cval = n;
    for (let k = 0; k < 8; k++) {
      cval = cval & 1 ? 0xedb88320 ^ (cval >>> 1) : cval >>> 1;
    }
    c[n] = cval;
  }
  return c;
}
const crcTable = makeCrcTable();
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}
const pixels = [];
for (let y = 0; y < size; y++) {
  const row = [];
  for (let x = 0; x < size; x++) {
    const cx = (x - size / 2) / (size / 2);
    const cy = (y - size / 2) / (size / 2);
    const d = Math.hypot(cx, cy);
    const [r, g, b] = d < 0.65 ? [46, 125, 50] : [255, 255, 255];
    row.push(0, r, g, b);
  }
  pixels.push(Buffer.from(row));
}
const raw = Buffer.concat(pixels);
const compress = zlib.deflateSync(raw);
const png = [Buffer.from('\x89PNG\r\n\x1a\n')];
png.push(chunk('IHDR', Buffer.concat([Buffer.from([0,0,0,size]), Buffer.from([0,0,0,size]), Buffer.from([8,6,0,0,0])] )));
png.push(chunk('IDAT', compress));
png.push(chunk('IEND', Buffer.alloc(0)));
if (!fs.existsSync('build')) {
  fs.mkdirSync('build');
}
fs.writeFileSync('build/icon.png', Buffer.concat(png));
console.log('Generated build/icon.png');
