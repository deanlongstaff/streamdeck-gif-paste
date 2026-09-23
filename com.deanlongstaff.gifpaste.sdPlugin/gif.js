// Pure-JS GIF → key frames: decode, composite, fill-crop to a square, encode PNG.
// No dependencies, works on every platform. Runs in a worker thread via renderKeyFrames().
const fs = require('fs');
const zlib = require('zlib');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// ---------- decode ----------

function parseGif(buf) {
  const sig = buf.toString('latin1', 0, 6);
  if (sig !== 'GIF87a' && sig !== 'GIF89a') throw new Error('Not a GIF');
  const width = buf.readUInt16LE(6), height = buf.readUInt16LE(8);
  const packed = buf[10];
  let pos = 13, globalPalette = null;
  if (packed & 0x80) {
    const n = 3 * (1 << ((packed & 7) + 1));
    globalPalette = buf.subarray(pos, pos + n);
    pos += n;
  }

  const readSubBlocks = () => {
    const parts = [];
    for (let len = buf[pos++]; len; len = buf[pos++]) {
      parts.push(buf.subarray(pos, pos + len));
      pos += len;
    }
    return parts;
  };

  const frames = [];
  let gce = null;
  while (pos < buf.length) {
    const block = buf[pos++];
    if (block === 0x3b) break; // trailer
    if (block === 0x21) {
      const label = buf[pos++];
      if (label === 0xf9) {
        const p = buf[pos + 1];
        gce = { disposal: (p >> 2) & 7, transparent: p & 1 ? buf[pos + 4] : -1, delay: buf.readUInt16LE(pos + 2) };
      }
      readSubBlocks();
    } else if (block === 0x2c) {
      const x = buf.readUInt16LE(pos), y = buf.readUInt16LE(pos + 2);
      const w = buf.readUInt16LE(pos + 4), h = buf.readUInt16LE(pos + 6);
      const p = buf[pos + 8];
      pos += 9;
      let palette = globalPalette;
      if (p & 0x80) {
        const n = 3 * (1 << ((p & 7) + 1));
        palette = buf.subarray(pos, pos + n);
        pos += n;
      }
      const minCodeSize = buf[pos++];
      const data = Buffer.concat(readSubBlocks());
      frames.push({ x, y, w, h, interlaced: !!(p & 0x40), palette, minCodeSize, data,
        disposal: gce ? gce.disposal : 0, transparent: gce ? gce.transparent : -1, delay: gce ? gce.delay : 0 });
      gce = null;
    } else {
      break; // unknown block: stop at what we have
    }
  }
  if (!frames.length) throw new Error('GIF has no frames');
  return { width, height, frames };
}

function lzwDecode(minCodeSize, data, pixelCount) {
  const out = new Uint8Array(pixelCount);
  const clear = 1 << minCodeSize, eoi = clear + 1;
  const prefix = new Uint16Array(4096), suffix = new Uint8Array(4096), stack = new Uint8Array(4097);
  for (let i = 0; i < clear; i++) suffix[i] = i;
  let size = minCodeSize + 1, mask = (1 << size) - 1, next = eoi + 1;
  let old = -1, first = 0, bits = 0, cur = 0, pos = 0, op = 0;

  while (op < pixelCount) {
    while (bits < size) {
      if (pos >= data.length) return out;
      cur |= data[pos++] << bits;
      bits += 8;
    }
    let code = cur & mask;
    cur >>>= size;
    bits -= size;

    if (code === clear) { size = minCodeSize + 1; mask = (1 << size) - 1; next = eoi + 1; old = -1; continue; }
    if (code === eoi) break;
    if (old === -1) { out[op++] = suffix[code]; old = first = code; continue; }
    if (code > next) break; // corrupt stream

    const inCode = code;
    let sp = 0;
    if (code === next) { stack[sp++] = first; code = old; }
    while (code > eoi) { stack[sp++] = suffix[code]; code = prefix[code]; }
    first = suffix[code];
    stack[sp++] = first;
    while (sp && op < pixelCount) out[op++] = stack[--sp];

    if (next < 4096) {
      prefix[next] = old;
      suffix[next] = first;
      next++;
      if (next === mask + 1 && size < 12) { size++; mask = (1 << size) - 1; }
    }
    old = inCode;
  }
  return out;
}

function deinterlace(pixels, w, h) {
  const out = new Uint8Array(pixels.length);
  let row = 0;
  for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) {
    for (let y = start; y < h; y += step, row++) out.set(pixels.subarray(row * w, row * w + w), y * w);
  }
  return out;
}

// ---------- resize (fill + centre-crop, premultiplied alpha) ----------

