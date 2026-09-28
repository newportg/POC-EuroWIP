/**
 * Headless verification of the schema, the seed and the business rules.
 *
 * Run with: npm run verify
 *
 * This exercises the same modules the browser uses, so a rule that fails here
 * would fail in the app. It is the only part of the POC with automated checks;
 * the UI layer is deliberately thin.
 */
import initSqlJs from 'sql.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SCHEMA_SQL } from '../src/lib/schema.js';
import { buildSeed } from '../src/lib/seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SQL = await initSqlJs({ locateFile: (f) => path.join(here, '..', 'node_modules', 'sql.js', 'dist', f) });

const db = new SQL.Database();
db.run(SCHEMA_SQL);
buildSeed(db);

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    const detail = fn();
    console.log(`  PASS  ${name}${detail ? `  (${detail})` : ''}`);
    passed += 1;
  } catch (err) {
    console.log(`  FAIL  ${name}\n          ${err.message}`);
    failed += 1;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function all(sql) {
  const res = db.exec(sql);
  if (!res.length) return [];
  return res[0].values.map((row) => {
    const obj = {};
    res[0].columns.forEach((c, i) => (obj[c] = row[i]));
    return obj;
  });
}

function one(sql) {
  return all(sql)[0] ?? null;
}

/** Assert that a statement is rejected, and that the reason mentions `needle`. */
function expectBlocked(label, needle, sql) {
  try {
    db.run(sql);
  } catch (err) {
    assert(
      String(err.message).includes(needle),
      `expected error containing "${needle}", got: ${err.message}`
    );
    return;
  }
  throw new Error('statement was accepted but should have been blocked');
}

console.log('\nschema');
check('tables created', () => {
  const t = one("SELECT count(*) AS n FROM sqlite_master WHERE type='table'").n;
  assert(t >= 12, `expected at least 12 tables, got ${t}`);
  return `${t} tables`;
});
check('triggers created', () => {
  const n = one("SELECT count(*) AS n FROM sqlite_master WHERE type='trigger'").n;
  assert(n === 17, `expected 17 triggers, got ${n}`);
  return `${n} triggers`;
});
check('views created', () => {
  const n = one("SELECT count(*) AS n FROM sqlite_master WHERE type='view'").n;
  assert(n === 2, `expected 2 views, got ${n}`);
  return `${n} views`;
});

console.log('\nseed');
check('seeded rows', () => {
  const w = one('SELECT count(*) AS n FROM wip').n;
  const i = one('SELECT count(*) AS n FROM instruction').n;
  assert(w === 16, `expected 16 wip rows, got ${w}`);
  assert(i === 8, `expected 8 instructions, got ${i}`);
  return `${w} WIP, ${i} instructions`;
});
check('PL-2 denormalised classification', () => {
  const missing = one(`
    SELECT count(*) AS n FROM wip
     WHERE service_line IS NULL OR client_account_id IS NULL OR owning_office_id IS NULL
  `).n;
  assert(missing === 0, `${missing} rows still missing PL-2 fields`);
});
check('PL-1 stamped parent type', () => {
  const n = one("SELECT count(*) AS n FROM wip WHERE parent_type = 'Instruction'").n;
  assert(n === 16, `expected 16 stamped rows, got ${n}`);
});
check('VAT defaulted from owning office', () => {
  const rows = all(`
    SELECT w.vat_percent AS v, bu.vat_percent AS expected
      FROM wip w JOIN business_unit bu ON bu.id = w.owning_office_id
  `);
  const wrong = rows.filter((r) => Math.abs(r.v - r.expected) > 0.001);
  assert(wrong.length === 0, `${wrong.length} rows have the wrong VAT default`);
});
check('weighted officer retained is calculated', () => {
  const r = one("SELECT office_retained, probability, weighted_office_retained FROM wip WHERE id = 1");
  const expected = r.office_retained * r.probability / 100;
  assert(Math.abs(r.weighted_office_retained - expected) < 0.01, 'calculation mismatch');
  return `${r.weighted_office_retained}`;
});
check('stale detection fires', () => {
  const n = one('SELECT count(*) AS n FROM v_wip WHERE is_stale = 1').n;
  assert(n > 0, 'no stale lines found');
  return `${n} stale`;
});
check('FL-5 gaming alert raised during seed', () => {
  const a = one("SELECT count(*) AS n FROM alert WHERE alert_type = 'FL-5'");
  assert(a.n >= 1, 'no FL-5 alert was raised');
  return `${a.n} alert(s)`;
});
check('FL-2 loss cascade fired', () => {
  const lost = one(`
    SELECT count(*) AS n FROM wip w
      JOIN instruction i ON i.id = w.instruction_id
     WHERE i.instruction_status = 'Withdrawn' AND w.wip_status = 'Lost'
  `).n;
  assert(lost >= 1, 'cascade did not set child lines to Lost');
  return `${lost} line(s) cascaded`;
});
check('PL-3 pre-image captured', () => {
  const n = one('SELECT count(*) AS n FROM wip WHERE previous_probability IS NOT NULL').n;
  assert(n >= 1, 'no probability pre-image captured');
  return `${n} captured`;
});
check('FL-4 locked the older period', () => {
  const n = one('SELECT count(*) AS n FROM wip WHERE period_locked = 1').n;
  assert(n > 0, 'nothing was locked');
  return `${n} locked`;
});
check('receivables aging buckets populated', () => {
  const rows = all('SELECT bucket, count(*) AS n FROM v_receivables GROUP BY bucket');
  assert(rows.length > 0, 'no receivables rows');
  return rows.map((r) => `${r.bucket}:${r.n}`).join(' ');
});

console.log('\nbusiness rules');
check('BR: billing without invoice fields is rejected', () =>
  expectBlocked(
    'blocked',
    'BR invoice requirements',
    `UPDATE wip SET wip_status = 'Billed' WHERE id = 2`
  ));
check('BR: paying without a paid date is rejected', () => {
  const id = one("SELECT id FROM wip WHERE wip_status = 'Billed'").id;
  return expectBlocked(
    'blocked',
    'BR invoice requirements',
    `UPDATE wip SET wip_status = 'Paid' WHERE id = ${id}`
  );
});
check('BR: probability lock holds after Billed', () => {
  const id = one("SELECT id FROM wip WHERE wip_status = 'Billed'").id;
  return expectBlocked(
    'blocked',
    'probability lock',
    `UPDATE wip SET probability = 99 WHERE id = ${id}`
  );
});
check('terminal status is final', () => {
  const id = one("SELECT id FROM wip WHERE wip_status IN ('Paid','Lost')").id;
  return expectBlocked(
    'blocked',
    'terminal',
    `UPDATE wip SET wip_status = 'WIP' WHERE id = ${id}`
  );
});
check('PL-4: locked period rejects edits', () => {
  const id = one('SELECT id FROM wip WHERE period_locked = 1 LIMIT 1').id;
  return expectBlocked(
    'blocked',
    'PL-4',
    `UPDATE wip SET gross_fee = 1 WHERE id = ${id}`
  );
});
check('F5: invoice entity must be a Legal Entity', () =>
  expectBlocked(
    'blocked',
    'F5',
    `INSERT INTO instruction (name, instruction_type, service_line, client_account_id,
        legal_entity_account_id, owning_office_id, instruction_status, start_date, parent_id)
     VALUES ('INS-999999','Mandate','Valuations',1,1,1,'Active','2026-01-01',3)`
  ));
check('service-line parent must match kf_serviceline', () =>
  expectBlocked(
    'blocked',
    'exactly one service-line parent',
    `INSERT INTO instruction (name, instruction_type, service_line, client_account_id,
        legal_entity_account_id, owning_office_id, instruction_status, start_date, parent_id)
     VALUES ('INS-999998','Mandate','Valuations',1,2,1,'Active','2026-01-01',1)`
  ));
check('PL-1: a WIP line needs an instruction', () =>
  expectBlocked(
    'blocked',
    'PL-1',
    `INSERT INTO wip (name, instruction_id, reporting_month) VALUES ('WIP-999999', NULL, '2026-01-01')`
  ));
check('fee schedule is Capital Markets only', () => {
  // Pick a line that is genuinely not Capital Markets, not just a low id.
  const id = one(`
    SELECT w.id FROM wip w JOIN instruction i ON i.id = w.instruction_id
     WHERE i.service_line <> 'Capital Markets' LIMIT 1
  `).id;
  return expectBlocked(
    'blocked',
    'Capital Markets',
    `UPDATE wip SET fee_schedule_id = 1 WHERE id = ${id}`
  );
});
check('fee schedule links freely within Capital Markets', () => {
  db.run('UPDATE wip SET fee_schedule_id = 2 WHERE id = 1');
  const row = one('SELECT fee_schedule_id FROM wip WHERE id = 1');
  assert(row.fee_schedule_id === 2, 'legal CM link was rejected');
});
check('withdrawal requires a termination reason', () => {
  // Instruction 5 has no WIP in a locked period, so the CHECK is what fires.
  return expectBlocked(
    'blocked',
    'CHECK constraint failed',
    `UPDATE instruction SET instruction_status = 'Withdrawn' WHERE id = 5`
  );
});
check('FL-4 blocks the loss cascade into a locked period', () => {
  // Instruction 2 owns a two-months-ago line that FL-4 has locked. The
  // cascade is correct in principle but must not rewrite a closed period.
  return expectBlocked(
    'blocked',
    'PL-4',
    `UPDATE instruction SET instruction_status = 'Withdrawn',
            termination_reason = 'Closed out' WHERE id = 2`
  );
});

console.log('\nhappy paths');
check('a valid transition is accepted', () => {
  db.run(`
    UPDATE wip
       SET wip_status = 'Billed',
           invoice_number = 'INV-TEST-1',
           invoice_due_date = '2026-12-31',
           erp_local_system_ref = 'PG-TEST-1'
     WHERE id = 2
  `);
  const row = one("SELECT wip_status FROM wip WHERE id = 2");
  assert(row.wip_status === 'Billed', 'status did not change');
  return 'WIP-000002 billed';
});
check('status change timestamp is stamped', () => {
  const row = one('SELECT wip_status_changed_on FROM wip WHERE id = 2');
  assert(row.wip_status_changed_on, 'no timestamp written');
  return row.wip_status_changed_on;
});
check('a probability change on a WIP line is allowed and tracked', () => {
  const before = one('SELECT probability FROM wip WHERE id = 4').probability;
  db.run('UPDATE wip SET probability = 40 WHERE id = 4');
  const row = one('SELECT probability, previous_probability FROM wip WHERE id = 4');
  assert(row.probability === 40, 'probability not updated');
  assert(row.previous_probability === before, `pre-image ${row.previous_probability}, expected ${before}`);
  return `${row.previous_probability} -> ${row.probability}`;
});
check('a NULL column is NULL, not the text "NULL"', () => {
  const t = one("SELECT typeof(termination_reason) AS t FROM instruction WHERE id = 5").t;
  assert(t === 'null', `termination_reason is ${t}, expected a real NULL`);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
