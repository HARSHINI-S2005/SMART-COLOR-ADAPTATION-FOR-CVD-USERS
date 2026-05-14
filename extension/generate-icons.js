// ============================================
//   ChromaSense — Icon Generator (No Dependencies)
//   Pure Node.js — works with Node 14+
//   Run: node generate-icons.js
// ============================================

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---- Ensure icons/ folder exists ----
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
  console.log('Created icons/ directory');
}

// ============================================
//   MINIMAL PNG WRITER (pure Node.js, no deps)
// ============================================

function writePNG(width, height, pixels) {
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    crcTable[i] = c;
  }

  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function u32(n) {
    return Buffer.from([(n>>>24)&0xFF,(n>>>16)&0xFF,(n>>>8)&0xFF,n&0xFF]);
  }

  function chunk(type, data) {
    const tb  = Buffer.from(type,'ascii');
    const crc = crc32(Buffer.concat([tb, data]));
    return Buffer.concat([u32(data.length), tb, data, u32(crc)]);
  }

  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = chunk('IHDR', Buffer.concat([
    u32(width), u32(height),
    Buffer.from([8,2,0,0,0])
  ]));

  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0);
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      raw.push(pixels[idx], pixels[idx+1], pixels[idx+2]);
    }
  }

  const compressed = zlib.deflateSync(Buffer.from(raw), { level: 6 });
  return Buffer.concat([sig, ihdr, chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

// ============================================
//   DRAW ICON
// ============================================

function drawIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  const cx = size / 2, cy = size / 2, r = size / 2;
  const purple = [124,111,255], darkP = [90,75,200];
  const white = [255,255,255], dark = [13,13,20], bg = [13,13,20];

  function setPixel(x, y, color, alpha) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const a = alpha / 255;
    pixels[i]   = Math.round(color[0]*a + bg[0]*(1-a));
    pixels[i+1] = Math.round(color[1]*a + bg[1]*(1-a));
    pixels[i+2] = Math.round(color[2]*a + bg[2]*(1-a));
    pixels[i+3] = 255;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      pixels[i]=bg[0]; pixels[i+1]=bg[1]; pixels[i+2]=bg[2]; pixels[i+3]=255;

      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < r - 0.5) {
        const t = dist / r;
        const col = [
          Math.round(darkP[0]+(purple[0]-darkP[0])*(1-t*0.5)),
          Math.round(darkP[1]+(purple[1]-darkP[1])*(1-t*0.5)),
          Math.round(darkP[2]+(purple[2]-darkP[2])*(1-t*0.5)),
        ];
        setPixel(x, y, col, dist > r-1.5 ? Math.round((r-0.5-dist)*255) : 255);
      }

      const eyeY = cy + cy*0.04, eyeRX = r*0.54, eyeRY = r*0.27;
      const ed = ((x-cx)**2)/(eyeRX**2) + ((y-eyeY)**2)/(eyeRY**2);
      if (dist < r-0.5 && ed < 1.0)
        setPixel(x, y, white, ed > 0.85 ? Math.round((1-ed)/0.15*255) : 255);

      const pd = Math.sqrt((x-cx)**2 + (y-eyeY)**2), pr = r*0.18;
      if (dist < r-0.5 && pd < pr)
        setPixel(x, y, dark, pd > pr-1 ? Math.round((pr-pd)*255) : 255);

      const hd = Math.sqrt((x-(cx+r*0.07))**2 + (y-(eyeY-r*0.07))**2), hr = r*0.07;
      if (dist < r-0.5 && hd < hr)
        setPixel(x, y, white, 255);
    }
  }
  return pixels;
}

[16, 48, 128].forEach(size => {
  const png = writePNG(size, size, drawIcon(size));
  const out = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(out, png);
  console.log(`✓ icon${size}.png  (${png.length} bytes)`);
});

console.log('\n✅ All icons generated! Now load the extension in Chrome.');