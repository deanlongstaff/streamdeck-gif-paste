const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { keyFrames, renderKeyFrames } = require('../com.deanlongstaff.gifpaste.sdPlugin/gif');

const FIXTURES = path.join(__dirname, 'fixtures');
const expected = require('./fixtures/expected.json');
const fixture = name => fs.readFileSync(path.join(FIXTURES, name));

// Minimal PNG reader for the encoder's own output (8-bit RGBA, filter 0).
function readPng(png) {
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let pos = 8, width, height;
  const idat = [];
  while (pos < png.length) {
    const len = png.readUInt32BE(pos);
    const type = png.toString('latin1', pos + 4, pos + 8);
    const data = png.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); }
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) raw.copy(rgba, y * width * 4, y * (width * 4 + 1) + 1, (y + 1) * (width * 4 + 1));
  return { width, height, rgba };
}

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

for (const [name, hashes] of Object.entries(expected)) {
  test(`${name}: every frame matches Pillow's rendering`, () => {
    // Fixtures are 96×96, so a 96px key frame is an unscaled copy of the canvas.
    const frames = keyFrames(fixture(name), 96, 1000);
    assert.equal(frames.length, hashes.length);
    frames.forEach((f, i) => assert.equal(sha256(readPng(f.png).rgba), hashes[i], `frame ${i}`));
  });
}

test('frame delays follow browser rules (0–1cs → 100ms)', () => {
  const frames = keyFrames(fixture('opaque.gif'), 96, 1000);
  assert.deepEqual(frames.map(f => f.ms), [20, 40, 100, 100, 50, 70, 80, 90]);
});

test('frame cap merges delays so total duration is preserved', () => {
  const all = keyFrames(fixture('opaque.gif'), 96, 1000);
  const capped = keyFrames(fixture('opaque.gif'), 96, 3);
  assert.equal(capped.length, 3);
  const total = frames => frames.reduce((sum, f) => sum + f.ms, 0);
  assert.equal(total(capped), total(all));
});

test('output is a square PNG of the requested key size', () => {
  for (const size of [72, 144]) {
    const { width, height } = readPng(keyFrames(fixture('interlaced.gif'), size)[0].png);
    assert.deepEqual([width, height], [size, size]);
  }
});

test('rejects files that are not GIFs', () => {
  assert.throws(() => keyFrames(Buffer.from('<html>not a gif</html>')), /Not a GIF/);
});

test('renderKeyFrames decodes in a worker thread', async () => {
  const frames = await renderKeyFrames(path.join(FIXTURES, 'dispose-previous.gif'), 96, 60);
  assert.equal(frames.length, expected['dispose-previous.gif'].length);
  assert.ok(Buffer.isBuffer(frames[0].png));
});
