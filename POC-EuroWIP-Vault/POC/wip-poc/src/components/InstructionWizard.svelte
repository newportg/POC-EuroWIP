<script>
  import {
    createInstruction, createWip,
    resolveClientAccounts, resolveContact, resolveOfficeId, resolveProperty
  } from '../lib/repo.js';
  import {
    TYPES, STEPS, REQUIRED_LABELS, mapServiceLine,
    CLIENT_FIELDS, findMockClients, MOCK_OFFICES, getOfficeByName
  } from '../lib/wizardConfig.js';
  import {
    COUNTRY_ISO, loadLoqateKey, saveLoqateKey,
    loqateFind, loqateVerify, mapVerifyMatch, matchIso
  } from '../lib/loqate.js';
  import CountrySelect from './CountrySelect.svelte';

  let { oncreated = () => {}, onview = () => {}, version = 0 } = $props();

  let typeKey = $state('');
  let client = $state({});
  let property = $state({ country: 'United Kingdom' });
  let details = $state({});
  let terms = $state({ currency: '' });

  let step = $state('type');
  let ref = $state(null);
  let wipRef = $state(null);
  let wipError = $state('');
  let accepted = $state(false);
  let payload = $state(null);
  let acceptError = $state('');

  const today = new Date().toISOString().slice(0, 10);
  const type = $derived(typeKey ? TYPES[typeKey] : null);
  const stepIndex = $derived(STEPS.findIndex((s) => s.id === step));

  /* ------------------------------------------------------ completeness */
  function isEmpty(v) {
    return v === undefined || v === null || String(v).trim() === '';
  }

  function missingRequired() {
    const miss = {};
    if (!typeKey) miss.type = ['Instruction type'];
    for (const id of ['client', 'property', 'terms']) {
      const labels = REQUIRED_LABELS[id];
      const m = Object.keys(labels)
        .filter((k) => isEmpty(bucket(id)[k]))
        .map((k) => labels[k]);
      if (m.length) miss[id] = m;
    }
    if (typeKey) {
      const m = [];
      type.fields.forEach((f) => {
        if (!f.req) return;
        if (f.hideIf === 'noMgmt') {
          const mt = details.kf_instructiontype;
          if (!(mt === 'Let & Manage' || mt === 'Full Management')) return;
        }
        if (isEmpty(details[f.key])) m.push(f.label);
      });
      if (m.length) miss.details = m;
    }
    return miss;
  }

  function bucket(id) {
    return id === 'client' ? client : id === 'property' ? property : terms;
  }

  const miss = $derived.by(() => missingRequired());

  function stepComplete(id) {
    if (id === 'type') return !!typeKey;
    if (id === 'details') return !!typeKey && !miss.details;
    if (id === 'review') return Object.keys(miss).length === 0;
    return !miss[id];
  }

  function goTo(id) {
    step = id;
  }
  function selectType(k) {
    if (typeKey !== k) {
      typeKey = k;
      details = {}; // detail fields belong to the previous type
    }
  }

  /* ------------------------------------------------------ client lookup */
  let clientQuery = $state('');
  const clientHint = 'Local directory of 15 private and corporate clients — UK, Spain, France, Germany, Poland. Type 2+ characters, pick one to fill the fields below.';
  let clientStatus = $state(clientHint);
  let clientResults = $state([]);
  let clientError = $state(false);

  let clientTimer = null;
  function onClientLookup() {
    clearTimeout(clientTimer);
    clientTimer = setTimeout(() => {
      const q = clientQuery.trim();
      if (q.length < 2) {
        clientResults = [];
        clientStatus = clientHint;
        clientError = false;
        return;
      }
      const items = findMockClients(q);
      clientResults = items;
      clientError = items.length === 0;
      clientStatus = items.length
        ? `${items.length} ${items.length === 1 ? 'match' : 'matches'} — pick one to fill the form`
        : 'No mock clients match that search.';
    }, 250);
  }

  function pickMockClient(c) {
    CLIENT_FIELDS.forEach((k) => { client[k] = c[k]; });
    clientResults = [];
    clientQuery = c.clientName;
    clientError = false;
    clientStatus = `Filled from mock directory: ${c.clientName} (${c.partyType === 'Individual' ? 'private' : 'corporate'}, ${c.country}).`;
  }

  /* ------------------------------------------------------ Loqate lookup */
  let loqateKey = $state(loadLoqateKey());
  let loqateQuery = $state('');
  let loqateResults = $state([]);
  let loqateBusy = $state(false);
  let loqateStatus = $state('Pick the country below first, then type at least 3 characters — pick a suggestion to verify and fill the fields below (Find + Verify).');
  let loqateBad = $state(false);
  let loqateRaw = $state(null);
  let verified = $state({});

  let loqateTimer = null;
  let loqateReq = 0;

  function currentCountry() {
    return property.country || '';
  }
  function currentIso() {
    return COUNTRY_ISO[currentCountry()];
  }
  function setProperty(key, value, isVerified) {
    property[key] = value === undefined || value === null ? '' : value;
    if (key in verified) verified[key] = !!isVerified;
    else if (isVerified) verified[key] = true;
  }

  function onLoqateInput() {
    clearTimeout(loqateTimer);
    loqateTimer = setTimeout(runLoqateSearch, 400);
  }
  function onCountryChange() {
    if (loqateQuery.trim().length >= 3) runLoqateSearch();
  }

  async function runLoqateSearch() {
    const q = loqateQuery.trim();
    const req = ++loqateReq;
    if (q.length < 3) {
      loqateResults = [];
      loqateBad = false;
      loqateStatus = 'Type at least 3 characters to search.';
      return;
    }
    if (!currentCountry()) {
      loqateResults = [];
      loqateBad = true;
      loqateStatus = 'Choose a country first — with no country, matches can come from anywhere.';
      return;
    }
    const iso = currentIso();
    loqateBusy = true;
    loqateBad = false;
    loqateStatus = `Searching Loqate${iso ? ` (${iso})` : ''}…`;
    try {
      const items = await loqateFind(q, iso, loqateKey);
      if (req !== loqateReq) return;
      loqateBusy = false;
      loqateResults = items;
      if (!items.length) {
        loqateBad = true;
        loqateStatus = 'No addresses found for that search.';
      } else {
        loqateStatus = `${items.length} ${items.length === 1 ? 'match' : 'matches'} — pick one to verify`;
      }
    } catch (e) {
      if (req !== loqateReq) return;
      loqateBusy = false;
      loqateResults = [];
      loqateBad = true;
      loqateStatus = `Search failed: ${e.message}`;
    }
  }

  async function pickLoqate(item) {
    const req = ++loqateReq;
    loqateResults = [];
    loqateBusy = true;
    loqateBad = false;
    loqateStatus = 'Verifying address…';
    try {
      const iso = currentIso();
      const match = await loqateVerify(item, iso, loqateKey);
      if (req !== loqateReq) return;
      const got = matchIso(match);
      if (iso && got && got !== iso) {
        throw new Error(`matched ${match.CountryName || match.Country || got} instead of ${iso}`);
      }
      applyAddress(item, match);
    } catch (e) {
      if (req !== loqateReq) return;
      // Verification unavailable — fill what the search result definitely knows.
      if (item && item.text) setProperty('address', item.text, false);
      loqateRaw = null;
      loqateBusy = false;
      loqateBad = true;
      loqateStatus = `Verify failed (${e.message}) — street line filled from the search result; check city/postcode/country.`;
    }
  }

  function applyAddress(item, match) {
    const mapped = mapVerifyMatch(match);
    if (mapped.address) setProperty('address', mapped.address, true);
    if (mapped.city) setProperty('city', mapped.city, true);
    if (mapped.postcode) setProperty('postcode', mapped.postcode, true);
    if (mapped.country) setProperty('country', mapped.country, true);
    property.loqateId = match.ID || match.Id || (item && item.id) || '';
    loqateRaw = match;
    if (match.Latitude && match.Longitude) {
      property.latitude = match.Latitude;
      property.longitude = match.Longitude;
    }
    loqateBusy = false;
    loqateBad = false;
    loqateStatus = `Verified: ${[mapped.address, mapped.city, mapped.postcode].filter(Boolean).join(', ')}` +
      (!mapped.country && (match.CountryName || match.Country)
        ? ' — matched country is not in the list, set Country manually' : '');
  }

  function saveKey() {
    loqateKey = loqateKey.trim();
    saveLoqateKey(loqateKey);
    loqateBad = !loqateKey;
    loqateStatus = loqateKey ? 'API key saved' : 'API key cleared — lookups will fail';
  }

  /* ------------------------------------------------------ terms */
  let currencyTouched = $state(false);
  const negotiators = $derived(getOfficeByName(terms.owningOffice)?.negotiators ?? []);

  function onOfficeChange(name) {
    terms.owningOffice = name;
    terms.assignedTo = ''; // negotiators belong to the office
    const office = getOfficeByName(name);
    if (office && !currencyTouched) terms.currency = office.currency;
  }

  /* ------------------------------------------------------ details */
  function detailHidden(f) {
    if (f.hideIf === 'noMgmt') {
      const mt = details.kf_instructiontype;
      return !(mt === 'Let & Manage' || mt === 'Full Management');
    }
    return false;
  }
  function onDetailInput(f, value) {
    if (f.key === 'kf_weeklyrent') {
      const w = parseFloat(value);
      if (!Number.isNaN(w) && w > 0) {
        details.kf_monthlyrent = (w * 52 / 12).toFixed(2);
        details.kf_annualrent = (w * 52).toFixed(2);
      } else {
        details.kf_monthlyrent = '';
        details.kf_annualrent = '';
      }
    }
  }

  /* ------------------------------------------------------ accept */
  function buildRecord() {
    const emptyToNull = (v) => (v === undefined || v === '' ? null : v);
    const instruction = {
      kf_name: ref || 'INS-??????',
      kf_instructiontype: type.core,
      kf_serviceline: type.serviceLine,
      kf_clientaccountid: emptyToNull(client.clientName),
      kf_legalentityaccountid: emptyToNull(client.legalEntity || client.clientName),
      kf_primarycontactid: emptyToNull(client.contactName),
      kf_propertyid: emptyToNull(
        [property.address, property.city, property.postcode, property.country].filter(Boolean).join(', ')
      ),
      kf_owningoffice: emptyToNull(terms.owningOffice),
      kf_startdate: emptyToNull(details.kf_instructiondate),
      kf_expectedrevenue: emptyToNull(terms.expectedRevenue)
    };

    const specialised = {};
    type.fields.forEach((f) => {
      if (f.readonly) return;
      const v = details[f.key];
      if (v !== undefined && v !== '') specialised[f.key] = f.type === 'number' ? Number(v) : v;
    });
    if (property.titleNumber) specialised.kf_titlenumber = property.titleNumber;
    if (property.tenure) specialised.kf_tenure = property.tenure;
    if (terms.assignedTo) {
      specialised[type.entity === 'kf_ValuationInstruction' ? 'kf_valuer' : 'kf_negotiator'] = terms.assignedTo;
    }
    if (terms.feeAmount !== undefined && terms.feeAmount !== '') {
      specialised.kf_fee = Number(terms.feeAmount);
      specialised.kf_feebasis = terms.feeBasis;
      specialised.kf_currency = terms.currency;
    }
    if (terms.notes) specialised.kf_notes = terms.notes;

    return { kf_Instruction: instruction, [type.entity]: specialised };
  }

  function accept() {
    acceptError = '';
    const keys = Object.keys(miss);
    if (keys.length) {
      acceptError = 'Missing required information: ' +
        keys.map((k) => `${(STEPS.find((s) => s.id === k) || { label: k }).label}: ${miss[k].join(', ')}`).join('; ');
      return;
    }

    // Resolve the collected names onto the relational model, then write a real
    // instruction so WIP lines can attach to it.
    const accts = resolveClientAccounts({ clientName: client.clientName, legalEntity: client.legalEntity });
    if (!accts.ok) { acceptError = accts.error; return; }

    const contactId = resolveContact({ contactName: client.contactName, accountId: accts.legalEntityId });
    const officeId = resolveOfficeId(getOfficeByName(terms.owningOffice));
    const propertyId = resolveProperty({
      address: property.address, city: property.city, postcode: property.postcode,
      country: property.country, sector: property.propertySector
    });

    const res = createInstruction({
      instruction_type: type.core,
      service_line: mapServiceLine(type.serviceLine),
      client_account_id: accts.brandId,
      legal_entity_account_id: accts.legalEntityId,
      primary_contact_id: contactId,
      property_id: propertyId,
      owning_office_id: officeId,
      instruction_status: 'Active',
      start_date: details.kf_instructiondate || today,
      signed_date: null,
      expected_revenue: terms.expectedRevenue || 0,
      sector: property.propertySector || null,
      negotiator: terms.assignedTo || null,
      comments: terms.notes || null
    });
    if (!res.ok) { acceptError = res.error; return; }
    ref = res.name;

    // Completing the review opens the instruction's first WIP line, so the
    // pipeline is populated the moment a matter is instructed. The financials
    // come from the Terms step: gross = net = expected revenue, with the office
    // retaining 20% (the split the seed fixtures use).
    const revenue = Number(terms.expectedRevenue) || 0;
    const wipRes = createWip({
      instruction_id: res.id,
      net_fee_to_group: revenue,
      office_retained: Math.round(revenue * 0.2 * 100) / 100,
      probability: 100,
      gross_fee: revenue,
      reporting_month: `${today.slice(0, 7)}-01`,
      completion_month: details.kf_targetcompletiondate
        ? `${details.kf_targetcompletiondate.slice(0, 7)}-01`
        : null,
      transaction_currency: terms.currency || 'EUR',
      comments: terms.notes || null
    });
    if (wipRes.ok) wipRef = wipRes.name;
    else wipError = wipRes.error;

    payload = buildRecord(); // frozen snapshot at acceptance
    accepted = true;
    oncreated();
  }

  const money = (v) => (v === undefined || v === '' ? '—' : new Intl.NumberFormat('en-GB').format(Number(v) || 0));
