/**
 * Instruction wizard configuration — ported from the POC-Instructions wizard
 * (instruction-wizard.html), keeping its field lists, mock directories and
 * per-type detail definitions verbatim so the two apps present the same form.
 *
 * Nothing here touches the database. The wizard collects names and mock
 * lookups; accepting resolves them onto the relational model (see repo.js).
 */

/* ============================================================
   Instruction type configuration
   Choice values from EU CRM Data Model.xlsx — one entry per service line.
   `core` maps straight onto instruction_type; `serviceLine` goes through
   mapServiceLine() because a few names differ from service_line_parent.
   ============================================================ */
export const TYPES = {
  sales: {
    name: 'Sales Instruction', entity: 'kf_SalesInstruction', core: 'Instruction',
    serviceLine: 'Residential Sales', icon: '🏠', role: 'Vendor',
    desc: 'Residential sale instructions from vendors',
    fields: [
      { key: 'kf_instructiontype', label: 'Agency type', type: 'select', req: true,
        opts: ['Sole Agency', 'Joint Sole Agency', 'Multi Agency', 'Private Treaty', 'Auction', 'Tender'] },
      { key: 'kf_instructiondate', label: 'Instruction date', type: 'date', req: true },
      { key: 'kf_instructionexpiry', label: 'Instruction expiry', type: 'date' },
      { key: 'kf_askingprice', label: 'Asking price', type: 'number', req: true, hint: 'Agreed asking price' },
      { key: 'kf_guidepricelow', label: 'Guide price (low)', type: 'number' },
      { key: 'kf_guidepricehigh', label: 'Guide price (high)', type: 'number' },
      { key: 'kf_commissionpercent', label: 'Commission %', type: 'number', req: true, suffix: '%' },
      { key: 'kf_marketinglaunchdate', label: 'Marketing launch date', type: 'date' }
    ]
  },
  lettings: {
    name: 'Lettings Instruction', entity: 'kf_LettingsInstruction', core: 'Instruction',
    serviceLine: 'Residential Lettings', icon: '🏡', role: 'Landlord',
    desc: 'Residential letting instructions from landlords',
    fields: [
      { key: 'kf_instructiontype', label: 'Management type', type: 'select', req: true,
        opts: ['Sole Agency', 'Joint', 'Multi', 'Let Only', 'Let & Manage', 'Full Management'] },
      { key: 'kf_instructiondate', label: 'Instruction date', type: 'date', req: true },
      { key: 'kf_instructionexpiry', label: 'Instruction expiry', type: 'date' },
      { key: 'kf_weeklyrent', label: 'Asking weekly rent', type: 'number', req: true, calc: true },
      { key: 'kf_monthlyrent', label: 'Monthly equivalent', type: 'number', readonly: true },
      { key: 'kf_annualrent', label: 'Annual equivalent', type: 'number', readonly: true },
      { key: 'kf_commissionpercent', label: 'Letting fee %', type: 'number', req: true, suffix: '%' },
      { key: 'kf_managementfeepercent', label: 'Management fee %', type: 'number', suffix: '%', hideIf: 'noMgmt' },
      { key: 'kf_mintenancyterm', label: 'Minimum tenancy term', type: 'select',
        opts: ['6 months', '12 months', '24 months', 'Longer'] },
      { key: 'kf_furnishing', label: 'Furnishing', type: 'select',
        opts: ['Furnished', 'Part Furnished', 'Unfurnished'] },
      { key: 'kf_marketinglaunchdate', label: 'Marketing launch date', type: 'date' }
    ]
  },
  valuation: {
    name: 'Valuation Instruction', entity: 'kf_ValuationInstruction', core: 'Instruction',
    serviceLine: 'Valuations', icon: '📊', role: 'Instructing party',
    desc: 'RICS valuations for lending, accounts, insurance, tax',
    fields: [
      { key: 'kf_valuationpurpose', label: 'Purpose', type: 'select', req: true,
        opts: ['Secured Lending', 'Fund Reporting', 'Acquisition', 'Disposal', 'Insurance', 'Tax', 'Financial Statements'] },
      { key: 'kf_valuationbasis', label: 'Valuation basis', type: 'select', req: true,
        opts: ['Market Value', 'Market Rent', 'Fair Value', 'DRC', 'Reinstatement'] },
      { key: 'kf_instructiondate', label: 'Instruction date', type: 'date', req: true },
      { key: 'kf_inspectiondate', label: 'Inspection date', type: 'date' },
      { key: 'kf_reportduedate', label: 'Report due date', type: 'date', req: true },
      { key: 'kf_fee', label: 'Agreed fee', type: 'number' }
    ]
  },
  leasing: {
    name: 'Leasing Instruction', entity: 'kf_Lease', core: 'Instruction',
    serviceLine: 'Leasing (Commercial Agency)', icon: '🏢', role: 'Client',
    desc: 'Commercial agency — landlord and tenant representation',
    fields: [
      { key: 'kf_transactiontype', label: 'Representation', type: 'select', req: true,
        opts: ['Letting - Landlord Rep', 'Letting - Tenant Rep'] },
      { key: 'kf_instructiondate', label: 'Instruction date', type: 'date', req: true },
      { key: 'kf_askingrent', label: 'Asking rent (pa)', type: 'number' },
      { key: 'kf_commissionpercent', label: 'Commission %', type: 'number', suffix: '%' },
      { key: 'kf_marketinglaunchdate', label: 'Marketing launch date', type: 'date' }
    ]
  },
  capitalmarkets: {
    name: 'Capital Markets Instruction', entity: 'kf_Deal', core: 'Instruction',
    serviceLine: 'Capital Markets', icon: '💼', role: 'Client',
    desc: 'Investment transactions — disposals, acquisitions, capital raising',
    fields: [
      { key: 'kf_transactiontype', label: 'Transaction type', type: 'select', req: true,
        opts: ['Sale', 'Purchase', 'Letting - Landlord Rep', 'Letting - Tenant Rep', 'Debt/Finance', 'Consultancy', 'Other'] },
      { key: 'kf_instructiondate', label: 'Instruction date (S3)', type: 'date', req: true,
        hint: 'S3 of the 8-stage deal lifecycle' },
      { key: 'kf_capitalvalue', label: 'Capital value', type: 'number' },
      { key: 'kf_targetcompletiondate', label: 'Target completion', type: 'date' }
    ]
  },
  capitaladvisory: {
    name: 'Capital Advisory Mandate', entity: 'kf_DebtMandate', core: 'Mandate',
    serviceLine: 'Capital Advisory', icon: '🏦', role: 'Client',
    desc: 'Debt and structured finance — senior, mezzanine, development',
    fields: [
      { key: 'kf_financetype', label: 'Finance type', type: 'select', req: true,
        opts: ['Senior Debt', 'Mezzanine', 'Development Finance', 'Refinancing'] },
      { key: 'kf_instructiondate', label: 'Mandate date', type: 'date', req: true },
      { key: 'kf_loanamount', label: 'Target loan amount', type: 'number', req: true },
      { key: 'kf_targetdrawdowndate', label: 'Target drawdown', type: 'date' }
    ]
  },
  investoryadvisory: {
    name: 'Investor Advisory Mandate', entity: 'kf_InvestorMandate', core: 'Mandate',
    serviceLine: 'Investor Advisory', icon: '📈', role: 'Client',
    desc: 'Investment strategy, deal sourcing, portfolio reporting',
    fields: [
      { key: 'kf_instructiondate', label: 'Mandate date', type: 'date', req: true },
      { key: 'kf_scopework', label: 'Scope of work', type: 'textarea', req: true,
        hint: 'Strategy brief / sourcing mandate / reporting scope' },
      { key: 'kf_targetreportdate', label: 'First report due', type: 'date' }
    ]
  },
  propertymgmt: {
    name: 'Property Management Mandate', entity: 'kf_PropertyMandate', core: 'Mandate',
    serviceLine: 'Property Management', icon: '🔧', role: 'Client',
    desc: 'Lease administration, service charges, maintenance, rent collection',
    fields: [
      { key: 'kf_instructiondate', label: 'Mandate date', type: 'date', req: true },
      { key: 'kf_portfoliosize', label: 'Units / leases managed', type: 'number' },
      { key: 'kf_scopework', label: 'Scope of work', type: 'textarea', req: true }
    ]
  },
  oss: {
    name: 'OSS Engagement', entity: 'kf_Engagement', core: 'Engagement',
    serviceLine: 'Occupier Strategy & Solutions', icon: '🧭', role: 'Client',
    desc: 'Corporate occupier advisory — workplace strategy, location search, lease negotiation',
    fields: [
      { key: 'kf_engagementtype', label: 'Engagement type', type: 'select', req: true,
        opts: ['Location Search', 'Lease Negotiation', 'Portfolio Optimisation', 'Workplace Strategy'] },
      { key: 'kf_instructiondate', label: 'Brief date', type: 'date', req: true },
      { key: 'kf_scopework', label: 'Scope of work', type: 'textarea', req: true },
      { key: 'kf_targetcompletiondate', label: 'Target completion', type: 'date' }
    ]
  },
  workplace: {
    name: 'Workplace Engagement', entity: 'kf_WorkplaceAssessment', core: 'Engagement',
    serviceLine: 'Workplace Consulting', icon: '🪑', role: 'Client',
    desc: 'Space utilisation, workplace design, change management',
    fields: [
      { key: 'kf_instructiondate', label: 'Brief date', type: 'date', req: true },
      { key: 'kf_scopework', label: 'Scope of work', type: 'textarea', req: true },
      { key: 'kf_reportduedate', label: 'Report due date', type: 'date' }
    ]
  },
  esg: {
    name: 'ESG Engagement', entity: 'kf_ESGAssessment', core: 'Engagement',
    serviceLine: 'ESG Consultancy', icon: '🌱', role: 'Client',
    desc: 'Energy audits, CRREM analysis, net-zero pathways, certifications',
    fields: [
      { key: 'kf_assessmenttype', label: 'Assessment type', type: 'select', req: true,
        opts: ['Energy Audit', 'CRREM Analysis', 'Net Zero Pathway', 'Certification'] },
      { key: 'kf_instructiondate', label: 'Instruction date', type: 'date', req: true },
      { key: 'kf_reportduedate', label: 'Report due date', type: 'date' }
    ]
  },
  buildingconsult: {
    name: 'Building Consultancy Engagement', entity: 'kf_BuildingSurvey', core: 'Engagement',
    serviceLine: 'Building Consultancy', icon: '🧱', role: 'Client',
    desc: 'Surveys, dilapidations, project monitoring, technical due diligence',
    fields: [
      { key: 'kf_surveytype', label: 'Survey type', type: 'select', req: true,
        opts: ['Building Survey', 'Dilapidations', 'Project Monitoring', 'Technical Due Diligence'] },
      { key: 'kf_instructiondate', label: 'Instruction date', type: 'date', req: true },
      { key: 'kf_inspectiondate', label: 'Inspection date', type: 'date' }
    ]
  },
  development: {
    name: 'Development Engagement', entity: 'kf_DevelopmentProject', core: 'Engagement',
    serviceLine: 'Development Consultancy', icon: '🏗️', role: 'Client',
    desc: 'Feasibility, planning strategy, development management',
    fields: [
      { key: 'kf_instructiondate', label: 'Instruction date', type: 'date', req: true },
      { key: 'kf_scopework', label: 'Scope of work', type: 'textarea', req: true },
      { key: 'kf_targetcompletiondate', label: 'Target completion', type: 'date' }
    ]
  }
};

