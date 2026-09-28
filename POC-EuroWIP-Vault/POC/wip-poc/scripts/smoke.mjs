/**
 * Smoke test for the domain layer.
 *
 * Runs src/lib/repo.js — every query and command the UI depends on — against a
 * real sql.js database in Node, standing in for the two browser APIs it needs:
 * a wasm loader and IndexedDB. A typo in a SQL string is the failure mode this
 * is here to catch; svelte-check cannot see those.
 *
 * Run with: npm run smoke
 */
import { register } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.join(here, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');

// db.js asks Vite for the wasm URL; hand it the path sql.js can read in Node.
writeFileSync(
  path.join(here, 'wasm-url-shim.mjs'),
  `export default ${JSON.stringify(wasmPath)};\n`
);

// ------------------------------------------------- minimal IndexedDB shim
const stores = new Map();
globalThis.indexedDB = {
  open() {
    const req = { result: null, onsuccess: null, onerror: null, onupgradeneeded: null };
    const names = { contains: (n) => stores.has(n) };
    const conn = {
      objectStoreNames: names,
      createObjectStore(n) { stores.set(n, new Map()); return {}; },
      transaction(storeName, mode) {
        // Real IndexedDB creates the store during onupgradeneeded; the shim
        // creates it on first use instead.
        if (!stores.has(storeName)) stores.set(storeName, new Map());
        const store = stores.get(storeName);
        const tx = { oncomplete: null, onerror: null, error: null };
        queueMicrotask(() => tx.oncomplete?.());
        tx.objectStore = () => ({
          get(key) {
            const r = { result: store.get(key), onsuccess: null, onerror: null };
            queueMicrotask(() => r.onsuccess?.());
            return r;
          },
          put(value, key) {
            store.set(key, structuredClone(value));
            return {};
          },
          delete(key) { store.delete(key); return {}; }
        });
        return tx;
      }
    };
    queueMicrotask(() => { req.result = conn; req.onsuccess?.(); });
    return req;
  }
};

register('./loader-hooks.mjs', import.meta.url);

const repo = await import('../src/lib/repo.js');
const db = await import('../src/lib/db.js');

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    const detail = await fn();
    console.log(`  PASS  ${name}${detail ? `  (${detail})` : ''}`);
    passed += 1;
  } catch (err) {
    console.log(`  FAIL  ${name}\n          ${err?.message ?? err}`);
    failed += 1;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

await db.openDatabase({ reset: true });

console.log('\nreads');
await check('getOffices', () => {
  const r = repo.getOffices();
  assert(r.length === 3, `expected 3 offices, got ${r.length}`);
  return r.map((o) => o.city).join(' ');
});
await check('getServiceLines', () => {
  const r = repo.getServiceLines();
  assert(r.length === 13, `expected 13 service lines, got ${r.length}`);
  return `${r.length}`;
});
await check('getAccounts', () => {
  const r = repo.getAccounts();
  assert(r.some((a) => a.classification === 'Legal Entity'), 'no legal entities');
  return `${r.length} accounts`;
});
await check('getWip unfiltered', () => {
  const r = repo.getWip();
  assert(r.length === 16, `expected 16, got ${r.length}`);
});
await check('getWip by status', () => {
  const r = repo.getWip({ status: 'Billed' });
  assert(r.length > 0 && r.every((x) => x.wip_status === 'Billed'), 'filter wrong');
  return `${r.length} billed`;
});
await check('getWip by office', () => {
  const r = repo.getWip({ officeId: 3 });
  assert(r.every((x) => x.office_city === 'London'), 'office filter wrong');
  return `${r.length} in London`;
});
await check('getWip by search', () => {
  const r = repo.getWip({ search: 'Meridian' });
  assert(r.length > 0, 'search returned nothing');
  return `${r.length} match "Meridian"`;
});
await check('getWip stale only', () => {
  const r = repo.getWip({ staleOnly: true });
  assert(r.length > 0 && r.every((x) => x.is_stale === 1), 'stale filter wrong');
  return `${r.length} stale`;
});
await check('getWipLine', () => {
  const r = repo.getWipLine(1);
  assert(r?.name === 'WIP-000001', `got ${r?.name}`);
  return r.name;
});
await check('getInstructions', () => {
  const r = repo.getInstructions();
  assert(r.length === 8, `expected 8, got ${r.length}`);
  return `${r.length}`;
});
await check('getPeriods', () => {
  const r = repo.getPeriods();
  assert(r.length === 3, `expected 3 months, got ${r.length}`);
  return r.map((p) => `${p.reporting_month}:${p.lines}`).join(' ');
});
await check('getAlerts', () => {
  const r = repo.getAlerts();
  assert(r.length > 0, 'no alerts');
  return `${r.length}`;
});
await check('getReceivables', () => {
  const r = repo.getReceivables();
  assert(r.every((x) => x.wip_status === 'Billed'), 'non-billed line in receivables');
  return `${r.length} outstanding`;
});
await check('getReceivableBuckets', () => {
  const r = repo.getReceivableBuckets();
  assert(r.length > 0, 'no buckets');
  return r.map((b) => `${b.bucket}:${b.lines}`).join(' ');
});
await check('getKpis all months', () => {
  const k = repo.getKpis(null);
  assert(k.gross_pipeline > 0, 'no pipeline');
  return `pipeline ${k.gross_pipeline}, weighted ${k.weighted_retained}`;
});
await check('getKpis for one month', () => {
  const months = repo.getPeriods().map((p) => p.reporting_month);
  const k = repo.getKpis(months[0]);
  assert(k.gross_pipeline > 0, 'month filter returned nothing');
  return `${months[0]}: ${k.gross_pipeline}`;
});
await check('getPipelineByServiceLine', () => {
  const r = repo.getPipelineByServiceLine(null);
  assert(r.length > 0, 'no service lines');
  return `${r.length} lines`;
});
await check('getEvents', () => {
  const r = repo.getEvents();
  assert(r.length > 0, 'event log is empty after seeding');
  return `${r.length} events`;
});

console.log('\ncommands');
await check('changeStatus rejects a bad status name', async () => {
  const r = repo.changeStatus(1, 'Nonsense');
  assert(!r.ok && r.error.includes('Unknown status'), 'should have been rejected');
});
await check('changeStatus surfaces a rule rejection', async () => {
  const r = repo.changeStatus(2, 'Billed', {});
  assert(!r.ok, 'billing with no invoice fields should fail');
  assert(r.error.includes('invoice requirements'), `wrong reason: ${r.error}`);
  return 'reason surfaced';
});
await check('changeStatus succeeds with the required fields', async () => {
  const r = repo.changeStatus(2, 'Billed', {
    invoice_number: 'INV-SMOKE-1',
    invoice_due_date: '2026-11-30',
    erp_local_system_ref: 'PG-SMOKE-1'
  });
  assert(r.ok, `unexpected: ${r.error}`);
  const line = repo.getWipLine(2);
  assert(line.wip_status === 'Billed', 'status not persisted');
  return 'WIP-000002 -> Billed';
});
await check('updateProbability captures a pre-image', async () => {
  const before = repo.getWipLine(4).probability;
  const r = repo.updateProbability(4, 25);
  assert(r.ok, r.error);
  const after = repo.getWipLine(4);
  assert(after.previous_probability === before, 'pre-image not recorded');
  return `${before} -> ${after.probability}`;
});
await check('updateProbability is refused on a billed line', async () => {
  const r = repo.updateProbability(2, 99);
  assert(!r.ok, 'should be refused by the probability lock');
  assert(r.error.includes('probability lock'), `wrong reason: ${r.error}`);
});
await check('updateProbability is refused on a locked period', async () => {
  const locked = repo.getPeriods().find((p) => p.locked > 0);
  const line = repo.getWip({ staleOnly: false }).find((w) => w.reporting_month === locked.reporting_month && w.wip_status === 'WIP');
  if (!line) return 'skipped, no open line in the locked month';
  const r = repo.updateProbability(line.id, 10);
  assert(!r.ok, 'should be refused by PL-4');
  assert(r.error.includes('PL-4'), `wrong reason: ${r.error}`);
  return 'PL-4 enforced';
});
await check('lockPeriod and unlockPeriod', async () => {
  const month = repo.getPeriods().find((p) => p.locked === 0).reporting_month;
  const locked = repo.lockPeriod(month, 'smoke');
  assert(locked.ok, locked.error);
  assert(repo.getPeriods().find((p) => p.reporting_month === month).locked > 0, 'not locked');
  const unlocked = repo.unlockPeriod(month, 'smoke');
  assert(unlocked.ok, unlocked.error);
  return month;
});
await check('withdrawInstruction requires a reason', async () => {
  const r = repo.withdrawInstruction(5, '');
  assert(!r.ok, 'empty reason should be rejected');
  assert(r.error.includes('CHECK constraint failed'), `wrong reason: ${r.error}`);
  return 'empty and null both rejected';
});
await check('withdrawInstruction cascades and is audited', async () => {
  // Find an instruction whose WIP lines are all outside any locked period,
  // otherwise FL-4 refuses the cascade for a different (also correct) reason.
  const candidate = repo.getInstructions().find((i) => {
    if (i.instruction_status !== 'Active') return false;
    const lines = repo.getWip().filter((w) => w.instruction_id === i.id);
    return lines.length > 0 && lines.every((w) => !w.period_locked);
  });
  assert(candidate, 'no withdrawable instruction outside a locked period');
  const before = repo.getAlerts().filter((a) => a.alert_type === 'FL-2').length;
  const r = repo.withdrawInstruction(candidate.id, 'Client request');
  assert(r.ok, r.error);
  const after = repo.getAlerts().filter((a) => a.alert_type === 'FL-2').length;
  assert(after === before + 1, 'no FL-2 alert raised');
  const lost = repo.getWip().filter((w) => w.instruction_status === 'Withdrawn' && w.wip_status === 'Lost');
  assert(lost.length > 0, 'no lines cascaded to Lost');
  return `${candidate.name}: ${lost.length} line(s) cascaded`;
});
await check('dismissAlert', async () => {
  const alert = repo.getAlerts().find((a) => !a.resolved);
  repo.dismissAlert(alert.id);
  assert(repo.getAlerts().find((a) => a.id === alert.id).resolved === 1, 'not resolved');
});
await check('data survives a reopen', async () => {
  const before = repo.getWip().length;
  await db.saveNow();
  await db.openDatabase();
  const after = db.query('SELECT count(*) AS n FROM wip')[0].n;
  assert(after === before, `${before} rows before, ${after} after reopen`);
  return `${after} rows`;
});
await check('reseed restores the baseline', async () => {
  repo.reseed();
  const n = repo.getWip().length;
  assert(n === 16, `expected 16 after reseed, got ${n}`);
  return `${n} rows`;
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
