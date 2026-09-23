// GIF Paste — Stream Deck plugin (macOS, no dependencies).
// Each key takes a GIF URL (or local path), shows it animated on the key,
// and pastes it into the focused app when pressed.
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const CACHE_DIR = path.join(os.homedir(), 'Library/Caches/com.deanlongstaff.gifpaste');
const FRAMES_JS = path.join(__dirname, 'frames.js');
const KEY_SIZE = 144;
const MAX_FRAMES = 60;
const MIN_FRAME_MS = 66;          // ~15 fps cap for setImage
const MAX_BYTES = 30 * 1024 * 1024;

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].slice(1)] = process.argv[i + 1];

// ---------- helpers ----------

const run = (cmd, argv, opts = {}) => new Promise((resolve, reject) =>
  execFile(cmd, argv, { maxBuffer: 256 * 1024 * 1024, ...opts },
    (err, stdout, stderr) => err ? reject(new Error(stderr?.trim() || err.message)) : resolve(stdout)));

const isGif = buf => buf.length > 6 && buf.subarray(0, 4).toString('latin1') === 'GIF8';

function safeName(source) {
  let base = 'gif';
  try { base = path.basename(new URL(source).pathname) || base; } catch { base = path.basename(source); }
  base = base.replace(/\.gif$/i, '').replace(/[^\w.-]+/g, '-').slice(0, 60) || 'gif';
  return `${base}.gif`;
}

async function fetchBytes(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) StreamDeck-GIF-Paste' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const len = Number(res.headers.get('content-length') || 0);
  if (len > MAX_BYTES) throw new Error('GIF is too large');
  return { type: res.headers.get('content-type') || '', buf: Buffer.from(await res.arrayBuffer()) };
}

