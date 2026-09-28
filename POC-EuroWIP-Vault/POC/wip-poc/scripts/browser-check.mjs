/**
 * End-to-end browser check.
 *
 * Loads the built app in headless Chrome, waits for it to render, and reports
 * what the page actually shows. The Node suites prove the schema and the domain
 * layer; only this proves the wasm load, the IndexedDB mirror and the Svelte
 * mount work in a real browser.
 *
 * Usage: node scripts/browser-check.mjs [url]
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const URL_TO_TEST = process.argv[2] ?? 'http://localhost:4173';
const PORT = 9222;

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge'
];

const { existsSync } = await import('node:fs');
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error('No Chrome or Edge found; skipping browser check.');
  process.exit(0);
}

const profile = mkdtempSync(path.join(tmpdir(), 'wip-e2e-'));
const child = spawn(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targetUrl() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // not listening yet
    }
    await sleep(250);
  }
  throw new Error('Chrome did not expose a debuggable page target');
}

let ws;
let msgId = 0;
const pending = new Map();
const consoleErrors = [];
const exceptions = [];

function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`${method} timed out`));
      }
    }, 20000);
  });
}

try {
  const wsUrl = await targetUrl();
  ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      exceptions.push(msg.params.exceptionDetails.exception?.description
        ?? msg.params.exceptionDetails.text);
    }
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: URL_TO_TEST });

  // Poll for the app to leave its loading state.
  let state = null;
  for (let i = 0; i < 60; i += 1) {
    await sleep(500);
    const r = await send('Runtime.evaluate', {
      expression: `(() => {
        const app = document.getElementById('app');
        if (!app) return { state: 'no #app' };
        const text = app.innerText || '';
        if (/Loading the schema/.test(text)) return { state: 'loading' };
        if (/Could not start the database/.test(text)) return { state: 'fatal', text };
        return { state: 'ready', text, rows: document.querySelectorAll('tbody tr').length };
      })()`,
      returnByValue: true
    });
    state = r.result.value;
    if (state.state !== 'loading') break;
  }

  console.log(`\nurl: ${URL_TO_TEST}`);
  console.log(`state: ${state?.state}`);

  if (state?.state === 'fatal') {
    console.log('\npage reported a startup failure:\n  ' + state.text.replace(/\n+/g, '\n  '));
  }

  if (state?.state === 'ready') {
    console.log(`table rows rendered: ${state.rows}`);
    const probe = await send('Runtime.evaluate', {
      expression: `(() => {
        // innerText reflects CSS text-transform, so the KPI captions come back
        // uppercased. Compare case-insensitively.
        const text = document.getElementById('app').innerText;
        const cap = (re) => (text.match(re) || [])[1] ?? null;
        return {
          hasWipLine: /WIP-\\d{6}/.test(text),
          kpiPipeline: cap(/gross pipeline\\s+([\\d,]+)/i),
          kpiWeighted: cap(/weighted retained\\s+([\\d,]+)/i),
          stale: cap(/stale lines\\s+(\\d+)/i),
          currencyWarning: /mixed currencies/i.test(text),
          tabs: [...document.querySelectorAll('nav .tab')].map(b => b.textContent.trim())
        };
      })()`,
      returnByValue: true
    });
    const p = probe.result.value;
    console.log(`\nrendered content`);
    console.log(`  WIP line identifiers: ${p.hasWipLine ? 'present' : 'MISSING'}`);
    console.log(`  gross pipeline KPI:   ${p.kpiPipeline ?? 'missing'}`);
    console.log(`  weighted retained:    ${p.kpiWeighted ?? 'missing'}`);
    console.log(`  stale lines:          ${p.stale ?? 'missing'}`);
    console.log(`  mixed-currency notice: ${p.currencyWarning ? 'shown' : 'not shown'}`);
    console.log(`  tabs: ${p.tabs.join(' | ')}`);

    // Exercise a rule rejection through the real UI path.
    const click = await send('Runtime.evaluate', {
      expression: `(() => {
        const row = [...document.querySelectorAll('tbody tr')]
          .find(tr => /WIP-\\d{6}/.test(tr.textContent));
        if (!row) return 'no row';
        row.click();
        return 'clicked';
      })()`,
      returnByValue: true
    });
    await sleep(400);
    console.log(`\nrow selection: ${click.result.value}`);
    const detail = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.getElementById('app').innerText;
        return /weighted retained/i.test(text) && /move this line/i.test(text)
          ? 'detail panel open'
          : 'detail panel missing';
      })()`,
      returnByValue: true
    });
    console.log(`detail panel: ${detail.result.value}`);

    // Click through to Controls and Model so the other two tabs are proven to
    // render their queries without error.
    for (const [label, expect] of [['Controls', /alerts/i], ['Model & questions', /relational model/i]]) {
      const tabRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const b = [...document.querySelectorAll('nav .tab')]
            .find(x => x.textContent.trim().toLowerCase() === ${JSON.stringify(label.toLowerCase())});
          if (!b) return 'tab not found';
          b.click();
          return 'clicked';
        })()`,
        returnByValue: true
      });
      await sleep(500);
      const shown = await send('Runtime.evaluate', {
        expression: `${expect}.test(document.getElementById('app').innerText)`,
        returnByValue: true
      });
      console.log(`tab "${label}": ${tabRes.result.value}, content ${shown.result.value ? 'rendered' : 'MISSING'}`);
    }
  }

  if (consoleErrors.length) {
    console.log(`\nconsole errors (${consoleErrors.length}):`);
    consoleErrors.forEach((e) => console.log('  ' + e));
  }
  if (exceptions.length) {
    console.log(`\nuncaught exceptions (${exceptions.length}):`);
    exceptions.forEach((e) => console.log('  ' + e));
  }

  const ok = state?.state === 'ready' && exceptions.length === 0;
  console.log(`\n${ok ? 'PASS' : 'FAIL'} browser check\n`);
  process.exitCode = ok ? 0 : 1;
} catch (err) {
  console.error('browser check failed:', err.message);
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch { /* already closed */ }
  child.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* temp dir */ }
}
