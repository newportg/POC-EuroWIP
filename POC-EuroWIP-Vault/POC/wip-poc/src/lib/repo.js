/**
 * Domain queries and commands.
 *
 * This is the only module the UI talks to. It is written against a small set of
 * primitives (query / queryOne / run / tx) that happen to be backed by SQLite
 * today, so moving to a hosted Postgres later is a matter of reimplementing the
 * bottom of db.js rather than rewriting every screen.
 */
import { query, queryOne, run, tx, exportDatabase, reseed, resetDatabase } from './db.js';

// ------------------------------------------------------------- reference

export function getOffices() {
  return query('SELECT * FROM business_unit ORDER BY id');
}

export function getServiceLines() {
  return query('SELECT * FROM service_line_parent ORDER BY service_line');
}

export function getAccounts() {
  return query('SELECT * FROM account ORDER BY classification DESC, name');
}

export function getEvents(limit = 40) {
  return query(
    `SELECT * FROM event_log ORDER BY id DESC LIMIT ?`,
    [limit]
  );
}

// ------------------------------------------------------------------ wip

export function getWip(filters = {}) {
  const where = [];
  const params = [];

  // These predicates run against the v_wip view, which already flattens the
  // joins, so they reference bare column names rather than a table alias.
  if (filters.status) {
    where.push('wip_status = ?');
    params.push(filters.status);
  }
  if (filters.officeId) {
    where.push('owning_office_id = ?');
    params.push(filters.officeId);
  }
  if (filters.search) {
    where.push('(name LIKE ? OR brand_name LIKE ? OR instruction_name LIKE ?)');
    const like = `%${filters.search}%`;
    params.push(like, like, like);
  }
  if (filters.staleOnly) where.push('is_stale = 1');

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return query(`SELECT * FROM v_wip ${clause} ORDER BY is_stale DESC, name`, params);
}

export function getWipLine(id) {
  return queryOne('SELECT * FROM v_wip WHERE id = ?', [id]);
}

export function getInstructions() {
  return query(`
    SELECT i.*,
           a.name  AS client_name,
           le.name AS legal_entity_name,
           bu.name AS office_name,
           sl.service_line AS parent_service_line
      FROM instruction i
      JOIN account a  ON a.id  = i.client_account_id
      JOIN account le ON le.id = i.legal_entity_account_id
      JOIN business_unit bu ON bu.id = i.owning_office_id
      JOIN service_line_parent sl ON sl.id = i.parent_id
     ORDER BY i.name
  `);
}

/**
 * Apply a lifecycle transition. The conditional-field rules live in triggers,
 * so the only thing to do here is attempt the move and surface whatever the
 * database says. Returns { ok, error }.
 */
export function changeStatus(id, nextStatus, fields = {}) {
  const allowed = ['WIP', 'Billed', 'Paid', 'Lost'];
  if (!allowed.includes(nextStatus)) {
    return { ok: false, error: `Unknown status "${nextStatus}".` };
  }

  const keys = Object.keys(fields).filter((k) =>
    ['invoice_number', 'invoice_due_date', 'date_paid_in_full', 'erp_local_system_ref'].includes(k)
  );
  const set = ['wip_status = ?', ...keys.map((k) => `${k} = ?`)];
  const params = [nextStatus, ...keys.map((k) => fields[k] ?? null)];

  try {
    tx(() => run(`UPDATE wip SET ${set.join(', ')} WHERE id = ?`, [...params, id]));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: cleanError(err) };
  }
}

export function updateProbability(id, probability) {
  try {
    tx(() => run('UPDATE wip SET probability = ? WHERE id = ?', [probability, id]));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: cleanError(err) };
  }
}

export function withdrawInstruction(id, reason) {
  try {
    tx(() =>
      run("UPDATE instruction SET instruction_status = 'Withdrawn', termination_reason = ? WHERE id = ?", [
        reason,
        id
      ])
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: cleanError(err) };
  }
}

