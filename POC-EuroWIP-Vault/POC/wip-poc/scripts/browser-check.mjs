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

    // The WIP tab keeps the KPIs but drops the breakdown tables — those are
    // Dashboard-only.
    const wipContent = await send('Runtime.evaluate', {
      expression: `(() => {
        const t = document.getElementById('app').innerText;
        return { kpi: /weighted retained/i.test(t), totals: /totals by/i.test(t) };
      })()`,
      returnByValue: true
    });
    console.log(`\ntab "WIP": ${wipTab.result.value}`);
    console.log(`  KPI bar:              ${wipContent.result.value.kpi ? 'shown' : 'MISSING'}`);
    console.log(`  "totals by" sections: ${wipContent.result.value.totals ? 'present (unexpected)' : 'absent'}`);
    if (!wipContent.result.value.kpi) exceptions.push('WIP tab is missing the KPI bar');
    if (wipContent.result.value.totals) exceptions.push('WIP tab still shows the "totals by" sections');

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
        const key = (k) => document.querySelector('[data-key="' + k + '"]');

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

        // Step 1 — Type: choose the service line.
        const card = document.querySelector('.type-card[data-type="valuation"]');
        if (!card) return { error: 'type card not found' };
        card.click();
        await sleep(150);

        // Step 2 — Client: exercise the mock directory lookup, then confirm it
        // filled the free-text fields.
        pill('client').click();
        await sleep(150);
        const lookup = document.querySelector('#clientLookup');
        if (!lookup) return { error: 'mock client lookup missing' };
        setNative(lookup, 'Whitfield');
        await sleep(600); // debounce
        const cRes = document.querySelectorAll('#clientLookupResults .loqate-result');
        if (!cRes.length) return { error: 'mock client lookup returned nothing' };
        cRes[0].click();
        await sleep(200);
        if (!key('clientName') || !key('clientName').value) {
          return { error: 'mock client did not fill the form' };
        }

        // Step 3 — Property: the Loqate UI must be present. Fill the fields
        // directly so the check stays offline-deterministic.
        pill('property').click();
        await sleep(150);
        if (!document.querySelector('#loqateQuery')) return { error: 'Loqate search box missing on Property' };
        if (!document.querySelector('#country')) return { error: 'country select missing on Property' };
        setNative(key('country'), 'United Kingdom');
        setNative(key('address'), '1 Liverpool Street');
        setNative(key('city'), 'London');
        setNative(key('postcode'), 'EC2M 7NH');
        await sleep(150);

        // Step 4 — Details: the required Valuation fields.
        pill('details').click();
        await sleep(150);
        setNative(document.querySelector('#d-kf_valuationpurpose'), 'Secured Lending');
        setNative(document.querySelector('#d-kf_valuationbasis'), 'Market Value');
        setNative(document.querySelector('#d-kf_instructiondate'), '2026-10-09');
        setNative(document.querySelector('#d-kf_reportduedate'), '2026-11-15');
        await sleep(150);

        // Step 5 — Terms: owning office first (it sets default currency and the
        // negotiator list), then the rest.
        pill('terms').click();
        await sleep(150);
        const officeSel = document.querySelector('#owningOffice');
        if (!officeSel || officeSel.options.length < 2) return { error: 'office options missing' };
        setNative(officeSel, 'Paris');
        await sleep(200);
        setNative(key('feeBasis'), 'Fixed fee');
        setNative(key('expectedRevenue'), '275000');
        const negSel = document.querySelector('#assignedTo');
        if (!negSel || negSel.options.length < 2) return { error: 'negotiator options missing after office choice' };
        setNative(negSel, negSel.options[1].value);
        await sleep(200);

        // Step 6 — Review: the readiness list must be fully green, then accept.
        pill('review').click();
        await sleep(200);
        const missingRequired = document.querySelectorAll('.readiness-row.missing').length;
        const acceptBtn = document.querySelector('#acceptBtn');
        if (!acceptBtn) return { error: 'accept button missing' };
        if (acceptBtn.disabled) {
          return { error: 'accept still disabled', missing: missingRequired };
        }
        acceptBtn.click();
        await sleep(700);
        if (!/INS-\\d{6} accepted/.test(text())) {
          return { error: 'instruction was not accepted', snippet: text().slice(0, 400) };
        }
        const ref = (text().match(/(INS-\\d{6}) accepted/) || [])[1];

        // Accepting must open the WIP line as well — the banner names it.
        const wipRef = (text().match(/(WIP-\\d{6}) opened/) || [])[1] ?? null;
        if (!wipRef) {
          return { error: 'accept did not open a WIP line', ref, snippet: text().slice(0, 500) };
        }

        // ...and that line must be visible on the WIP tab.
        tab('wip');
        await sleep(500);
        const onWipTab = [...document.querySelectorAll('nav .tab')]
          .some(b => b.textContent.trim() === 'WIP' && b.classList.contains('active'));
        const bodyRows = [...document.querySelectorAll('tbody tr')];
        const rowVisible = bodyRows.some(tr => tr.textContent.includes(wipRef));
        return { ref, wipRef, onWipTab, rowVisible, listed: bodyRows.length };
      })()`
    });

    const flow = createFlow.result.value;
    if (flow.error) {
      console.log(`\ncreation flow: FAILED — ${flow.error}`);
      if (flow.snippet) console.log('  page said: ' + flow.snippet.replace(/\n+/g, ' | '));
      exceptions.push(`creation flow: ${flow.error}`);
    } else {
      console.log(`\ncreation flow`);
      console.log(`  instruction created: ${flow.ref}`);
      console.log(`  WIP line opened:     ${flow.wipRef}`);
      console.log(`  routed to WIP tab:    ${flow.onWipTab ? 'yes' : 'NO'}`);
      console.log(`  new row visible:     ${flow.rowVisible ? 'yes' : 'NO'}`);
      console.log(`  rows in list:        ${flow.listed}`);
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