function fillCrop(src, sw, sh, size) {
  const dst = new Uint8Array(size * size * 4);
  const scale = Math.max(size / sw, size / sh);
  const ox = (sw - size / scale) / 2, oy = (sh - size / scale) / 2;
  const inv = 1 / scale;

  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      if (inv > 1) {
        // downscale: box average over covered source pixels
        const x0 = Math.floor(ox + dx * inv), x1 = Math.max(x0 + 1, Math.floor(ox + (dx + 1) * inv));
        const y0 = Math.floor(oy + dy * inv), y1 = Math.max(y0 + 1, Math.floor(oy + (dy + 1) * inv));
        for (let y = y0; y < y1 && y < sh; y++) {
          for (let x = x0; x < x1 && x < sw; x++) {
            const i = (y * sw + x) * 4, al = src[i + 3];
            r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += al; n++;
          }
        }
      } else {
        // upscale: bilinear
        const fx = Math.min(sw - 1, Math.max(0, ox + (dx + 0.5) * inv - 0.5));
        const fy = Math.min(sh - 1, Math.max(0, oy + (dy + 0.5) * inv - 0.5));
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
        const tx = fx - x0, ty = fy - y0;
        for (const [x, y, wgt] of [[x0, y0, (1 - tx) * (1 - ty)], [x1, y0, tx * (1 - ty)], [x0, y1, (1 - tx) * ty], [x1, y1, tx * ty]]) {
          const i = (y * sw + x) * 4, al = src[i + 3] * wgt;
          r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += al; n += wgt;
        }
      }
      const o = (dy * size + dx) * 4;
      if (a > 0) {
        dst[o] = Math.round(r / a); dst[o + 1] = Math.round(g / a); dst[o + 2] = Math.round(b / a);
        dst[o + 3] = Math.round(a / n);
      }
    }
  }
  return dst;
}

// ---------- PNG encode ----------

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n;
});
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---------- composite ----------

function keyFrames(buf, size = 144, maxFrames = 60) {
  const { width: W, height: H, frames } = parseGif(buf);
  const canvas = new Uint8Array(W * H * 4);
  const step = Math.max(1, Math.ceil(frames.length / maxFrames));
  const out = [];
  let prev = null, saved = null;

  frames.forEach((f, idx) => {
    if (prev) {
      if (prev.disposal === 2) {
        for (let y = prev.y; y < Math.min(H, prev.y + prev.h); y++) canvas.fill(0, (y * W + prev.x) * 4, (y * W + Math.min(W, prev.x + prev.w)) * 4);
      } else if (prev.disposal === 3 && saved) {
        canvas.set(saved);
      }
    }
    saved = f.disposal === 3 ? canvas.slice() : null;

    let px = lzwDecode(f.minCodeSize, f.data, f.w * f.h);
    if (f.interlaced) px = deinterlace(px, f.w, f.h);
    const pal = f.palette;
    if (pal) {
      for (let y = 0; y < f.h; y++) {
        const cy = f.y + y;
        if (cy >= H) break;
        for (let x = 0; x < f.w; x++) {
          const cx = f.x + x;
          if (cx >= W) break;
          const ci = px[y * f.w + x];
          if (ci === f.transparent || ci * 3 + 2 >= pal.length) continue;
          const o = (cy * W + cx) * 4;
          canvas[o] = pal[ci * 3]; canvas[o + 1] = pal[ci * 3 + 1]; canvas[o + 2] = pal[ci * 3 + 2]; canvas[o + 3] = 255;
        }
      }
    }
    prev = f;

    const ms = f.delay <= 1 ? 100 : f.delay * 10; // browsers treat 0–1cs as 100ms
    if (idx % step === 0) out.push({ ms, png: encodePng(fillCrop(canvas, W, H, size), size, size) });
    else out[out.length - 1].ms += ms;
  });
  return out;
}

// Decode off the main thread so the Stream Deck connection stays responsive.
function renderKeyFrames(file, size, maxFrames) {
  return new Promise((resolve, reject) => {
    const w = new Worker(__filename, { workerData: { file, size, maxFrames } });
    w.once('message', m => m.error ? reject(new Error(m.error)) : resolve(m.frames.map(f => ({ ms: f.ms, png: Buffer.from(f.png) }))));
    w.once('error', reject);
    w.once('exit', code => code && reject(new Error(`GIF decoder exited with ${code}`)));
  });
}

if (!isMainThread && workerData?.file) {
  try {
    const frames = keyFrames(fs.readFileSync(workerData.file), workerData.size, workerData.maxFrames);
    parentPort.postMessage({ frames });
  } catch (e) {
    parentPort.postMessage({ error: e.message });
  }
}

module.exports = { keyFrames, renderKeyFrames, parseGif, encodePng };
