/**
 * Schema for the WIP proof of concept.
 *
 * The point of this file is that the business rules from the source
 * specification are expressed as *executable* database constraints rather than
 * described in a comment. A POC that only draws the tables proves nothing; a
 * POC that refuses to let you bill a line without an invoice number proves the
 * design holds.
 *
 * Rule provenance:
 *   PL-1..PL-4  plugins        -> trg_wip_pl1_*, trg_wip_pl2_*, trg_wip_pl3_*, trg_wip_pl4_*
 *   FL-1..FL-6  flows          -> trg_wip_fl1_*, trg_instruction_fl2_*, trg_wip_fl5_*
 *   BR-1..BR-6  business rules -> trg_wip_br_*
 *
 * Two SQLite limitations shape the code below:
 *   1. CHECK constraints cannot contain subqueries, so any rule needing a join
 *      (F5, the service-line parent match) is a trigger instead.
 *   2. Generated columns must be deterministic, so `is_stale` (which compares
 *      against date('now')) lives in a view rather than the table.
 */

export const SCHEMA_VERSION = 4;

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- reference

CREATE TABLE business_unit (
  id               INTEGER PRIMARY KEY,
  name             TEXT NOT NULL,
  city             TEXT NOT NULL,
  country          TEXT NOT NULL,
  -- BR VAT default: FR = 20, ES = 21, UK = 20
  vat_percent      REAL NOT NULL,
  -- kf_fin_localsystemname, auto-defaulted from the owning office
  erp_local_system TEXT NOT NULL
    CHECK (erp_local_system IN ('Paris GL','Madrid Accounting','SAP','Other'))
);

-- One table, self-referencing, so the Brand/Group -> Legal Entity hierarchy is
-- a real joinable structure rather than a denormalised name column.
CREATE TABLE account (
  id                 INTEGER PRIMARY KEY,
  name               TEXT NOT NULL,
  classification     TEXT NOT NULL
    CHECK (classification IN ('Brand/Group','Legal Entity')),
  parent_account_id  INTEGER REFERENCES account(id),
  CHECK (parent_account_id IS NULL OR parent_account_id <> id)
);
CREATE INDEX idx_account_parent ON account(parent_account_id);

CREATE TABLE contact (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  account_id INTEGER NOT NULL REFERENCES account(id)
);