// ---------------------------------------------------------- period lock

export function getPeriods() {
  return query(`
    SELECT reporting_month,
           count(*)                                    AS lines,
           sum(period_locked)                          AS locked,
           sum(gross_fee * probability / 100.0)        AS weighted
      FROM wip
     GROUP BY reporting_month
     ORDER BY reporting_month DESC
  `);
}

export function lockPeriod(month, user) {
  try {
    tx(() =>
      run(
        `UPDATE wip SET period_locked = 1, locked_by = ?, locked_on = datetime('now')
          WHERE reporting_month = ?`,
        [user, month]
      )
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: cleanError(err) };
  }
}

export function unlockPeriod(month, user) {
  try {
    tx(() =>
      run(
        `UPDATE wip SET period_locked = 0, locked_by = ?, locked_on = datetime('now')
          WHERE reporting_month = ?`,
        [user, month]
      )
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: cleanError(err) };
  }
}

// ---------------------------------------------------------------- alerts

export function getAlerts() {
  return query(`
    SELECT * FROM alert
     ORDER BY CASE severity WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END, id DESC
  `);
}

export function dismissAlert(id) {
  run('UPDATE alert SET resolved = 1 WHERE id = ?', [id]);
}

// ----------------------------------------------------------- receivables

export function getReceivables() {
  return query('SELECT * FROM v_receivables ORDER BY days_overdue DESC');
}

export function getReceivableBuckets() {
  return query(`
    SELECT bucket,
           count(*)                        AS lines,
           round(sum(gross_incl_vat), 2)   AS total
      FROM v_receivables
     GROUP BY bucket
     ORDER BY bucket
  `);
}

// ------------------------------------------------------------------ kpis

export function getKpis(month) {
  const row = queryOne(
    `
    SELECT
      round(sum(CASE WHEN wip_status = 'WIP'     THEN gross_fee END), 2)                  AS gross_pipeline,
      round(sum(CASE WHEN wip_status = 'WIP'
                     THEN office_retained * probability / 100.0 END), 2)                   AS weighted_retained,
      round(sum(CASE WHEN wip_status = 'Billed'  THEN gross_fee END), 2)                  AS billed,
      round(sum(CASE WHEN wip_status = 'Paid'    THEN gross_fee END), 2)                  AS paid,
      round(sum(CASE WHEN wip_status = 'Lost'    THEN gross_fee END), 2)                  AS lost,
      sum(CASE WHEN is_stale = 1 THEN 1 ELSE 0 END)                                       AS stale_lines,
      sum(period_locked)                                                                   AS locked_lines
    FROM v_wip
    WHERE ? IS NULL OR reporting_month = ?
  `,
    [month, month]
  );
  return row ?? {};
}

/**
 * Totals by lifecycle status: WIP (in hand), Billed, Paid, Lost.
 *
 * All four states are always returned so a zero reads as zero rather than as
 * a missing row. `month` of null means every reporting month.
 */
export function getTotalsByStatus(month) {
  const rows = query(
    `
    SELECT wip_status AS status,
           count(*)                                       AS lines,
           round(sum(gross_fee), 2)                       AS gross,
           round(sum(CASE WHEN wip_status = 'WIP'
                          THEN office_retained * probability / 100.0 END), 2) AS weighted
      FROM v_wip
     WHERE ? IS NULL OR reporting_month = ?
     GROUP BY wip_status
  `,
    [month, month]
  );

  const byStatus = new Map(rows.map((r) => [r.status, r]));
  return ['WIP', 'Billed', 'Paid', 'Lost'].map(
    (status) => byStatus.get(status) ?? { status, lines: 0, gross: 0, weighted: 0 }
  );
}

/**
 * Totals by owning office and by service line: one row per group, with each
 * lifecycle state in its own column. These are the two report dimensions the
 * wiki asks for ("weighted pipeline by kf_serviceline, kf_owningoffice"), but
 * split across every status rather than open WIP only, so the office view also
 * answers what has been billed and lost.
 *
 * `in_hand` / `weighted` are open (WIP) lines; billed / paid / lost are the
 * gross fee of lines that reached that state.
 */