</script>

<div>
  <div class="steps">
    {#each STEPS as s, i (s.id)}
      <button
        class="step-pill"
        class:active={step === s.id}
        class:done={stepComplete(s.id) && step !== s.id}
        data-step={s.id}
        onclick={() => goTo(s.id)}
      >
        <span class="num">{i + 1}</span>{s.label}
      </button>
    {/each}
  </div>

  {#if accepted}
    <div class="success-banner show">
      <strong>{ref} accepted{wipRef ? ` · ${wipRef} opened` : ''}.</strong>
      <span class="faint"> Accepted at Review · written as {type?.entity}{wipRef ? `, with WIP line ${wipRef}` : ''}.</span>
    </div>
  {/if}
  {#if wipError}
    <div class="accept-error show"><strong>WIP line not created.</strong> {wipError}</div>
  {/if}

  <!-- --------------------------------------------------------- type -->
  {#if step === 'type'}
    <div class="card">
      <div class="card-header">
        <div class="card-icon">📋</div>
        <div>
          <h2>What are you instructing?</h2>
          <p>Pick the service line — this selects the entity and drives every later step.</p>
        </div>
      </div>
      <div class="type-grid">
        {#each Object.entries(TYPES) as [k, t] (k)}
          <button class="type-card" class:selected={typeKey === k} data-type={k} onclick={() => selectType(k)}>
            <div class="t-icon">{t.icon}</div>
            <div class="t-name">{t.name}</div>
            <div class="t-desc">{t.desc}</div>
            <div class="t-badges">
              <span class="badge badge-core">{t.core}</span>
              <span class="badge badge-entity">{t.entity}</span>
            </div>
          </button>
        {/each}
      </div>
      <p class="hint">
        Each instruction links one-to-one to exactly one service-line record, chosen by
        <span class="mono">kf_serviceline</span>.
      </p>
    </div>

  <!-- ------------------------------------------------------- client -->
  {:else if step === 'client'}
    <div class="card">
      <div class="card-header">
        <div class="card-icon">👤</div>
        <div>
          <h2>Who is instructing?{type ? ` (${type.role})` : ''}</h2>
          <p>The party giving the instruction and their contact.</p>
        </div>
      </div>

      <div class="loqate-row">
        <input type="text" id="clientLookup" autocomplete="off" bind:value={clientQuery}
               oninput={onClientLookup}
               placeholder="Search mock clients by name, contact or country, e.g. Whitfield" />
        <span class="badge badge-poc">MOCK DATA</span>
      </div>
      <div class="loqate-status" class:error={clientError}>{clientStatus}</div>
      {#if clientResults.length}
        <ul class="loqate-results" id="clientLookupResults">
          {#each clientResults as c (c.clientName)}
            <li>
              <button type="button" class="loqate-result" onclick={() => pickMockClient(c)}>
                <span class="lr-text">{c.clientName}</span>
                <span class="lr-desc">
                  {c.partyType === 'Individual' ? 'Private client' : 'Corporate client'} · {c.country} ·
                  {c.contactName} · {c.contactEmail}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}

      <div class="form-grid">
        <div class="field">
          <label for="clientName">Client name <span class="req">*</span></label>
          <input type="text" id="clientName" data-key="clientName" bind:value={client.clientName}
                 placeholder="e.g. Blackstone Real Estate Partners IX L.P." />
          <div class="err">Client name is required</div>
        </div>
        <div class="field">
          <label for="partyType">Party type</label>
          <select id="partyType" data-key="partyType" bind:value={client.partyType}>
            <option value="Individual">Individual</option>
            <option value="Company">Company</option>
            <option value="Trust">Trust</option>
          </select>
        </div>
        <div class="field">
          <label for="contactName">Primary contact <span class="req">*</span></label>
          <input type="text" id="contactName" data-key="contactName" bind:value={client.contactName}
                 placeholder="e.g. Jane Doe" />
          <div class="err">Primary contact is required</div>
        </div>
        <div class="field">
          <label for="contactEmail">Contact email</label>
          <input type="email" id="contactEmail" data-key="contactEmail" bind:value={client.contactEmail}
                 placeholder="jane@example.com" />
        </div>
        <div class="field">
          <label for="contactPhone">Contact phone</label>
          <input type="tel" id="contactPhone" data-key="contactPhone" bind:value={client.contactPhone}
                 placeholder="+33 1 23 45 67 89" />
        </div>
        <div class="field">
          <label for="legalEntity">Invoicing legal entity <span class="badge badge-poc">if different</span></label>
          <input type="text" id="legalEntity" data-key="legalEntity" bind:value={client.legalEntity}
                 placeholder="e.g. Blackstone SPA France" />
        </div>
      </div>
    </div>

  <!-- ----------------------------------------------------- property -->
  {:else if step === 'property'}
    <div class="card">
      <div class="card-header">
        <div class="card-icon">🏠</div>
        <div>
          <h2>Which property?</h2>
          <p>The subject property of the instruction.</p>
        </div>
      </div>

      <div class="loqate-box">
        <div class="loqate-head">
          <label for="loqateQuery">Address search</label>
          <span class="badge badge-loqate">LOQATE</span>
        </div>
        <div class="loqate-row">
          <CountrySelect
            value={property.country}
            onchange={(c) => { property.country = c; onCountryChange(); }}
          />
          <input type="text" id="loqateQuery" autocomplete="off" bind:value={loqateQuery}
                 oninput={onLoqateInput}
                 placeholder="Postcode or street address, e.g. EC2M 7NH" />
        </div>
        <div class="loqate-status" class:error={loqateBad}>{loqateStatus}</div>
        {#if loqateResults.length}
          <ul class="loqate-results" id="loqateResults">
            {#each loqateResults as item (item.id)}
              <li>
                <button type="button" class="loqate-result" onclick={() => pickLoqate(item)}>
                  <span class="lr-text">{item.text}</span>
                  <span class="lr-desc">{item.description || ''}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
        <details class="loqate-key">
          <summary>API key</summary>
          <div class="loqate-row">
            <input type="text" id="loqateKey" bind:value={loqateKey} placeholder="Loqate API key" />
            <button type="button" onclick={saveKey}>Save</button>
          </div>
        </details>
        <details class="loqate-key">
          <summary>Verify response (raw)</summary>
          <pre class="loqate-raw">{loqateRaw ? JSON.stringify(loqateRaw, null, 2) : 'No verification yet.'}</pre>
        </details>
      </div>

      <div class="form-grid">
        <div class="field span-2" class:verified-fill={verified.address}>
          <label for="address">Address <span class="req">*</span></label>
          <input type="text" id="address" data-key="address" bind:value={property.address}
                 oninput={() => (verified.address = false)} placeholder="e.g. 1 Liverpool Street" />
          <div class="err">Address is required</div>
        </div>
        <div class="field" class:verified-fill={verified.city}>
          <label for="city">City / locality <span class="req">*</span></label>
          <input type="text" id="city" data-key="city" bind:value={property.city}
                 oninput={() => (verified.city = false)} placeholder="e.g. London" />
          <div class="err">City is required</div>
        </div>
        <div class="field" class:verified-fill={verified.postcode}>
          <label for="postcode">Postcode <span class="req">*</span></label>
          <input type="text" id="postcode" data-key="postcode" bind:value={property.postcode}
                 oninput={() => (verified.postcode = false)} placeholder="e.g. EC2M 7NH" />
          <div class="err">Postcode is required</div>
        </div>
        <div class="field">
          <label for="titleNumber">Title number</label>
          <input type="text" id="titleNumber" data-key="titleNumber" bind:value={property.titleNumber}
                 placeholder="e.g. MX482917" />
        </div>
        <div class="field">
          <label for="tenure">Tenure</label>
          <select id="tenure" data-key="tenure" bind:value={property.tenure}>
            <option>Freehold</option>
            <option>Leasehold</option>
          </select>
        </div>
        {#if property.tenure === 'Leasehold'}
          <div class="field">
            <label for="leaseTerm">Lease term</label>
            <input type="text" id="leaseTerm" data-key="leaseTerm" bind:value={property.leaseTerm}
                   placeholder="e.g. 125 years from 2010" />
          </div>
        {/if}
        <div class="field">
          <label for="propertySector">Sector</label>
          <select id="propertySector" data-key="propertySector" bind:value={property.propertySector}>
            <option>Office</option>
            <option>Retail</option>
            <option>Industrial</option>
            <option>Logistics</option>
            <option>Residential</option>
            <option>Land</option>
            <option>Other</option>
          </select>
        </div>
      </div>
    </div>

  <!-- ------------------------------------------------------ details -->
  {:else if step === 'details'}
    <div class="card">
      <div class="card-header">
        <div class="card-icon">📝</div>
        <div>
          <h2>{type ? `${type.name} — details` : 'Instruction details'}</h2>
          <p>{type ? `${type.entity} · ${type.serviceLine}. Only fields for this type are shown.` : 'Fields specific to the selected instruction type.'}</p>
        </div>
      </div>

      {#if !type}
        <p class="faint">Choose an instruction type on Step 1 to see its fields.</p>
      {:else}
        <div class="form-grid">
          {#each type.fields as f (f.key)}
            {#if !detailHidden(f)}
              <div class="field" class:span-2={f.type === 'textarea'}>
                <label for={`d-${f.key}`}>
                  {f.label}{#if f.req}<span class="req"> *</span>{/if}
                </label>
                {#if f.type === 'select'}
                  <select id={`d-${f.key}`} data-key={f.key} bind:value={details[f.key]}>
                    <option value="">Select…</option>
                    {#each f.opts as o (o)}<option>{o}</option>{/each}
                  </select>
                {:else if f.type === 'textarea'}
                  <textarea id={`d-${f.key}`} data-key={f.key} bind:value={details[f.key]} oninput={(e) => onDetailInput(f, e.currentTarget.value)}></textarea>
                {:else if f.type === 'number'}
                  <input id={`d-${f.key}`} type="number" step="0.01" data-key={f.key}
                         readonly={f.readonly} bind:value={details[f.key]}
                         oninput={(e) => onDetailInput(f, e.currentTarget.value)} />
                {:else}
                  <input id={`d-${f.key}`} type={f.type === 'date' ? 'date' : 'text'} data-key={f.key}
                         bind:value={details[f.key]} />
                {/if}
                {#if f.suffix}<div class="hint">in {f.suffix}</div>{/if}
                {#if f.hint}<div class="hint">{f.hint}</div>{/if}
                <div class="err">{f.label} is required</div>
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>

  <!-- -------------------------------------------------------- terms -->
  {:else if step === 'terms'}
    <div class="card">
      <div class="card-header">
        <div class="card-icon">💼</div>
        <div>
          <h2>Commercial terms &amp; assignment</h2>
          <p>Fees, currency, and who handles the instruction.</p>
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label for="feeBasis">Fee basis <span class="req">*</span></label>
          <select id="feeBasis" data-key="feeBasis" bind:value={terms.feeBasis}>
            <option value="">Select…</option>
            <option>Fixed fee</option>
            <option>Hourly rate</option>
            <option>Percentage</option>
          </select>
          <div class="err">Fee basis is required</div>
        </div>
        <div class="field">
          <label for="feeAmount">Fee amount</label>
          <input type="number" id="feeAmount" data-key="feeAmount" step="0.01" min="0"
                 bind:value={terms.feeAmount} placeholder="e.g. 15000" />
        </div>
        <div class="field">
          <label for="currency">Currency <span class="req">*</span></label>
          <select id="currency" data-key="currency" bind:value={terms.currency}
                  onchange={() => (currencyTouched = true)}>
            <option value="">Select…</option>
            <option>EUR</option>
            <option>GBP</option>
            <option>USD</option>
            <option>PLN</option>
          </select>
          <div class="err">Currency is required</div>
          {#if getOfficeByName(terms.owningOffice) && !currencyTouched}
            <p class="hint">Defaulted from {terms.owningOffice}; editable.</p>
          {/if}
        </div>
        <div class="field">
          <label for="expectedRevenue">Expected revenue</label>
          <input type="number" id="expectedRevenue" data-key="expectedRevenue" step="0.01" min="0"
                 bind:value={terms.expectedRevenue} placeholder="e.g. 42000" />
          {#if terms.expectedRevenue}<p class="hint">{money(terms.expectedRevenue)}</p>{/if}
        </div>
        <div class="field">
          <label for="assignedTo">Assigned to <span class="req">*</span></label>
          <select id="assignedTo" data-key="assignedTo" bind:value={terms.assignedTo}
                  disabled={!terms.owningOffice}>
            <option value="">{terms.owningOffice ? 'Select negotiator…' : 'Select owning office first…'}</option>
            {#each negotiators as n (n)}<option>{n}</option>{/each}
          </select>
          <div class="err">Assigned handler is required</div>
        </div>
        <div class="field">
          <label for="owningOffice">Owning office <span class="req">*</span></label>
          <select id="owningOffice" data-key="owningOffice" bind:value={terms.owningOffice}
                  onchange={(e) => onOfficeChange(e.currentTarget.value)}>
            <option value="">Select…</option>
            {#each MOCK_OFFICES as o (o.name)}<option value={o.name}>{o.name} ({o.country})</option>{/each}
          </select>
          <div class="err">Owning office is required</div>
        </div>
        <div class="field span-2">
          <label for="notes">Notes</label>
          <textarea id="notes" data-key="notes" bind:value={terms.notes}
                    placeholder="Anything exceptional about this matter"></textarea>
        </div>
      </div>
    </div>

  <!-- ------------------------------------------------------- review -->
  {:else}
    <div class="card">
      <div class="card-header">
        <div class="card-icon">✅</div>
        <div>
          <h2>Review</h2>
          <p>Check the instruction. You can go back to any step — acceptance happens here only.</p>
        </div>
      </div>

      <div class="readiness">
        {#each STEPS.slice(0, 5) as s (s.id)}
          {#if s.id === 'details' && !typeKey}
            <div class="readiness-row missing">
              <span class="status">✗</span><span>Details: <span class="missing-labels">instruction type not selected</span></span>
              <button class="jump" onclick={() => goTo('type')}>go to step 1</button>
            </div>
          {:else if miss[s.id]}
            <div class="readiness-row missing">
              <span class="status">✗</span>
              <span>{s.label}: <span class="missing-labels">{miss[s.id].join(', ')}</span></span>
              <button class="jump" onclick={() => goTo(s.id)}>go to step</button>
            </div>
          {:else}
            <div class="readiness-row ok">
              <span class="status">✓</span><span>{s.label} — complete</span>
            </div>
          {/if}
        {/each}
      </div>

      {#if acceptError}
        <div class="accept-error show"><strong>Cannot accept yet.</strong> {acceptError}</div>
      {/if}

      {#if type}
        <div class="review-grid">
          <div class="review-card">
            <h4>Type <button class="edit" onclick={() => goTo('type')}>edit</button></h4>
            <div class="review-row"><span class="k">Core</span><span class="v">{type.core}</span></div>
            <div class="review-row"><span class="k">Service line</span><span class="v">{type.serviceLine}</span></div>
            <div class="review-row"><span class="k">Entity</span><span class="v mono">{type.entity}</span></div>
          </div>
          <div class="review-card">
            <h4>{type.role} <button class="edit" onclick={() => goTo('client')}>edit</button></h4>
            <div class="review-row"><span class="k">Client</span><span class="v">{client.clientName ?? '—'}</span></div>
            <div class="review-row"><span class="k">Party type</span><span class="v">{client.partyType ?? '—'}</span></div>
            <div class="review-row"><span class="k">Contact</span><span class="v">{client.contactName ?? '—'}</span></div>
            <div class="review-row"><span class="k">Invoicing entity</span><span class="v">{client.legalEntity || client.clientName || '—'}</span></div>
          </div>
          <div class="review-card">
            <h4>Property <button class="edit" onclick={() => goTo('property')}>edit</button></h4>
            <div class="review-row"><span class="k">Address</span><span class="v">{property.address ?? '—'}</span></div>
            <div class="review-row"><span class="k">City</span><span class="v">{property.city ?? '—'}</span></div>
            <div class="review-row"><span class="k">Postcode</span><span class="v">{property.postcode ?? '—'}</span></div>
            <div class="review-row"><span class="k">Country</span><span class="v">{property.country ?? '—'}</span></div>
            <div class="review-row"><span class="k">Tenure</span><span class="v">{property.tenure ?? '—'}</span></div>
            <div class="review-row"><span class="k">Sector</span><span class="v">{property.propertySector ?? '—'}</span></div>
          </div>
          <div class="review-card">
            <h4>Details <button class="edit" onclick={() => goTo('details')}>edit</button></h4>
            {#each type.fields as f (f.key)}
              {#if !detailHidden(f) && details[f.key] !== undefined && details[f.key] !== ''}
                <div class="review-row"><span class="k">{f.label}</span><span class="v">{details[f.key]}</span></div>
              {/if}
            {/each}
          </div>
          <div class="review-card">
            <h4>Terms <button class="edit" onclick={() => goTo('terms')}>edit</button></h4>
            <div class="review-row"><span class="k">Fee basis</span><span class="v">{terms.feeBasis ?? '—'}</span></div>
            <div class="review-row"><span class="k">Fee amount</span><span class="v">{money(terms.feeAmount)}</span></div>
            <div class="review-row"><span class="k">Currency</span><span class="v">{terms.currency || '—'}</span></div>
            <div class="review-row"><span class="k">Expected revenue</span><span class="v">{money(terms.expectedRevenue)}</span></div>
            <div class="review-row"><span class="k">Assigned to</span><span class="v">{terms.assignedTo ?? '—'}</span></div>
            <div class="review-row"><span class="k">Owning office</span><span class="v">{terms.owningOffice ?? '—'}</span></div>
            <div class="review-row"><span class="k">Notes</span><span class="v">{terms.notes ?? '—'}</span></div>
          </div>
        </div>
      {/if}

      {#if accepted && payload}
        <h3 style="margin:4px 0 8px">Accepted record</h3>
        <pre class="json-out">{JSON.stringify(payload, null, 2)}</pre>
      {/if}
    </div>
  {/if}

  <div class="wizard-nav">
    <button class="ghost" disabled={stepIndex === 0} onclick={() => goTo(STEPS[stepIndex - 1].id)}>← Back</button>
    {#if step === 'review'}
      <div class="row">
        <span class="faint">{5 - Object.keys(miss).length}/5 steps complete</span>
        <button class="primary" id="acceptBtn" disabled={Object.keys(miss).length > 0} onclick={accept}>
          Accept instruction
        </button>
      </div>
    {:else}
      <button class="primary" onclick={() => goTo(STEPS[stepIndex + 1].id)}>
        {step === 'terms' ? 'Review' : 'Next'} →
      </button>
    {/if}
  </div>
</div>
