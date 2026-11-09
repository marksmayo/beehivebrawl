// Shared end-to-end harness: a static file server for the repo plus headless Chrome
// driven over the DevTools protocol (no extra dependencies).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.json':'application/json', '.png':'image/png', '.glb':'model/gltf-binary' };
const CHROME = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
  .find(p => p && existsSync(p));
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function serve() {
  const srv = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    try {
      const body = await readFile(join(ROOT, path));
      res.writeHead(200, { 'content-type':TYPES[extname(path)] ?? 'application/octet-stream' }); res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { url:`http://127.0.0.1:${srv.address().port}/`, close:() => srv.close() };
}

export async function browser({ width = 1280, height = 720, mobile = false } = {}) {
  if (!CHROME) throw new Error('Chrome not found; set CHROME=/path/to/chrome');
  const port = 9400 + Math.floor(Math.random() * 400);
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--window-size=${width},${height}`,
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'bb-'))}`, 'about:blank'], { stdio:'ignore' });
  let targets;
  for (let i = 0; i < 50 && !targets; i++) { await sleep(200); targets = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json()).catch(() => null); }
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pending = new Map(), errors = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon/.test(m.params.entry.url ?? '')) errors.push(`${m.params.entry.text} ${m.params.entry.url ?? ''}`);
  };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id:i, method, params })); });
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  if (mobile) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor:2, mobile:true });
    await send('Emulation.setTouchEmulationEnabled', { enabled:true, maxTouchPoints:5 });
  }
  const page = {
    errors, send,
    goto: async url => { await send('Page.navigate', { url }); },
    eval: async expr => (await send('Runtime.evaluate', { expression:expr, awaitPromise:true, returnByValue:true })).result?.result?.value,
    waitFor: async (expr, ms = 90000) => { /* headless software rendering boots slowly */ const t = Date.now(); while (Date.now() - t < ms) { if (await page.eval(expr)) return true; await sleep(250); } return false; },
    key: async (code, ms = 70) => {
      await page.eval(`dispatchEvent(new KeyboardEvent('keydown',{code:'${code}',bubbles:true}))`); await sleep(ms);
      await page.eval(`dispatchEvent(new KeyboardEvent('keyup',{code:'${code}',bubbles:true}))`); await sleep(80);
    },
    touch: async (type, points) => send('Input.dispatchTouchEvent', { type, touchPoints:points }),
    tap: async (x, y, ms = 80) => { await page.touch('touchStart', [{ x, y }]); await sleep(ms); await page.touch('touchEnd', []); await sleep(80); },
    shot: async () => Buffer.from((await send('Page.captureScreenshot', { format:'png' })).result.data, 'base64'),
    // how many distinct colours a downscaled grid of the canvas has: a blank frame has very few
    variety: async () => page.eval(`new Promise(res => requestAnimationFrame(() => { const c = document.querySelector('canvas'), t = document.createElement('canvas'); t.width = 32; t.height = 18;
      const g = t.getContext('2d'); g.drawImage(c, 0, 0, 32, 18); const d = g.getImageData(0, 0, 32, 18).data, s = new Set();
      for (let i = 0; i < d.length; i += 4) s.add((d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3)); res(s.size); }))`), // read right after the game's own frame
    close: () => { ws.close(); proc.kill(); },
  };
  return page;
}