const GROUP_TOTALS_SQL = (dimensionExpr) => `
    SELECT ${dimensionExpr}                       AS group_name,
           count(*)                               AS lines,
           round(sum(CASE WHEN wip_status = 'WIP'   THEN gross_fee END), 2) AS in_hand,
           round(sum(CASE WHEN wip_status = 'Billed' THEN gross_fee END), 2) AS billed,
           round(sum(CASE WHEN wip_status = 'Paid'   THEN gross_fee END), 2) AS paid,
           round(sum(CASE WHEN wip_status = 'Lost'   THEN gross_fee END), 2) AS lost,
           round(sum(CASE WHEN wip_status = 'WIP'
                          THEN office_retained * probability / 100.0 END), 2) AS weighted,
           round(sum(gross_fee), 2)               AS total
      FROM v_wip
     WHERE ? IS NULL OR reporting_month = ?
     GROUP BY ${dimensionExpr}
     ORDER BY total DESC
`;

export function getTotalsByOffice(month) {
  return query(GROUP_TOTALS_SQL("COALESCE(office_name, 'Unknown office')"), [month, month]);
}

export function getTotalsByServiceLine(month) {
  return query(
    GROUP_TOTALS_SQL("COALESCE(service_line, 'Unknown service line')"),
    [month, month]
  );
}

// ------------------------------------------------------------ creation

/**
 * kf_Instruction and kf_WIP both use an explicit sequential key rather than an
 * auto-increment, because the reference itself is a business identifier
 * (INS-000009, WIP-000017) that finance quotes. The next number is derived
 * inside the same transaction as the insert so two concurrent creations cannot
 * collide.
 */
function nextRef(table, prefix) {
  const row = queryOne(`SELECT COALESCE(MAX(id), 0) + 1 AS n FROM ${table}`);
  const id = row.n;
  return { id, name: `${prefix}-${String(id).padStart(6, '0')}` };
}

export function getBrands() {
  return query("SELECT * FROM account WHERE classification = 'Brand/Group' ORDER BY name");
}

export function getLegalEntities() {
  return query("SELECT * FROM account WHERE classification = 'Legal Entity' ORDER BY name");
}

export function getProperties() {
  return query('SELECT * FROM property ORDER BY name');
}

export function getContacts() {
  return query('SELECT * FROM contact ORDER BY name');
}

export function getFeeSchedules() {
  return query(`
    SELECT f.id, f.name, f.instruction_id, f.fee_type, f.fee_amount, i.name AS instruction_name
      FROM fee_schedule f JOIN instruction i ON i.id = f.instruction_id
     ORDER BY f.id
  `);
}

/**
 * Create an Instruction. Classification is not stored on the child WIP lines
 * here; PL-2 copies it down when a line is created.
 *
 * @returns {{ok: true, id: number, name: string} | {ok: false, error: string}}
 */
