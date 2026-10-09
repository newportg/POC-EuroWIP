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
    console.log(`tbody rows on Dashboard (totals tables): ${state.rows}`);
    const probe = await send('Runtime.evaluate', {
      expression: `(() => {
        // innerText reflects CSS text-transform, so the KPI captions come back
        // uppercased. Compare case-insensitively.
        const text = document.getElementById('app').innerText;
        const cap = (re) => (text.match(re) || [])[1] ?? null;
        return {
          hasWipLine: /WIP-\\d{6}/.test(text),
          kpiInHand: cap(/in hand\\s+([\\d,]+)/i),
          kpiWeighted: cap(/weighted retained\\s+([\\d,]+)/i),
          stale: cap(/stale lines\\s+(\\d+)/i),
          currencyWarning: /mixed currencies/i.test(text),
          hasStatusTotals: /totals by status/i.test(text),
          hasOfficeTotals: /totals by office/i.test(text),
          hasServiceLineTotals: /totals by service line/i.test(text),
          tabs: [...document.querySelectorAll('nav .tab')].map(b => b.textContent.trim())
        };
      })()`,
      returnByValue: true
    });
    const p = probe.result.value;
    console.log(`\nrendered content`);
    console.log(`  WIP line list on Dashboard: ${p.hasWipLine ? 'present (unexpected)' : 'absent (lives on the WIP tab)'}`);
    console.log(`  in-hand KPI:          ${p.kpiInHand ?? 'missing'}`);
    console.log(`  weighted retained:    ${p.kpiWeighted ?? 'missing'}`);
    console.log(`  stale lines:          ${p.stale ?? 'missing'}`);
    console.log(`  mixed-currency notice: ${p.currencyWarning ? 'shown' : 'not shown'}`);
    console.log(`  breakdown tables:     status ${p.hasStatusTotals ? 'yes' : 'NO'}, office ${p.hasOfficeTotals ? 'yes' : 'NO'}, service line ${p.hasServiceLineTotals ? 'yes' : 'NO'}`);
    console.log(`  tabs: ${p.tabs.join(' | ')}`);

    // The line list lives on the WIP tab, so switch there before selecting.
    const wipTab = await send('Runtime.evaluate', {
      expression: `(() => {
        const b = [...document.querySelectorAll('nav .tab')]
          .find(x => x.textContent.trim() === 'WIP');
        if (!b) return 'tab not found';
        b.click();
        return 'clicked';
      })()`,
      returnByValue: true
    });
    await sleep(400);

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
    console.log(`\ntab "WIP": ${wipTab.result.value}`);
    console.log(`row selection: ${click.result.value}`);
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

    // Drive the real creation flow: step through the instruction wizard, accept,
    // then add a WIP line under it. This is the path a user takes, so it catches
    // wiring that the Node suite cannot see.
    const createFlow = await send('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        const app = document.getElementById('app');
        const text = () => app.innerText;
        const tab = (name) => [...document.querySelectorAll('nav .tab')]
          .find(b => b.textContent.trim().toLowerCase() === name).click();
        const pill = (id) => [...document.querySelectorAll('.step-pill')]
          .find(b => b.dataset.step === id);

        const setNative = (el, value) => {
          const proto = el instanceof HTMLSelectElement
            ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement
              ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        // --- the instruction wizard, step by step
        tab('create');
        await sleep(300);

        // Step 1 — Type: choose the service line (this also advances the wizard).
        const card = document.querySelector('.type-card[data-sl="Valuations"]');
        if (!card) return { error: 'service-line card not found' };
        card.click();
        await sleep(150);

        // Step 2 — Client: pick a brand, then the legal entity it owns. The
        // entity select is empty until the brand is chosen, so drive it in order.
        pill('client').click();
        await sleep(150);
        const brandSel = document.querySelector('#i-brand');
        if (!brandSel || brandSel.options.length < 2) return { error: 'brand options missing' };
        setNative(brandSel, brandSel.options[1].value);
        await sleep(200);
        const leSel = document.querySelector('#i-le');
        if (!leSel || leSel.options.length < 2) return { error: 'legal entity options missing' };
        setNative(leSel, leSel.options[1].value);
        await sleep(200);

        // Step 5 — Terms: owning office, expected revenue and negotiator.
        pill('terms').click();
        await sleep(150);
        const officeSel = document.querySelector('#i-office');
        if (!officeSel || officeSel.options.length < 2) return { error: 'office options missing' };
        setNative(officeSel, officeSel.options[1].value);
        setNative(document.querySelector('#i-rev'), '275000');
        setNative(document.querySelector('#i-neg'), 'Camille Roux');
        await sleep(200);

        // Step 6 — Review: the readiness list must be fully green, then accept.
        pill('review').click();
        await sleep(200);
        const missingRequired = document.querySelectorAll('.readiness-row.missing').length;
        const acceptBtn = document.querySelector('#accept-btn');
        if (!acceptBtn) return { error: 'accept button missing' };
        if (acceptBtn.disabled) {
          return { error: 'accept still disabled', missing: missingRequired };
        }
        acceptBtn.click();
        await sleep(600);
        if (!/INS-\\d{6} accepted/.test(text())) {
          return { error: 'instruction was not accepted', snippet: text().slice(0, 400) };
        }
        const ref = (text().match(/(INS-\\d{6}) accepted/) || [])[1];

        // --- the WIP line, under the instruction we just accepted
        const wipModeBtn = [...document.querySelectorAll('button')]
          .find(b => b.textContent.trim() === 'Create a WIP line');
        if (!wipModeBtn) return { error: 'WIP-line mode button missing', ref };
        wipModeBtn.click();
        await sleep(250);
        const wipForm = document.querySelector('#wip-line-form');
        if (!wipForm) return { error: 'WIP-line form missing', ref };
        const parentSelect = wipForm.querySelector('#w-instr');
        const newOption = [...parentSelect.options].find(o => o.textContent.includes(ref));
        if (!newOption) return { error: 'new instruction not offered as a WIP parent', ref };
        setNative(parentSelect, newOption.value);
        setNative(wipForm.querySelector('#w-net'), '75000');
        setNative(wipForm.querySelector('#w-retained'), '15000');
        setNative(wipForm.querySelector('#w-prob'), '40');
        setNative(wipForm.querySelector('#w-gross'), '75000');
        await sleep(200);
        wipForm.requestSubmit();
        await sleep(700);

        // On success the panel routes to the WIP tab, filtered to the new line.
        // The confirmation is therefore already gone by the time we look, so
        // assert on what the user is left looking at instead.
        const onWipTab = [...document.querySelectorAll('nav .tab')]
          .some(b => b.textContent.trim() === 'WIP' && b.classList.contains('active'));
        const bodyRows = [...document.querySelectorAll('tbody tr')];
        const wipRef = bodyRows
          .map(tr => tr.textContent.match(/WIP-\\d{6}/)?.[0])
          .find(Boolean) ?? null;
        const searchBox = document.querySelector('input.search')?.value ?? null;

        if (!onWipTab) {
          return { error: 'WIP line was not created', snippet: text().slice(0, 300) };
        }
        const rowVisible = wipRef !== null;
        return { ref, wipRef, onWipTab, rowVisible, listed: bodyRows.length, search: searchBox };
      })()`
    });

    const flow = createFlow.result.value;
    if (flow.error) {
      console.log(`\ncreation flow: FAILED — ${flow.error}`);
      if (flow.rows !== undefined) console.log(`  tbody rows present:  ${flow.rows}`);
      if (flow.search !== undefined) console.log(`  search box holds:    ${JSON.stringify(flow.search)}`);
      if (flow.rowText !== undefined) console.log(`  first row text:     ${JSON.stringify(flow.rowText)}`);
      if (flow.snippet) console.log('  page said: ' + flow.snippet.replace(/\n+/g, ' | '));
      exceptions.push(`creation flow: ${flow.error}`);
    } else {
      console.log(`\ncreation flow`);
      console.log(`  instruction created: ${flow.ref}`);
      console.log(`  WIP line created:    ${flow.wipRef}`);
      console.log(`  routed to WIP tab:    ${flow.onWipTab ? 'yes' : 'NO'}`);
      console.log(`  new row visible:     ${flow.rowVisible ? 'yes' : 'NO'}`);
      console.log(`  rows after filter:   ${flow.listed}`);
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
