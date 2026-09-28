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

export function getPipelineByServiceLine(month) {
  return query(
    `
    SELECT service_line,
           count(*)                            AS lines,
           round(sum(gross_fee), 2)            AS gross,
           round(sum(office_retained * probability / 100.0), 2) AS weighted
      FROM v_wip
     WHERE wip_status = 'WIP' AND (? IS NULL OR reporting_month = ?)
     GROUP BY service_line
     ORDER BY gross DESC
  `,
    [month, month]
  );
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