export function createInstruction(input) {
  const {
    instruction_type = 'Mandate',
    service_line,
    client_account_id,
    legal_entity_account_id,
    primary_contact_id = null,
    property_id = null,
    owning_office_id,
    instruction_status = 'Active',
    start_date,
    signed_date = null,
    expected_revenue = 0,
    termination_reason = null,
    sector = null,
    negotiator = null,
    comments = null
  } = input;

  if (!service_line) return { ok: false, error: 'Choose a service line.' };
  if (!client_account_id) return { ok: false, error: 'Choose the client brand.' };
  if (!legal_entity_account_id) return { ok: false, error: 'Choose the legal entity (F5).' };
  if (!owning_office_id) return { ok: false, error: 'Choose an owning office.' };
  if (!start_date) return { ok: false, error: 'A start date is required.' };

  // PL-1: an Instruction has exactly one service-line parent, and it has to be
  // the one that matches the service line. Resolving it here means the form can
  // never construct an impossible parentage.
  const parent = queryOne('SELECT id FROM service_line_parent WHERE service_line = ?', [service_line]);
  if (!parent) {
    return { ok: false, error: `No service-line parent is registered for "${service_line}".` };
  }

  try {
    return tx(() => {
      const ref = nextRef('instruction', 'INS');
      run(
        `INSERT INTO instruction (
           id, name, instruction_type, service_line,
           client_account_id, legal_entity_account_id, primary_contact_id, property_id,
           owning_office_id, instruction_status, start_date, signed_date,
           expected_revenue, termination_reason, sector, negotiator, parent_id, comments
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          ref.id, ref.name, instruction_type, service_line,
          client_account_id, legal_entity_account_id, primary_contact_id, property_id,
          owning_office_id, instruction_status, start_date, signed_date,
          Number(expected_revenue) || 0, termination_reason, sector, negotiator,
          parent.id, comments
        ]
      );
      return { ok: true, id: ref.id, name: ref.name };
    });
  } catch (err) {
    return { ok: false, error: cleanError(err) };
  }
}

/**
 * Create a WIP line under an Instruction. Classification fields are left null
 * on purpose: PL-2 fills service line, sector, brand, negotiator, office and
 * VAT from the parent, which is the behaviour worth seeing.
 */
export function createWip(input) {
  const {
    instruction_id,
    fee_schedule_id = null,
    net_fee_to_group = 0,
    office_retained = 0,
    probability = 0,
    gross_fee = 0,
    reporting_month,
    completion_month = null,
    transaction_currency = 'EUR',
    transaction_type = 'Fee',
    comments = null
  } = input;

  if (!instruction_id) return { ok: false, error: 'Choose the parent Instruction (PL-1).' };
  if (!reporting_month) return { ok: false, error: 'A reporting month is required.' };

  const p = Number(probability);
  if (Number.isNaN(p) || p < 0 || p > 100) {
    return { ok: false, error: 'Probability must be between 0 and 100.' };
  }

  const parent = queryOne(
    'SELECT id, instruction_status, service_line FROM instruction WHERE id = ?',
    [instruction_id]
  );
  if (!parent) return { ok: false, error: 'That Instruction does not exist.' };
  if (parent.instruction_status === 'Withdrawn') {
    return { ok: false, error: 'Cannot add WIP to a withdrawn Instruction (FL-2).' };
  }

  try {
    return tx(() => {
      const ref = nextRef('wip', 'WIP');
      run(
        `INSERT INTO wip (
           id, name, instruction_id, fee_schedule_id,
           net_fee_to_group, office_retained, probability, gross_fee,
           reporting_month, completion_month, transaction_currency,
           transaction_type, comments
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          ref.id, ref.name, instruction_id, fee_schedule_id,
          Number(net_fee_to_group) || 0, Number(office_retained) || 0, p,
          Number(gross_fee) || 0,
          reporting_month, completion_month, transaction_currency,
          transaction_type, comments
        ]
      );
      return { ok: true, id: ref.id, name: ref.name };
    });
  } catch (err) {
    return { ok: false, error: cleanError(err) };
  }
}

// ------------------------------------------------- wizard resolution

/**
 * The wizard collects free-text client data and mock lookups, so accepting it
 * has to resolve those names onto the relational model before createInstruction
 * can run its F5 / PL-1 checks.
 *
 * Each resolver is find-or-create by name, so re-accepting the same client (or
 * re-using a contact) reuses the existing row rather than duplicating it.
 */
function nextId(table) {
  return queryOne(`SELECT COALESCE(MAX(id), 0) + 1 AS n FROM ${table}`).n;
}

/**
 * Resolve the two-account split on kf_Instruction. The client name is the
 * Brand/Group (relationship owner); the invoicing legal entity is a Legal
 * Entity. When the wizard leaves the legal entity blank the client name is used
 * for both, classified as a Legal Entity so F5 still passes.
 */