// Accepts direct GIF links, and page links (Giphy/Tenor) via their og:image / og:video tags.
async function download(url) {
  let { type, buf } = await fetchBytes(url);
  if (!isGif(buf) && /html/i.test(type)) {
    const html = buf.toString('utf8');
    const metas = [...html.matchAll(/<meta[^>]+(?:property|name)=["'](og:image|twitter:image)["'][^>]*>/gi)]
      .map(m => (m[0].match(/content=["']([^"']+)["']/i) || [])[1])
      .filter(Boolean)
      .map(u => u.replace(/&amp;/g, '&'));
    const pick = metas.find(u => /\.gif(\?|$)/i.test(u)) || metas[0];
    if (!pick) throw new Error('No GIF found on that page');
    ({ buf } = await fetchBytes(new URL(pick, url).href));
  }
  if (!isGif(buf)) throw new Error('URL is not a GIF');
  if (buf.length > MAX_BYTES) throw new Error('GIF is too large');
  return buf;
}

// Returns the local file path for a source (URL or path), downloading and caching URLs.
async function resolveFile(source) {
  if (!/^https?:\/\//i.test(source)) {
    const p = source.replace(/^~(?=\/|$)/, os.homedir());
    if (!fs.existsSync(p)) throw new Error('File not found');
    return p;
  }
  const dir = path.join(CACHE_DIR, crypto.createHash('sha256').update(source).digest('hex').slice(0, 16));
  const file = path.join(dir, safeName(source));
  if (fs.existsSync(file)) return file;
  const buf = await download(source);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(file + '.tmp', buf);
  await fsp.rename(file + '.tmp', file);
  return file;
}

async function renderFrames(file) {
  try {
    const out = await run('osascript', ['-l', 'JavaScript', FRAMES_JS, file, String(KEY_SIZE), String(MAX_FRAMES)]);
    const frames = JSON.parse(out);
    if (frames.length) return frames.map(f => ({ ms: Math.max(MIN_FRAME_MS, f.ms || 100), img: `data:image/png;base64,${f.png}` }));
  } catch (e) { log(`frames.js failed: ${e.message}`); }
  // Fallback: static first frame via sips
  const png = path.join(os.tmpdir(), `gifpaste-${process.pid}-${Date.now()}.png`);
  await run('sips', ['-s', 'format', 'png', '-Z', String(KEY_SIZE), file, '--out', png]);
  const b64 = (await fsp.readFile(png)).toString('base64');
  fsp.unlink(png).catch(() => {});
  return [{ ms: 0, img: `data:image/png;base64,${b64}` }];
}

// Share work between keys using the same GIF.
const loads = new Map();
function load(source) {
  if (!loads.has(source)) {
    const p = (async () => {
      const file = await resolveFile(source);
      return { file, frames: await renderFrames(file) };
    })();
    p.catch(() => loads.delete(source));
    loads.set(source, p);
  }
  return loads.get(source);
}

const PASTE_FILE = [
  'use framework "AppKit"',
  'use scripting additions',
  'on run argv',
  "set pb to current application's NSPasteboard's generalPasteboard()",
  "pb's clearContents()",
  "pb's writeObjects:{current application's NSURL's fileURLWithPath:(item 1 of argv)}",
  'delay 0.05',
  'tell application "System Events" to keystroke "v" using command down',
  'end run'
].flatMap(l => ['-e', l]);

const PASTE_TEXT = [
  'on run argv',
  'set the clipboard to (item 1 of argv)',
  'delay 0.05',
  'tell application "System Events" to keystroke "v" using command down',
  'end run'
].flatMap(l => ['-e', l]);

// ---------- key state ----------

const keys = new Map(); // context -> { settings, timer, gen }

function stopAnim(k) { clearTimeout(k.timer); k.timer = null; }

function animate(context, k, frames) {
  stopAnim(k);
  if (!frames.length) return;
  if (frames.length === 1 || k.settings.animate === false) {
    return send({ event: 'setImage', context, payload: { image: frames[0].img, target: 0 } });
  }
  let i = 0;
  const tick = () => {
    if (keys.get(context) !== k) return;
    send({ event: 'setImage', context, payload: { image: frames[i].img, target: 0 } });
    const ms = frames[i].ms;
    i = (i + 1) % frames.length;
    k.timer = setTimeout(tick, ms);
  };
  tick();
}

function status(context, text, ok = true) {
  send({ event: 'sendToPropertyInspector', context, payload: { status: text, ok } });
}

async function prepare(context) {
  const k = keys.get(context);
  if (!k) return;
  const gen = ++k.gen;
  stopAnim(k);
  const source = (k.settings.url || '').trim();
  if (!source) {
    send({ event: 'setImage', context, payload: { image: null, target: 0 } });
    return status(context, 'Enter a GIF URL');
  }
  status(context, 'Loading…');
  try {
    const { frames } = await load(source);
    if (keys.get(context) !== k || k.gen !== gen) return;
    animate(context, k, frames);
    status(context, `Ready · ${frames.length} frame${frames.length === 1 ? '' : 's'}`);
  } catch (e) {
    if (keys.get(context) !== k || k.gen !== gen) return;
    send({ event: 'setImage', context, payload: { image: null, target: 0 } });
    send({ event: 'showAlert', context });
    status(context, e.message, false);
  }
}

async function paste(context, settings) {
  const source = (settings.url || '').trim();
  if (!source) return send({ event: 'showAlert', context });
  try {
    if (settings.mode === 'link' && /^https?:\/\//i.test(source)) {
      await run('osascript', [...PASTE_TEXT, source]);
    } else {
      const { file } = await load(source);
      await run('osascript', [...PASTE_FILE, file]);
    }
  } catch (e) {
    log(`paste failed: ${e.message}`);
    send({ event: 'showAlert', context });
  }
}

function onMessage(m) {
  const { event, context } = m;
  switch (event) {
    case 'willAppear':
      keys.set(context, { settings: m.payload.settings || {}, timer: null, gen: 0 });
      prepare(context);
      break;
    case 'willDisappear': {
      const k = keys.get(context);
      if (k) stopAnim(k);
      keys.delete(context);
      break;
    }
    case 'didReceiveSettings': {
      const k = keys.get(context);
      if (!k) break;
      const prev = k.settings;
      k.settings = m.payload.settings || {};
      if (prev.url !== k.settings.url || prev.animate !== k.settings.animate) prepare(context);
      break;
    }
    case 'keyDown':
      paste(context, m.payload.settings || keys.get(context)?.settings || {});
      break;
    case 'sendToPlugin':
      if (m.payload?.refresh) {
        const src = (keys.get(context)?.settings.url || '').trim();
        if (src) {
          loads.delete(src);
          const dir = path.join(CACHE_DIR, crypto.createHash('sha256').update(src).digest('hex').slice(0, 16));
          fs.rmSync(dir, { recursive: true, force: true });
        }
      }
      prepare(context);
      break;
  }
}

// ---------- minimal WebSocket client ----------

const sock = net.connect(Number(args.port), '127.0.0.1');
let buf = Buffer.alloc(0), open = false;

function send(obj, op = 1) {
  if (!open) return;
  const p = Buffer.isBuffer(obj) ? obj : Buffer.from(JSON.stringify(obj));
  let hdr;
  if (p.length < 126) hdr = Buffer.from([0x80 | op, 0x80 | p.length]);
  else if (p.length < 65536) { hdr = Buffer.alloc(4); hdr[0] = 0x80 | op; hdr[1] = 0xfe; hdr.writeUInt16BE(p.length, 2); }
  else { hdr = Buffer.alloc(10); hdr[0] = 0x80 | op; hdr[1] = 0xff; hdr.writeBigUInt64BE(BigInt(p.length), 2); }
  const mask = crypto.randomBytes(4);
  const body = Buffer.allocUnsafe(p.length);
  for (let i = 0; i < p.length; i++) body[i] = p[i] ^ mask[i & 3];
  sock.write(Buffer.concat([hdr, mask, body]));
}

function log(message) { send({ event: 'logMessage', payload: { message: `[gifpaste] ${message}` } }); }

sock.on('connect', () => {
  const key = crypto.randomBytes(16).toString('base64');
  sock.write(`GET / HTTP/1.1\r\nHost: 127.0.0.1:${args.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
});

let fragments = [];
sock.on('data', d => {
  buf = Buffer.concat([buf, d]);
  if (!open) {
    const i = buf.indexOf('\r\n\r\n');
    if (i < 0) return;
    buf = buf.subarray(i + 4);
    open = true;
    send({ event: args.registerEvent, uuid: args.pluginUUID });
  }
  for (;;) {
    if (buf.length < 2) return;
    const fin = buf[0] & 0x80, op = buf[0] & 0x0f;
    let len = buf[1] & 0x7f, off = 2;
    if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
    if (buf.length < off + len) return;
    const payload = buf.subarray(off, off + len);
    buf = buf.subarray(off + len);
    if (op === 1 || op === 0) {
      fragments.push(payload);
      if (!fin) continue;
      const text = Buffer.concat(fragments).toString();
      fragments = [];
      try { onMessage(JSON.parse(text)); } catch (e) { log(`message error: ${e.message}`); }
    } else if (op === 9) send(payload, 0xa);
    else if (op === 8) process.exit(0);
  }
});

sock.on('close', () => process.exit(0));
sock.on('error', () => process.exit(1));
