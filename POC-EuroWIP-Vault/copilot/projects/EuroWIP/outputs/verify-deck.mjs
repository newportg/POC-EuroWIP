/**
 * Smoke-test the walkthrough slideshow: loads it in headless Chrome and checks
 * that every screenshot loaded, the deck advances, and nothing errors.
 *
 * Usage: node verify-deck.mjs [fileUrlOrPath]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2]
  ? (/^https?:/.test(process.argv[2]) ? process.argv[2] : pathToFileURL(path.resolve(process.argv[2])).href)
  : pathToFileURL(path.join(HERE, 'app-walkthrough.html')).href;
const PORT = 9224;

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'
];
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) { console.error('No Chrome or Edge found.'); process.exit(1); }

const profile = mkdtempSync(path.join(tmpdir(), 'wip-deck-'));
const child = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--allow-file-access-from-files`,
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1600,1000', 'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws; let msgId = 0; const pending = new Map(); const errors = [];
const send = (method, params = {}) => {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error(method + ' timed out')); } }, 15000);
  });
};
const ev = async (expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;

try {
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      wsUrl = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl;
    } catch { /* not up */ }
    if (!wsUrl) await sleep(250);
  }
  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result);
    }
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
      errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
    if (m.method === "Runtime.exceptionThrown")
      errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  });

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: target });
  await sleep(1800);

  const info = await ev(`(() => {
    const imgs = [...document.querySelectorAll('img.shot')];
    const broken = imgs.filter(i => !i.complete || i.naturalWidth === 0)
                       .map(i => i.getAttribute('src'));
    const active = [...document.querySelectorAll('.slide')].findIndex(s => s.classList.contains('active'));
    return {
      slides: document.querySelectorAll('.slide').length,
      dots: document.querySelectorAll('.dot').length,
      images: imgs.length, broken,
      active,
      callouts: document.querySelectorAll('.callout').length,
      title: document.title
    };
  })()`);

  console.log(`slides:   ${info.slides}`);
  console.log(`dots:     ${info.dots}`);
  console.log(`images:   ${info.images}  broken: ${info.broken.length ? info.broken.join(", ") : "none"}`);
  console.log(`callouts: ${info.callouts}`);
  console.log(`active:   ${info.active}`);

  await ev(`(document.getElementById('next')||{}).click()`);
  await sleep(700);
  const after = await ev(`(() => {
    const active = [...document.querySelectorAll('.slide')].findIndex(s => s.classList.contains('active'));
    return { active, progress: document.getElementById('progress').style.width,
             count: document.getElementById('count').textContent };
  })()`);
  console.log(`\nafter Next: active ${after.active}, progress ${after.progress}, count ${after.count}`);

  const ok = info.slides === 13 && info.broken.length === 0 && after.active === 1 && errors.length === 0;
  if (errors.length) { console.log("\nconsole errors:"); errors.forEach((e) => console.log("  " + e)); }
  console.log(`\n${ok ? "PASS" : "FAIL"} deck check\n`);
  process.exitCode = ok ? 0 : 1;
} catch (err) {
  console.error("deck check failed:", err.message);
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch { /* closed */ }
  child.kill();
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* temp */ }
}
