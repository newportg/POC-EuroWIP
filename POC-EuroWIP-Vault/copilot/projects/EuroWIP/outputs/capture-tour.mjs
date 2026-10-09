/**
 * Capture the WIP POC screens for the walkthrough slideshow.
 *
 * Drives the built app in headless Chrome exactly the way a user would and
 * screenshots each screen. Alongside each shot it records the on-screen
 * position of a few key controls (as fractions of the viewport) so the
 * slideshow can draw animated highlight callouts on top of the real UI.
 *
 * Output: ./slides/01-*.png … and ./slides/callouts.json
 *
 * Usage:
 *   1) from the app folder:  npm run preview -- --port 4173
 *   2) node capture-tour.mjs [url]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const URL_TO_TEST = process.argv[2] ?? 'http://localhost:4173';
const PORT = 9223;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'slides');
mkdirSync(OUT, { recursive: true });

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

const profile = mkdtempSync(path.join(tmpdir(), 'wip-tour-'));
const child = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1440,900', 'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targetUrl() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const page = (await res.json()).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome did not expose a debuggable page target');
}

let ws; let msgId = 0; const pending = new Map();
function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`${method} timed out`)); } }, 20000);
  });
}

async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result?.value;
}

const callouts = {};
async function shot(name, specs = []) {
  if (specs.length) {
    const found = await ev(`(${JSON.stringify(specs)}).map(s => ({ label: s.label, rect: window.__rect(s.sel) }))`);
    callouts[name] = (found || []).filter((c) => c.rect);
  }
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
  console.log(`  ${name}.png${callouts[name] ? `  (${callouts[name].length} callout${callouts[name].length === 1 ? '' : 's'})` : ''}`);
}

try {
  ws = new WebSocket(await targetUrl());
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    }
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1.5, mobile: false
  });
  await send('Page.navigate', { url: URL_TO_TEST });

  for (let i = 0; i < 60; i += 1) {
    await sleep(500);
    const s = await ev(`(() => {
      const t = (document.getElementById('app')||{}).innerText || '';
      return /Loading the schema/.test(t) ? 'loading'
        : /Could not start the database/.test(t) ? 'fatal' : 'ready';
    })()`);
    if (s !== 'loading') break;
  }
  await sleep(400);

  // dismiss the startup walkthrough prompt so it doesn't cover the first shot
  await ev(`(() => { const b = document.getElementById('introSkip'); if (b) b.click(); })()`);
  await sleep(300);

  await ev(`window.__t = {
    tab: (n) => [...document.querySelectorAll('nav .tab')].find(b => b.textContent.trim().toLowerCase() === n).click(),
    pill: (id) => [...document.querySelectorAll('.step-pill')].find(b => b.dataset.step === id).click(),
    key: (k) => document.querySelector('[data-key="'+k+'"]'),
    setNative: (el, v) => {
      const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
        : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
  window.__rect = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const W = window.innerWidth || 1440, H = window.innerHeight || 900;
    if (r.bottom < 0 || r.top > H) return null;
    return {
      x: Math.max(0, r.left) / W,
      y: Math.max(0, r.top) / H,
      w: Math.min(r.right, W) / W - Math.max(0, r.left) / W,
      h: (Math.min(r.bottom, H) - Math.max(0, r.top)) / H
    };
  }; true;`);

  console.log('capturing:');
  await shot('01-dashboard', [
    { label: 'KPI bar — the whole pipeline at a glance', sel: '.kpis' }
  ]);

  // Create — Type
  await ev(`window.__t.tab('create')`); await sleep(350);
  await shot('02-create-type', [
    { label: 'Pick the service line', sel: '.type-card[data-type="valuation"]' }
  ]);

  // Create — Client
  await ev(`document.querySelector('.type-card[data-type="valuation"]').click()`); await sleep(200);
  await ev(`window.__t.pill('client').click()`); await sleep(200);
  await ev(`window.__t.setNative(document.querySelector('#clientLookup'), 'ma')`); await sleep(650);
  await shot('03-create-client', [
    { label: 'Mock client directory — pick one to fill the form', sel: '#clientLookupResults' }
  ]);
  await ev(`(document.querySelector('#clientLookupResults .loqate-result')||{click(){}}).click()`); await sleep(250);

  // Create — Property
  await ev(`window.__t.pill('property').click()`); await sleep(200);
  await ev(`window.__t.setNative(document.querySelector('#loqateQuery'), 'EC')`); await sleep(200);
  await ev(`document.querySelector('.country-btn').click()`); await sleep(300);
  await shot('04-create-property', [
    { label: 'Country picker — flags, UK by default', sel: '.country-menu' }
  ]);
  await ev(`window.__t.setNative(window.__t.key('address'), '1 Liverpool Street')`);
  await ev(`window.__t.setNative(window.__t.key('city'), 'London')`);
  await ev(`window.__t.setNative(window.__t.key('postcode'), 'EC2M 7NH')`);
  await sleep(150);

  // Create — Details
  await ev(`window.__t.pill('details').click()`); await sleep(200);
  await ev(`window.__t.setNative(document.querySelector('#d-kf_valuationpurpose'), 'Secured Lending')`);
  await ev(`window.__t.setNative(document.querySelector('#d-kf_valuationbasis'), 'Market Value')`);
  await ev(`window.__t.setNative(document.querySelector('#d-kf_instructiondate'), '2026-10-09')`);
  await ev(`window.__t.setNative(document.querySelector('#d-kf_reportduedate'), '2026-11-15')`);
  await sleep(200);
  await shot('05-create-details', [
    { label: 'Only the fields this instruction type needs', sel: '.form-grid' }
  ]);

  // Create — Terms
  await ev(`window.__t.pill('terms').click()`); await sleep(200);
  await ev(`window.__t.setNative(document.querySelector('#owningOffice'), 'Paris')`); await sleep(250);
  await ev(`window.__t.setNative(document.querySelector('#assignedTo'), 'Claire Fournier')`); await sleep(200);
  await ev(`window.__t.setNative(window.__t.key('feeBasis'), 'Fixed fee')`);
  await ev(`window.__t.setNative(window.__t.key('expectedRevenue'), '275000')`);
  await sleep(250);
  await shot('06-create-terms', [
    { label: 'Office and negotiator are linked both ways', sel: '#assignedTo' }
  ]);

  // Create — Review
  await ev(`window.__t.pill('review').click()`); await sleep(300);
  await shot('07-create-review', [
    { label: 'All five steps complete', sel: '.readiness' },
    { label: 'Accept instruction', sel: '#acceptBtn' }
  ]);

  // Create — Accepted
  await ev(`document.querySelector('#acceptBtn').click()`); await sleep(800);
  await shot('08-create-accepted', [
    { label: 'Accepted — its first WIP line opened', sel: '.success-banner' },
    { label: 'Record frozen at acceptance', sel: '.json-out' }
  ]);

  // WIP
  await ev(`window.__t.tab('wip')`); await sleep(550);
  await ev(`(document.querySelector('tbody tr')||{click(){}}).click()`); await sleep(350);
  await shot('09-wip', [
    { label: 'Every line, searchable and filterable', sel: 'tbody tr' }
  ]);

  // Controls
  await ev(`window.__t.tab('controls')`); await sleep(450);
  await shot('10-controls', [
    { label: 'Alerts, ageing and period locking', sel: '.alert-row' }
  ]);

  // Model
  await ev(`window.__t.tab('model & questions')`); await sleep(450);
  await shot('11-model', [
    { label: 'The relational model behind it', sel: '.card' }
  ]);

  writeFileSync(path.join(OUT, 'callouts.json'), JSON.stringify(callouts, null, 2));
  console.log('done.');
} catch (err) {
  console.error('capture failed:', err.message);
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch { /* closed */ }
  child.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* temp */ }
}