export const STEPS = [
  { id: 'type', label: 'Type' },
  { id: 'client', label: 'Client' },
  { id: 'property', label: 'Property' },
  { id: 'details', label: 'Details' },
  { id: 'terms', label: 'Terms' },
  { id: 'review', label: 'Review' }
];

export const REQUIRED_LABELS = {
  client: { clientName: 'Client name', contactName: 'Primary contact' },
  property: { address: 'Address', city: 'City', postcode: 'Postcode', country: 'Country' },
  terms: { feeBasis: 'Fee basis', currency: 'Currency', assignedTo: 'Assigned to', owningOffice: 'Owning office' }
};

/* Reference service line → the POC's service_line_parent.service_line. Only the
   four names that differ need an entry; everything else passes through. */
const SERVICE_LINE_MAP = {
  'Leasing (Commercial Agency)': 'Leasing',
  'Occupier Strategy & Solutions': 'OSS',
  'Workplace Consulting': 'Workplace',
  'Development Consultancy': 'Development'
};
export function mapServiceLine(line) {
  return SERVICE_LINE_MAP[line] || line;
}

/* ============================================================
   Mock client directory — local fixture of private and corporate
   clients. No client is ever looked up over the network.
   ============================================================ */
export const MOCK_CLIENTS = [
  { country: 'United Kingdom', clientName: 'Thames Quay Estates Ltd', partyType: 'Company',
    contactName: 'Sarah Caldwell', contactEmail: 's.caldwell@thamesquay.co.uk',
    contactPhone: '+44 20 7946 0312', legalEntity: 'Thames Quay Estates Limited' },
  { country: 'United Kingdom', clientName: 'Eleanor Whitfield', partyType: 'Individual',
    contactName: 'Eleanor Whitfield', contactEmail: 'e.whitfield@whitfieldfamily.co.uk',
    contactPhone: '+44 7700 900418', legalEntity: 'Whitfield Family Office Ltd' },
  { country: 'United Kingdom', clientName: 'Blackfriars Asset Management LLP', partyType: 'Company',
    contactName: 'David Ngata', contactEmail: 'd.ngata@blackfriarsam.co.uk',
    contactPhone: '+44 161 496 0277', legalEntity: 'Blackfriars Asset Management LLP' },

  { country: 'Spain', clientName: 'Costa Azul Desarrollos S.L.', partyType: 'Company',
    contactName: 'Marta Vega Ortiz', contactEmail: 'm.vega@costaazul.es',
    contactPhone: '+34 96 583 12 40', legalEntity: 'Costa Azul Desarrollos S.L.' },
  { country: 'Spain', clientName: 'Diego Herrera Salas', partyType: 'Individual',
    contactName: 'Diego Herrera Salas', contactEmail: 'd.herrera@herrerafamilia.es',
    contactPhone: '+34 678 91 23 45', legalEntity: 'Herrera Inversiones Familiares S.L.' },
  { country: 'Spain', clientName: 'Sierra Norte Gestión Inmobiliaria S.L.', partyType: 'Company',
    contactName: 'Carlos Ibáñez', contactEmail: 'c.ibanez@sierranorte.es',
    contactPhone: '+34 91 456 78 90', legalEntity: 'Sierra Norte Gestión Inmobiliaria S.L.' },

  { country: 'France', clientName: 'Haussmann Gestion SAS', partyType: 'Company',
    contactName: 'Antoine Lefèvre', contactEmail: 'a.lefevre@haussmanngestion.fr',
    contactPhone: '+33 1 42 68 53 09', legalEntity: 'Haussmann Gestion SAS' },
  { country: 'France', clientName: 'Camille Moreau Dupont', partyType: 'Individual',
    contactName: 'Camille Moreau Dupont', contactEmail: 'c.moreau@moreau-patrimoine.fr',
    contactPhone: '+33 6 12 34 56 78', legalEntity: 'Moreau Patrimoine SAS' },
  { country: 'France', clientName: 'Loire Valley Capital SAS', partyType: 'Company',
    contactName: 'Nathalie Petit', contactEmail: 'n.petit@loirevalleycapital.fr',
    contactPhone: '+33 4 72 10 45 33', legalEntity: 'Loire Valley Capital SAS' },

  { country: 'Germany', clientName: 'Rheinblick Immobilien GmbH', partyType: 'Company',
    contactName: 'Katrin Vogel', contactEmail: 'k.vogel@rheinblick.de',
    contactPhone: '+49 30 2887 4410', legalEntity: 'Rheinblick Immobilien GmbH' },
  { country: 'Germany', clientName: 'Jonas Lehmann', partyType: 'Individual',
    contactName: 'Jonas Lehmann', contactEmail: 'jonas.lehmann@lehmann-gut.de',
    contactPhone: '+49 151 2345 6789', legalEntity: 'Lehmann Privatvermögen GbR' },
  { country: 'Germany', clientName: 'Elbterra Bau GmbH', partyType: 'Company',
    contactName: 'Markus Reinhardt', contactEmail: 'm.reinhardt@elbterra.de',
    contactPhone: '+49 40 9876 5432', legalEntity: 'Elbterra Bau GmbH' },

  { country: 'Poland', clientName: 'Wisła Development Sp. z o.o.', partyType: 'Company',
    contactName: 'Katarzyna Nowak', contactEmail: 'k.nowak@wisladevelopment.pl',
    contactPhone: '+48 22 123 45 67', legalEntity: 'Wisła Development Sp. z o.o.' },
  { country: 'Poland', clientName: 'Agnieszka Wójcik', partyType: 'Individual',
    contactName: 'Agnieszka Wójcik', contactEmail: 'a.wojcik@onet.pl',
    contactPhone: '+48 501 234 567', legalEntity: 'Wójcik Nieruchomości Sp. z o.o.' },
  { country: 'Poland', clientName: 'Baltic Towers Sp. z o.o.', partyType: 'Company',
    contactName: 'Tomasz Lewandowski', contactEmail: 't.lewandowski@baltictowers.pl',
    contactPhone: '+48 58 765 432 10', legalEntity: 'Baltic Towers Sp. z o.o.' }
];

