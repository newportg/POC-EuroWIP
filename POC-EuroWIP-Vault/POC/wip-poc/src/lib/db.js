import sqlJs from 'sql.js/dist/sql-wasm-browser.js';
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';

const initSqlJs = sqlJs;
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema.js';
import { buildSeed } from './seed.js';

/**
 * SQLite compiled to WebAssembly, running entirely in the browser.
 *
 * This is a real relational engine with real constraints, foreign keys and
 * triggers -- the same guarantees the Dataverse design depends on. It runs on
 * static hosting because there is no server process: the whole database is a
 * byte array held in memory and mirrored into IndexedDB.
 *
 * Everything above this module talks through `query` / `run` / `tx`, so
 * swapping in a hosted Postgres later is a change to this file, not to the UI.
 */

const IDB_NAME = 'wip-poc';
const IDB_STORE = 'databases';
const IDB_KEY = 'wip';

let SQL = null;
let db = null;
let saveTimer = null;

// ------------------------------------------------------------ IndexedDB

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const conn = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const conn = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key) {
  const conn = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ------------------------------------------------------------- lifecycle

function applySchema(database) {
  database.run(SCHEMA_SQL);
}

export async function openDatabase({ reset = false } = {}) {
  if (!SQL) {
    SQL = await initSqlJs({ locateFile: () => wasmUrl });
  }

  if (reset) await idbDelete(IDB_KEY);

  let restored = null;
  if (!reset) {
    restored = await idbGet(IDB_KEY);
  }

  if (restored && restored.schemaVersion === SCHEMA_VERSION) {
    db = new SQL.Database(new Uint8Array(restored.bytes));
  } else {
    db = new SQL.Database();
    applySchema(db);
    buildSeed(db);
    await persist();
  }
  return db;
}

/** Serialise the in-memory database to IndexedDB. Debounced. */
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const bytes = db.export();
    await idbSet(IDB_KEY, { schemaVersion: SCHEMA_VERSION, savedAt: Date.now(), bytes });
  }, 150);
}

export async function saveNow() {
  clearTimeout(saveTimer);
  const bytes = db.export();
  await idbSet(IDB_KEY, { schemaVersion: SCHEMA_VERSION, savedAt: Date.now(), bytes });
}

export async function resetDatabase() {
  await idbDelete(IDB_KEY);
  await openDatabase({ reset: true });
}

// --------------------------------------------------------------- queries

/**
 * Run a SELECT and return every row as a plain object.
 * @param {string} sql
 * @param {Array<unknown>} [params]
 */
export function query(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

/** Run a SELECT and return the first row, or null. */
export function queryOne(sql, params = []) {
  return query(sql, params)[0] ?? null;
}

/** Run one INSERT/UPDATE/DELETE. Persists the change. */
export function run(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    stmt.step();
  } finally {
    stmt.free();
  }
  persist();
}

/** Run a script of statements, no result set. */
export function exec(sql) {
  db.run(sql);
  persist();
}

/**
 * Run `fn` inside a transaction. Any thrown error rolls the whole thing back,
 * so a rejected status change never leaves half the row written.
 *
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export function tx(fn) {
  db.run('BEGIN');
  try {
    const result = fn();
    db.run('COMMIT');
    persist();
    return result;
  } catch (err) {
    try {
      db.run('ROLLBACK');
    } catch {
      // A RAISE(ABORT) already unwound the statement; nothing left to undo.
    }
    throw err;
  }
}

/** Wipe and reseed everything. */
export function reseed() {
  return tx(() => {
    db.run(`
      DROP TRIGGER IF EXISTS trg_instruction_f5_insert;
      DROP TRIGGER IF EXISTS trg_instruction_f5_update;
      DROP TRIGGER IF EXISTS trg_instruction_parent_insert;
      DROP TRIGGER IF EXISTS trg_instruction_parent_update;
      DROP TRIGGER IF EXISTS trg_wip_pl1_parent;
      DROP TRIGGER IF EXISTS trg_wip_pl1_stamp;
      DROP TRIGGER IF EXISTS trg_wip_pl2_fill;
      DROP TRIGGER IF EXISTS trg_wip_pl3_preimage;
      DROP TRIGGER IF EXISTS trg_wip_br_probability_lock;
      DROP TRIGGER IF EXISTS trg_wip_pl4_period_lock;
      DROP TRIGGER IF EXISTS trg_wip_br_billed_fields;
      DROP TRIGGER IF EXISTS trg_wip_br_paid_fields;
      DROP TRIGGER IF EXISTS trg_wip_terminal_status;
      DROP TRIGGER IF EXISTS trg_wip_status_stamp;
      DROP TRIGGER IF EXISTS trg_wip_fl5_gaming;
      DROP TRIGGER IF EXISTS trg_instruction_fl2_cascade;
      DROP TRIGGER IF EXISTS trg_wip_fee_schedule_cm;
      DROP VIEW IF EXISTS v_wip;
      DROP VIEW IF EXISTS v_receivables;
      DROP TABLE IF EXISTS alert;
      DROP TABLE IF EXISTS event_log;
      DROP TABLE IF EXISTS wip;
      DROP TABLE IF EXISTS fee_schedule;
      DROP TABLE IF EXISTS deal_property;
      DROP TABLE IF EXISTS instruction;
      DROP TABLE IF EXISTS service_line_parent;
      DROP TABLE IF EXISTS property;
      DROP TABLE IF EXISTS site;
      DROP TABLE IF EXISTS contact;
      DROP TABLE IF EXISTS account;
      DROP TABLE IF EXISTS business_unit;
    `);
    applySchema(db);
    buildSeed(db);
  });
}

/** Export the database as a .sqlite file the user can download. */
export function exportDatabase() {
  return db.export();
}

export function isOpen() {
  return db !== null;
}