CREATE TABLE site (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE property (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL,
  sector  TEXT NOT NULL,
  site_id INTEGER REFERENCES site(id)
);

-- The thirteen service-line parent tables (kf_Deal, kf_Engagement,
-- kf_ValuationInstruction, ...) share one shape here. kf_Instruction carries
-- exactly one pointer into this table, chosen by kf_serviceline. Keeping them
-- in a single table preserves the *rule* (exactly one parent, service line must
-- match) without thirteen near-identical tables.
CREATE TABLE service_line_parent (
  id                   INTEGER PRIMARY KEY,
  table_name           TEXT NOT NULL,
  service_line         TEXT NOT NULL UNIQUE,
  ref                  TEXT NOT NULL,
  -- CM extension: kf_DealProperty -> kf_Deal
  deal_id              INTEGER,
  -- PM extension: kf_DealProperty -> kf_PropertyMandate
  property_mandate_id  INTEGER
);

-- ------------------------------------------------------- kf_Instruction

CREATE TABLE instruction (
  id                       INTEGER PRIMARY KEY,
  -- INS-{SEQNUM:6}
  name                     TEXT NOT NULL UNIQUE,
  instruction_type         TEXT NOT NULL
    CHECK (instruction_type IN ('Mandate','Engagement','Instruction')),
  service_line             TEXT NOT NULL,
  -- Brand/Group: the relationship owner
  client_account_id        INTEGER NOT NULL REFERENCES account(id),
  -- Legal Entity: the entity on the fee letter and invoice (filtered lookup F5)
  legal_entity_account_id  INTEGER NOT NULL REFERENCES account(id),
  primary_contact_id       INTEGER REFERENCES contact(id),
  property_id              INTEGER REFERENCES property(id),
  owning_office_id         INTEGER NOT NULL REFERENCES business_unit(id),
  instruction_status       TEXT NOT NULL
    CHECK (instruction_status IN ('Active','Completed','On Hold','Withdrawn')),
  start_date               TEXT NOT NULL,
  end_date                 TEXT,
  signed_date              TEXT,
  expected_revenue         REAL NOT NULL DEFAULT 0,
  -- Conditional: required when the instruction is Withdrawn
  termination_reason       TEXT,
  erp_local_system_ref     TEXT,
  erp_local_system_name    TEXT,
  sector                   TEXT,
  negotiator               TEXT,
  comments                 TEXT,
  parent_id                INTEGER REFERENCES service_line_parent(id),
  -- BR: a non-blank termination reason is required on withdrawal. IS NOT NULL
  -- alone would let an empty string through, which is not a usable reason.
  CHECK (instruction_status <> 'Withdrawn' OR COALESCE(TRIM(termination_reason), '') <> '')
);
CREATE INDEX idx_instruction_status ON instruction(instruction_status);

-- The universal property junction. kf_MandateProperty was retired and merged
-- into kf_DealProperty on 26/08/2026.
CREATE TABLE deal_property (
  id                   INTEGER PRIMARY KEY,
  name                 TEXT NOT NULL UNIQUE,          -- DP-{SEQNUM:6}
  instruction_id       INTEGER NOT NULL REFERENCES instruction(id),
  property_id          INTEGER NOT NULL REFERENCES property(id),
  status               TEXT NOT NULL
    CHECK (status IN ('Active','Removed','Sold')),
  deal_id              INTEGER,      -- CM extension
  property_mandate_id  INTEGER,      -- PM extension
  date_added           TEXT,
  date_removed         TEXT,
  notes                TEXT
);
CREATE INDEX idx_deal_property_instruction ON deal_property(instruction_id);

-- Capital Markets only. The other twelve service lines key fee amounts
-- directly onto the WIP line.
CREATE TABLE fee_schedule (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL UNIQUE,
  instruction_id INTEGER REFERENCES instruction(id),
  fee_type       TEXT NOT NULL,
  fee_amount     REAL,
  fee_percent    REAL,
  CHECK (fee_amount IS NOT NULL OR fee_percent IS NOT NULL)
);

-- ------------------------------------------------------------- kf_WIP

CREATE TABLE wip (
  id                  INTEGER PRIMARY KEY,
  -- WIP-{SEQNUM:6} - the reference finance quotes, so the format matters
  name                TEXT NOT NULL UNIQUE,
  -- PL-1 vestigial: records which of the old thirteen parents was populated
  parent_type         TEXT,
  -- The only service-line path. kf_WIP has no direct service-line lookups.
  instruction_id      INTEGER NOT NULL REFERENCES instruction(id),
  fee_schedule_id     INTEGER REFERENCES fee_schedule(id),

  -- PL-2: denormalised from the parent so finance reports without joins
  service_line        TEXT,
  sector              TEXT,
  client_account_id   INTEGER REFERENCES account(id),
  spv_account_id      INTEGER REFERENCES account(id),
  property_id         INTEGER REFERENCES property(id),
  negotiator          TEXT,
  transaction_currency TEXT NOT NULL DEFAULT 'EUR',
  transaction_type    TEXT,

  -- Financials
  net_fee_to_group    REAL NOT NULL DEFAULT 0,
  office_retained     REAL NOT NULL DEFAULT 0,
  probability         REAL NOT NULL DEFAULT 0
    CHECK (probability >= 0 AND probability <= 100),
  -- BR / pipeline value: officeretained x probability / 100
  weighted_office_retained REAL GENERATED ALWAYS AS
    (office_retained * probability / 100.0) STORED,
  vat_percent         REAL NOT NULL DEFAULT 0,
  gross_fee           REAL NOT NULL DEFAULT 0,

  -- Timeline
  reporting_month     TEXT NOT NULL,
  completion_month    TEXT,
  -- completionmonth + 30 days
  stale_date          TEXT GENERATED ALWAYS AS
    (date(completion_month, '+30 days')) STORED,

  -- Status
  wip_status          TEXT NOT NULL DEFAULT 'WIP'
    CHECK (wip_status IN ('WIP','Billed','Paid','Lost')),
  wip_status_changed_on TEXT,
  previous_probability  REAL,

  -- Invoice and ERP
  invoice_number      TEXT,
  invoice_due_date    TEXT,
  date_paid_in_full   TEXT,
  erp_local_system_ref TEXT,

  -- Governance
  owning_office_id    INTEGER REFERENCES business_unit(id),
  period_locked       INTEGER NOT NULL DEFAULT 0
    CHECK (period_locked IN (0,1)),
  locked_by           TEXT,
  locked_on           TEXT,
  comments            TEXT
);
CREATE INDEX idx_wip_status ON wip(wip_status);
CREATE INDEX idx_wip_instruction ON wip(instruction_id);
CREATE INDEX idx_wip_reporting_month ON wip(reporting_month);

-- ------------------------------------------------------------- side tables

CREATE TABLE alert (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_type TEXT NOT NULL,
  wip_id     INTEGER REFERENCES wip(id),
  wip_name   TEXT,
  severity   TEXT NOT NULL DEFAULT 'Medium',
  message    TEXT NOT NULL,
  raised_on  TEXT NOT NULL DEFAULT (datetime('now')),
  resolved   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE event_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  entity     TEXT NOT NULL,
  entity_id  INTEGER,
  event      TEXT NOT NULL,
  detail     TEXT,
  logged_on  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------ views

-- is_stale needs date('now') so it cannot be a generated column.
CREATE VIEW v_wip AS
SELECT
  w.*,
  CASE WHEN w.wip_status = 'WIP'
        AND w.stale_date IS NOT NULL
        AND date('now') > w.stale_date
       THEN 1 ELSE 0 END                        AS is_stale,
  i.name                                        AS instruction_name,
  i.instruction_status                          AS instruction_status,
  i.expected_revenue                            AS expected_revenue,
  brand.name                                    AS brand_name,
  le.name                                       AS legal_entity_name,
  bu.name                                       AS office_name,
  bu.city                                       AS office_city,
  bu.erp_local_system                           AS erp_local_system,
  s.service_line                                AS parent_service_line,
  f.name                                        AS fee_schedule_name
FROM wip w
JOIN instruction i        ON i.id = w.instruction_id
LEFT JOIN account brand   ON brand.id = w.client_account_id
LEFT JOIN account le      ON le.id = i.legal_entity_account_id
LEFT JOIN business_unit bu ON bu.id = w.owning_office_id
LEFT JOIN service_line_parent s ON s.service_line = w.service_line
LEFT JOIN fee_schedule f  ON f.id = w.fee_schedule_id;

-- Aged receivables. The source defines this KPI against
-- kf_Deal.kf_fin_outstanding, which does not exist (Q7); this is the inferred
-- derivation from billed WIP lines.
CREATE VIEW v_receivables AS
SELECT
  w.id,
  w.name,
  w.brand_name,
  w.wip_status,
  w.gross_fee,
  w.vat_percent,
  w.gross_fee * (1 + w.vat_percent / 100.0)  AS gross_incl_vat,
  w.invoice_number,
  w.invoice_due_date,
  CAST(julianday('now') - julianday(w.invoice_due_date) AS INTEGER) AS days_overdue,
  CASE
    WHEN julianday('now') - julianday(w.invoice_due_date) <= 30 THEN '0-30'
    WHEN julianday('now') - julianday(w.invoice_due_date) <= 60 THEN '31-60'
    WHEN julianday('now') - julianday(w.invoice_due_date) <= 90 THEN '61-90'
    ELSE '90+'
  END AS bucket
FROM v_wip w
WHERE w.wip_status = 'Billed';

-- ---------------------------------------------------------------- triggers

-- F5: the invoice entity must be classified as a Legal Entity.
CREATE TRIGGER trg_instruction_f5_insert
BEFORE INSERT ON instruction
WHEN (SELECT classification FROM account WHERE id = NEW.legal_entity_account_id) IS NOT 'Legal Entity'
BEGIN
  SELECT RAISE(ABORT,
    'F5: kf_legalentityaccountid must be an account classified as Legal Entity.');
END;

CREATE TRIGGER trg_instruction_f5_update
BEFORE UPDATE OF legal_entity_account_id ON instruction
WHEN (SELECT classification FROM account WHERE id = NEW.legal_entity_account_id) IS NOT 'Legal Entity'
BEGIN
  SELECT RAISE(ABORT,
    'F5: kf_legalentityaccountid must be an account classified as Legal Entity.');
END;

-- "Exactly one populated per record, determined by kf_serviceline."
CREATE TRIGGER trg_instruction_parent_insert
BEFORE INSERT ON instruction
WHEN NEW.parent_id IS NULL
  OR (SELECT service_line FROM service_line_parent WHERE id = NEW.parent_id) IS NOT NEW.service_line
BEGIN
  SELECT RAISE(ABORT,
    'kf_Instruction requires exactly one service-line parent, and it must match kf_serviceline.');
END;

CREATE TRIGGER trg_instruction_parent_update
BEFORE UPDATE OF parent_id, service_line ON instruction
WHEN NEW.parent_id IS NULL
  OR (SELECT service_line FROM service_line_parent WHERE id = NEW.parent_id) IS NOT NEW.service_line
BEGIN
  SELECT RAISE(ABORT,
    'kf_Instruction requires exactly one service-line parent, and it must match kf_serviceline.');
END;

-- PL-1: under the current single-parent design this collapses to requiring
-- kf_instructionid and stamping kf_parenttype = 'Instruction'.
CREATE TRIGGER trg_wip_pl1_parent
BEFORE INSERT ON wip
WHEN NEW.instruction_id IS NULL
BEGIN
  SELECT RAISE(ABORT,
    'PL-1: kf_instructionid is required. It is the only service-line path onto kf_WIP.');
END;

CREATE TRIGGER trg_wip_pl1_stamp
AFTER INSERT ON wip
BEGIN
  UPDATE wip SET parent_type = 'Instruction' WHERE id = NEW.id AND parent_type IS NULL;
END;

-- PL-2: classification is denormalised from the parent Instruction on create.
CREATE TRIGGER trg_wip_pl2_fill
AFTER INSERT ON wip
BEGIN
  UPDATE wip
     SET service_line      = COALESCE(NEW.service_line,
        (SELECT i.service_line FROM instruction i WHERE i.id = NEW.instruction_id)),
         sector            = COALESCE(NEW.sector,
        (SELECT i.sector FROM instruction i WHERE i.id = NEW.instruction_id)),
         client_account_id = COALESCE(NEW.client_account_id,
        (SELECT i.client_account_id FROM instruction i WHERE i.id = NEW.instruction_id)),
         negotiator        = COALESCE(NEW.negotiator,
        (SELECT i.negotiator FROM instruction i WHERE i.id = NEW.instruction_id)),
         owning_office_id  = COALESCE(NEW.owning_office_id,
        (SELECT i.owning_office_id FROM instruction i WHERE i.id = NEW.instruction_id)),
         transaction_type  = COALESCE(NEW.transaction_type, 'Fee'),
         vat_percent       = CASE WHEN NEW.vat_percent > 0 THEN NEW.vat_percent
                                  ELSE COALESCE((SELECT bu.vat_percent FROM business_unit bu
                                         WHERE bu.id = (SELECT i.owning_office_id FROM instruction i
                                                         WHERE i.id = NEW.instruction_id)), 0)
                             END
   WHERE id = NEW.id;
END;

-- PL-3: pre-image capture. Without it FL-5 has no baseline to compare against.
--
-- This has to be an AFTER trigger that writes back to the same row: SQLite
-- forbids assigning to NEW in a trigger body, and a "SELECT NEW.x = OLD.y"
-- expression is a comparison, not an assignment. The write-back cannot recurse
-- because it leaves probability untouched, so the WHEN guard stops it.
CREATE TRIGGER trg_wip_pl3_preimage
AFTER UPDATE OF probability ON wip
FOR EACH ROW
WHEN NEW.probability IS NOT OLD.probability
BEGIN
  UPDATE wip SET previous_probability = OLD.probability WHERE id = NEW.id;
  INSERT INTO event_log (entity, entity_id, event, detail)
  VALUES ('wip', NEW.id, 'PL-3 probability pre-image',
          OLD.probability || '% -> ' || NEW.probability || '%');
END;

-- BR probability lock: probability is frozen once status leaves WIP.
CREATE TRIGGER trg_wip_br_probability_lock
BEFORE UPDATE OF probability ON wip
FOR EACH ROW
WHEN NEW.probability IS NOT OLD.probability AND OLD.wip_status <> 'WIP'
BEGIN
  SELECT RAISE(ABORT,
    'BR probability lock: kf_probability cannot change once kf_wipstatus leaves WIP.');
END;

-- PL-4: reject edits to locked fields on a locked period.
CREATE TRIGGER trg_wip_pl4_period_lock
BEFORE UPDATE ON wip
FOR EACH ROW
WHEN OLD.period_locked = 1 AND (
       NEW.net_fee_to_group    IS NOT OLD.net_fee_to_group
    OR NEW.office_retained     IS NOT OLD.office_retained
    OR NEW.probability         IS NOT OLD.probability
    OR NEW.gross_fee           IS NOT OLD.gross_fee
    OR NEW.wip_status          IS NOT OLD.wip_status
    OR NEW.completion_month    IS NOT OLD.completion_month
    OR NEW.invoice_number      IS NOT OLD.invoice_number
    OR NEW.invoice_due_date    IS NOT OLD.invoice_due_date
    OR NEW.date_paid_in_full   IS NOT OLD.date_paid_in_full
    OR NEW.erp_local_system_ref IS NOT OLD.erp_local_system_ref
   )
BEGIN
  SELECT RAISE(ABORT,
    'PL-4: this period is locked by FL-4. Locked fields cannot be edited.');
END;

-- BR invoice field requirements, at Billed.
CREATE TRIGGER trg_wip_br_billed_fields
BEFORE UPDATE OF wip_status ON wip
FOR EACH ROW
WHEN NEW.wip_status = 'Billed' AND (
       COALESCE(NEW.invoice_number, '') = ''
    OR NEW.invoice_due_date IS NULL
    OR COALESCE(NEW.erp_local_system_ref, '') = ''
   )
BEGIN
  SELECT RAISE(ABORT,
    'BR invoice requirements: kf_invoicenumber, kf_invoiceduedate and kf_fin_localsystemref are all required at Billed.');
END;

-- BR invoice field requirements, at Paid. The invoice number is required at
-- both Billed and Paid and is never cleared.
CREATE TRIGGER trg_wip_br_paid_fields
BEFORE UPDATE OF wip_status ON wip
FOR EACH ROW
WHEN NEW.wip_status = 'Paid' AND (
       NEW.date_paid_in_full IS NULL
    OR COALESCE(NEW.invoice_number, '') = ''
   )
BEGIN
  SELECT RAISE(ABORT,
    'BR invoice requirements: kf_datepaidinfull is required at Paid, and kf_invoicenumber must still be present.');
END;

-- Paid and Lost are terminal.
CREATE TRIGGER trg_wip_terminal_status
BEFORE UPDATE OF wip_status ON wip
FOR EACH ROW
WHEN OLD.wip_status IN ('Paid','Lost') AND NEW.wip_status IS NOT OLD.wip_status
BEGIN
  SELECT RAISE(ABORT,
    'kf_wipstatus is terminal: a line at Paid or Lost cannot be moved.');
END;

-- Stamp the status change timestamp.
CREATE TRIGGER trg_wip_status_stamp
AFTER UPDATE OF wip_status ON wip
FOR EACH ROW
WHEN NEW.wip_status IS NOT OLD.wip_status
BEGIN
  UPDATE wip SET wip_status_changed_on = datetime('now') WHERE id = NEW.id;
  INSERT INTO event_log (entity, entity_id, event, detail)
  VALUES ('wip', NEW.id, 'status change', OLD.wip_status || ' -> ' || NEW.wip_status);
END;

-- FL-5: probability gaming. The only quantified control threshold in the spec.
CREATE TRIGGER trg_wip_fl5_gaming
AFTER UPDATE OF wip_status ON wip
FOR EACH ROW
WHEN NEW.wip_status = 'Billed' AND OLD.wip_status = 'WIP' AND NEW.probability < 30
BEGIN
  INSERT INTO alert (alert_type, wip_id, wip_name, severity, message)
  VALUES ('FL-5', NEW.id, NEW.name, 'High',
          'Billed from a probability of ' || CAST(NEW.probability AS TEXT)
          || '%, below the 30% control threshold.');
END;

-- FL-2 / FL-3: loss cascade. When the parent Instruction is withdrawn, its WIP
-- lines are lost with it.
CREATE TRIGGER trg_instruction_fl2_cascade
AFTER UPDATE OF instruction_status ON instruction
FOR EACH ROW
WHEN NEW.instruction_status = 'Withdrawn' AND OLD.instruction_status <> 'Withdrawn'
BEGIN
  UPDATE wip
     SET wip_status = 'Lost',
         comments = COALESCE(comments || ' | ', '') || 'Cascaded from parent withdrawal (FL-2/FL-3).'
   WHERE instruction_id = NEW.id AND wip_status <> 'Lost';
  INSERT INTO alert (alert_type, severity, message)
  VALUES ('FL-2', 'High',
          'Parent instruction ' || NEW.name || ' withdrawn; child WIP lines cascaded to Lost.');
END;

-- Guard the conditional-fee link: it is Capital Markets only.
-- SQLite does not let a single trigger cover both INSERT and UPDATE OF a
-- column, so the two events get their own triggers. Without the INSERT half,
-- an invalid line could be created and only then become impossible to repair.
CREATE TRIGGER trg_wip_fee_schedule_cm_insert
BEFORE INSERT ON wip
FOR EACH ROW
WHEN NEW.fee_schedule_id IS NOT NULL
 AND (SELECT i.service_line FROM instruction i WHERE i.id = NEW.instruction_id) <> 'Capital Markets'
BEGIN
  SELECT RAISE(ABORT,
    'kf_FeeSchedule is a Capital Markets table; it cannot be linked to a non-CM WIP line.');
END;

CREATE TRIGGER trg_wip_fee_schedule_cm
BEFORE UPDATE OF fee_schedule_id ON wip
FOR EACH ROW
WHEN NEW.fee_schedule_id IS NOT NULL
 AND (SELECT i.service_line FROM instruction i WHERE i.id = NEW.instruction_id) <> 'Capital Markets'
BEGIN
  SELECT RAISE(ABORT,
    'kf_FeeSchedule is a Capital Markets table; it cannot be linked to a non-CM WIP line.');
END;
`;