export const CLIENT_FIELDS = ['clientName', 'partyType', 'contactName', 'contactEmail', 'contactPhone', 'legalEntity'];

export function findMockClients(q) {
  const t = String(q || '').trim().toLowerCase();
  if (t.length < 2) return [];
  return MOCK_CLIENTS.filter((c) =>
    [c.clientName, c.contactName, c.contactEmail, c.legalEntity, c.country]
      .some((v) => String(v).toLowerCase().indexOf(t) >= 0)
  );
}

/* ============================================================
   Mock office directory — owning office linked to a default
   currency and its negotiators. UK → GBP, eurozone (ES/FR/DE)
   → EUR, Poland → PLN. Currency is a default, not fixed.
   ============================================================ */
export const MOCK_OFFICES = [
  { name: 'London',     country: 'United Kingdom', currency: 'GBP', negotiators: ['Alex Johnson', 'Michael Roberts', 'Emma Davies'] },
  { name: 'Manchester', country: 'United Kingdom', currency: 'GBP', negotiators: ['James Wilson', 'Sophie Taylor'] },
  { name: 'Madrid',     country: 'Spain',    currency: 'EUR', negotiators: ['Miguel Fernández', 'Carmen Ruiz', 'Javier Moreno'] },
  { name: 'Barcelona',  country: 'Spain',    currency: 'EUR', negotiators: ['Laura Martínez', 'Pablo García'] },
  { name: 'Paris',      country: 'France',   currency: 'EUR', negotiators: ['Claire Fournier', 'Luc Dubois', 'Émilie Martin'] },
  { name: 'Lyon',       country: 'France',   currency: 'EUR', negotiators: ['Théo Lefèvre', 'Julie Blanc'] },
  { name: 'Berlin',     country: 'Germany',  currency: 'EUR', negotiators: ['Anna Müller', 'Thomas Becker', 'Julia Schmidt'] },
  { name: 'Frankfurt',  country: 'Germany',  currency: 'EUR', negotiators: ['Lukas Wagner', 'Svenja Weber'] },
  { name: 'Warsaw',     country: 'Poland',   currency: 'PLN', negotiators: ['Katarzyna Nowak', 'Piotr Kowalski', 'Anna Wiśniewska'] },
  { name: 'Wrocław',    country: 'Poland',   currency: 'PLN', negotiators: ['Tomasz Mazur', 'Magdalena Jankowska'] }
];

export function getOfficeByName(name) {
  if (!name) return null;
  return MOCK_OFFICES.find((o) => o.name === name) || null;
}

/* Every negotiator across the directory, for the un-filtered end of the link. */
export const ALL_NEGOTIATORS = MOCK_OFFICES.flatMap((o) => o.negotiators);

/* The office a negotiator belongs to — the reverse of the office → staff link. */
export function officeForNegotiator(name) {
  return MOCK_OFFICES.find((o) => o.negotiators.includes(name)) || null;
}