export function resolveClientAccounts({ clientName, legalEntity }) {
  const brandName = String(clientName || '').trim();
  if (!brandName) return { ok: false, error: 'A client name is required.' };
  const leName = String(legalEntity || '').trim() || brandName;

  try {
    return tx(() => {
      let brand = queryOne(
        "SELECT id FROM account WHERE name = ? AND classification = 'Brand/Group'",
        [brandName]
      );
      if (!brand) {
        const id = nextId('account');
        run("INSERT INTO account (id, name, classification, parent_account_id) VALUES (?,?,?,NULL)",
          [id, brandName, 'Brand/Group']);
        brand = { id };
      }
      let le = queryOne(
        "SELECT id FROM account WHERE name = ? AND classification = 'Legal Entity'",
        [leName]
      );
      if (!le) {
        const id = nextId('account');
        run('INSERT INTO account (id, name, classification, parent_account_id) VALUES (?,?,?,?)',
          [id, leName, 'Legal Entity', brand.id]);
        le = { id };
      }
      return { ok: true, brandId: brand.id, legalEntityId: le.id };
    });
  } catch (err) {
    return { ok: false, error: cleanError(err) };
  }
}

/** Find-or-create a contact against a legal entity. Returns the id, or null. */
export function resolveContact({ contactName, accountId }) {
  const name = String(contactName || '').trim();
  if (!name) return null;
  const existing = queryOne('SELECT id FROM contact WHERE name = ?', [name]);
  if (existing) return existing.id;
  const id = nextId('contact');
  run('INSERT INTO contact (id, name, account_id) VALUES (?,?,?)', [id, name, accountId]);
  return id;
}

/* Mock office country → the POC's ISO-shaped business_unit.country. */
const OFFICE_COUNTRY = {
  'United Kingdom': 'UK', Spain: 'ES', France: 'FR', Germany: 'DE', Poland: 'PL'
};

/**
 * Map a mock office onto a business_unit. City match first (London/Madrid/Paris
 * exist), then country, then the first office as a last resort — Germany and
 * Poland have no seeded office, so they fall back rather than fail.
 */
export function resolveOfficeId(office) {
  if (!office) return null;
  const byCity = queryOne('SELECT id FROM business_unit WHERE city = ?', [office.name]);
  if (byCity) return byCity.id;
  const code = OFFICE_COUNTRY[office.country];
  if (code) {
    const byCountry = queryOne('SELECT id FROM business_unit WHERE country = ? ORDER BY id LIMIT 1', [code]);
    if (byCountry) return byCountry.id;
  }
  return queryOne('SELECT id FROM business_unit ORDER BY id LIMIT 1')?.id ?? null;
}

/**
 * Find-or-create a property from the wizard's address. The reference payload
 * keeps the address inline; here it is also persisted so kf_propertyid is real.
 */
export function resolveProperty({ address, city, postcode, country, sector }) {
  const name = [address, city, postcode, country]
    .map((v) => String(v || '').trim()).filter(Boolean).join(', ');
  if (!name) return null;
  const existing = queryOne('SELECT id FROM property WHERE name = ?', [name]);
  if (existing) return existing.id;
  const id = nextId('property');
  run('INSERT INTO property (id, name, sector, site_id) VALUES (?,?,?,NULL)',
    [id, name, String(sector || 'Other').trim() || 'Other']);
  return id;
}

// --------------------------------------------------------------- actions

export function downloadDatabase() {
  const bytes = exportDatabase();
  const blob = new Blob([bytes], { type: 'application/x-sqlite3' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wip-poc.sqlite';
  a.click();
  URL.revokeObjectURL(url);
}

export { reseed, resetDatabase };

/** Strip the noisy sql.js prefix from a driver error. */
function cleanError(err) {
  return String(err?.message ?? err).replace(/^Error:\s*/i, '').trim();
}
