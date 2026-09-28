/**
 * Seed data.
 *
 * Every row is written as a live `WIP` line and then transitioned with real
 * UPDATEs, so the PL/FL/BR triggers actually fire during seeding. Seeding a
 * line straight into `Billed` would silently skip the invoice-field checks and
 * the FL-5 gaming alert, which are the most interesting parts to demonstrate.
 *
 * Dates are generated relative to today so the aging buckets and the stale
 * detection look alive whenever the POC is opened.
 */

const DAY = 86400000;

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function daysFromNow(n) {
  return iso(new Date(Date.now() + n * DAY));
}

function firstOfMonth(offsetMonths) {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offsetMonths);
  return iso(d);
}

function q(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Build the seed. `db` is a raw sql.js Database. */
export function buildSeed(db) {
  const sql = [];

  // ------------------------------------------------ reference data

  sql.push(`
    INSERT INTO business_unit (id, name, city, country, vat_percent, erp_local_system) VALUES
      (1, 'KF Paris',        'Paris',   'FR', 20, 'Paris GL'),
      (2, 'KF Madrid',       'Madrid',  'ES', 21, 'Madrid Accounting'),
      (3, 'KF London',       'London',  'UK', 20, 'SAP');
  `);

  // Brand/Group accounts are the relationship owners; Legal Entity accounts are
  // what gets invoiced. The hierarchy is the two-account split on kf_Instruction.
  sql.push(`
    INSERT INTO account (id, name, classification, parent_account_id) VALUES
      (1, 'Meridian Capital Partners',  'Brand/Group',  NULL),
      (2, 'Meridian Capital France SAS','Legal Entity', 1),
      (3, 'Meridian Capital Spain SL',  'Legal Entity', 1),
      (4, 'Northgate Estates',          'Brand/Group',  NULL),
      (5, 'Northgate Estates UK Ltd',   'Legal Entity', 4),
      (6, 'Alderman Family Office',     'Brand/Group',  NULL),
      (7, 'Alderman French SARL',       'Legal Entity', 6);
  `);

  sql.push(`
    INSERT INTO contact (id, name, account_id) VALUES
      (1, 'Camille Roux',     2),
      (2, 'Diego Alvarez',    3),
      (3, 'Priya Raman',      5),
      (4, 'Helene Aubert',    7);
  `);

  sql.push(`
    INSERT INTO site (id, name) VALUES
      (1, 'Paris - La Defense'),
      (2, 'Madrid - Cuatro Torres'),
      (3, 'London - City');
  `);

  sql.push(`
    INSERT INTO property (id, name, sector, site_id) VALUES
      (1, 'Tour Meridian',        'Office',     1),
      (2, 'Immeuble Alonso',      'Residential',2),
      (3, 'Northgate House',      'Office',     3),
      (4, 'Alderman Portfolio',   'Industrial', 1),
      (5, 'Retail Park Madrid',   'Retail',     2);
  `);

  // The thirteen service-line parent tables, collapsed into one shape.
  const serviceLines = [
    ['kf_Deal', 'Capital Markets'],
    ['kf_Engagement', 'OSS'],
    ['kf_ValuationInstruction', 'Valuations'],
    ['kf_Lease', 'Leasing'],
    ['kf_PropertyMandate', 'Property Management'],
    ['kf_DevelopmentProject', 'Development'],
    ['kf_DebtMandate', 'Capital Advisory'],
    ['kf_BuildingSurvey', 'Building Consultancy'],
    ['kf_WorkplaceAssessment', 'Workplace'],
    ['kf_InvestorMandate', 'Investor Advisory'],
    ['kf_SalesInstruction', 'Residential Sales'],
    ['kf_LettingsInstruction', 'Residential Lettings'],
    ['kf_ESGAssessment', 'ESG Consultancy']
  ];
  const slValues = serviceLines
    .map(([table, line], i) => `(${i + 1}, ${q(table)}, ${q(line)}, ${q('SL-' + String(i + 1).padStart(4, '0'))})`)
    .join(',\n      ');
  sql.push(`
    INSERT INTO service_line_parent (id, table_name, service_line, ref) VALUES
      ${slValues};
  `);

  // ------------------------------------------------- kf_Instruction

  // [id, type, serviceLine, client(brand), legalEntity, office, status,
  //  startOffset, endOffset, revenue, sector, negotiator, propertyId]
  const instructions = [
    [1, 'Mandate',     'Capital Markets',      1, 2, 1, 'Active',    -180, null, 1450000, 'Office',     'Camille Roux',   1],
    [2, 'Mandate',     'Capital Markets',      4, 5, 3, 'Active',    -120, null,  980000, 'Office',     'Priya Raman',    3],
    [3, 'Engagement',  'Valuations',           1, 2, 1, 'Active',     -90, null,  420000, 'Office',     'Helene Aubert',  1],
    [4, 'Mandate',     'Property Management',  6, 7, 1, 'Active',     -60, null,  310000, 'Industrial', 'Camille Roux',   4],
    [5, 'Engagement',  'Capital Advisory',     1, 3, 2, 'Active',     -45, null, 1250000, 'Office',     'Diego Alvarez',  null],
    [6, 'Mandate',     'Leasing',              4, 5, 3, 'On Hold',   -200, null,  260000, 'Retail',     'Priya Raman',    5],
    [7, 'Engagement',  'ESG Consultancy',      6, 7, 1, 'Active',     -30, null,  150000, 'Industrial', 'Helene Aubert',  4],
    // Seeded Active, then withdrawn below so the FL-2/FL-3 cascade actually runs
    [8, 'Mandate',     'Capital Markets',      1, 2, 1, 'Active',    -150, null,   600000, 'Office',     'Camille Roux',   1]
  ];

  for (const [
    id, type, line, brand, legalEntity, office, status,
    startOffset, endOffset, revenue, sector, negotiator, propertyId
  ] of instructions) {
    const slId = serviceLines.findIndex(([, l]) => l === line) + 1;
    sql.push(`
      INSERT INTO instruction (
        id, name, instruction_type, service_line,
        client_account_id, legal_entity_account_id, primary_contact_id, property_id,
        owning_office_id, instruction_status, start_date, end_date, signed_date,
        expected_revenue, termination_reason, sector, negotiator, parent_id, comments
      ) VALUES (
        ${id},
        ${q('INS-' + String(id).padStart(6, '0'))},
        ${q(type)}, ${q(line)},
        ${brand}, ${legalEntity}, ${(brand % 4) + 1}, ${propertyId === null ? 'NULL' : propertyId},
        ${office}, ${q(status)}, ${q(daysFromNow(startOffset))},
        ${endOffset === null ? 'NULL' : q(daysFromNow(endOffset))},
        ${q(daysFromNow(startOffset - 5))},
        ${revenue},
        NULL,
        ${q(sector)}, ${q(negotiator)}, ${slId},
        ${q('Standard fee arrangement.')}
      );
    `);
  }

  // The universal property junction, populated by the service lines.
  sql.push(`
    INSERT INTO deal_property (id, name, instruction_id, property_id, status, deal_id, property_mandate_id, date_added) VALUES
      (1, 'DP-000001', 1, 1, 'Active',  1, NULL, ${q(daysFromNow(-180))}),
      (2, 'DP-000002', 1, 4, 'Active',  1, NULL, ${q(daysFromNow(-180))}),
      (3, 'DP-000003', 2, 3, 'Active',  2, NULL, ${q(daysFromNow(-120))}),
      (4, 'DP-000004', 3, 1, 'Active',  NULL, NULL, ${q(daysFromNow(-90))}),
      (5, 'DP-000005', 4, 4, 'Active',  NULL, 1, ${q(daysFromNow(-60))}),
      (6, 'DP-000006', 6, 5, 'Removed', NULL, 2, ${q(daysFromNow(-200))});
  `);

  // Fee schedules are Capital Markets only.
  sql.push(`
    INSERT INTO fee_schedule (id, name, instruction_id, fee_type, fee_amount) VALUES
      (1, 'FS-000001', 1, 'Fixed fee', 1450000),
      (2, 'FS-000002', 2, 'Fixed fee',  980000);
  `);

  // ------------------------------------------------------- kf_WIP
  //
  // All lines start as WIP. Lifecycle transitions happen below so the
  // conditional-requirement and gaming triggers run for real.

  const thisMonth = firstOfMonth(0);
  const lastMonth = firstOfMonth(-1);
  const twoMonthsAgo = firstOfMonth(-2);

  // [instr, net, retained, prob, gross, reportingMonth, completionOffsetMonths, currency]
  const wipLines = [
    [1, 1200000, 240000, 70, 1200000, thisMonth,  2, 'EUR'],
    [1,  850000, 170000, 45,  850000, thisMonth,  3, 'EUR'],
    [1,  400000,  80000, 25,  400000, thisMonth,  1, 'EUR'],
    [2,  780000, 156000, 60,  780000, thisMonth,  4, 'GBP'],
    [2,  200000,  40000, 15,  200000, thisMonth,  1, 'GBP'],
    [3,  420000, 105000, 80,  420000, thisMonth,  2, 'EUR'],
    [4,  310000,  62000, 50,  310000, thisMonth,  3, 'EUR'],
    [5, 1250000, 250000, 35, 1250000, thisMonth,  6, 'EUR'],
    [6,  260000,  52000, 20,  260000, lastMonth, -1, 'GBP'],
    [7,  150000,  37500, 55,  150000, thisMonth,  2, 'EUR'],
    // Already past due, for the aging buckets
    [1,  300000,  60000, 90,  300000, twoMonthsAgo, -2, 'EUR'],
    [2,  180000,  36000, 85,  180000, twoMonthsAgo, -3, 'GBP'],
    [3,   90000,  22500, 95,   90000, lastMonth, 0, 'EUR'],
    // Long-stale: completion month well over 30 days ago
    [4,  140000,  28000, 40,  140000, twoMonthsAgo, -3, 'EUR'],
    [7,   60000,  15000, 30,   60000, twoMonthsAgo, -2, 'EUR'],
    // Child of instruction 8, which gets withdrawn below -> FL-2 cascade
    [8,  220000,  44000, 65,  220000, thisMonth,  1, 'EUR']
  ];

  let n = 0;
  const wipIds = [];
  for (const [instr, net, retained, prob, gross, month, completion, currency] of wipLines) {
    n += 1;
    const id = n;
    wipIds.push(id);
    const completionMonth = firstOfMonth(completion);
    const fee = instr === 1 || instr === 2 ? (instr === 1 ? 1 : 2) : 'NULL';
    sql.push(`
      INSERT INTO wip (
        id, name, instruction_id, fee_schedule_id,
        net_fee_to_group, office_retained, probability, gross_fee,
        reporting_month, completion_month, transaction_currency, comments
      ) VALUES (
        ${id},
        ${q('WIP-' + String(id).padStart(6, '0'))},
        ${instr}, ${fee},
        ${net}, ${retained}, ${prob}, ${gross},
        ${q(month)}, ${q(completionMonth)}, ${q(currency)},
        ${q('Seeded demonstration line.')}
      );
    `);
  }

  db.run(sql.join('\n'));

  // ------------------------------------------ lifecycle transitions
  //
  // Each block moves a line through the ladder, supplying the conditional
  // fields at the moment they become required. A missing field here would
  // abort the whole seed, which is the behaviour we want.

  const transition = [];

  // WIP -> Billed. Supply invoice number, due date and the ERP reference.
  const billed = [
    // [wipId, invoiceNo, dueOffsetDays, erpRef]
    [11, 'INV-2026-0001', -75, 'PG-2026-0001'],
    [12, 'INV-2026-0002', -45, 'SAP-2026-0044'],
    [13, 'INV-2026-0003', -12, 'PG-2026-0002'],
    [6,  'INV-2026-0004',  18, 'PG-2026-0003']
  ];
  for (const [id, inv, dueOffset, erp] of billed) {
    transition.push(`
      UPDATE wip
         SET wip_status = 'Billed',
             invoice_number = ${q(inv)},
             invoice_due_date = ${q(daysFromNow(dueOffset))},
             erp_local_system_ref = ${q(erp)}
       WHERE id = ${id};
    `);
  }

  // Billed -> Paid.
  transition.push(`
    UPDATE wip
       SET wip_status = 'Paid',
           date_paid_in_full = ${q(daysFromNow(-20))}
     WHERE id = 11;
  `);

  // FL-5 demonstration: bill a line that is still at 20% probability. This
  // succeeds, and the trigger raises the gaming alert.
  transition.push(`
    UPDATE wip
       SET wip_status = 'Billed',
           invoice_number = 'INV-2026-0005',
           invoice_due_date = ${q(daysFromNow(30))},
           erp_local_system_ref = 'PG-2026-0004'
     WHERE id = 5;
  `);

  // A line already stale by the completion-month + 30 day rule.
  transition.push(`
    UPDATE wip SET probability = 38 WHERE id = 14;
  `);

  // FL-4: lock the two-months-ago reporting period.
  transition.push(`
    UPDATE wip
       SET period_locked = 1,
           locked_by = 'finance.admin',
           locked_on = ${q(daysFromNow(-20) + ' 02:00:00')}
     WHERE reporting_month = ${q(twoMonthsAgo)};
  `);

  // Instruction 8 is seeded Active and withdrawn here, so the FL-2/FL-3 loss
  // cascade fires against its child WIP line for real.
  transition.push(`
    UPDATE instruction
       SET instruction_status = 'Withdrawn',
           termination_reason = 'Client request'
     WHERE id = 8;
  `);

  db.run(transition.join('\n'));
}
