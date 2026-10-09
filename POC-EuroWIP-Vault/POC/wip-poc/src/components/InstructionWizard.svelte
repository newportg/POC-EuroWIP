<script>
  import {
    createInstruction,
    getBrands, getLegalEntities, getOffices, getContacts, getProperties, getServiceLines
  } from '../lib/repo.js';

  let { oncreated = () => {}, onview = () => {}, version = 0 } = $props();

  const offices = getOffices();
  const serviceLines = getServiceLines();
  const brands = getBrands();
  const legalEntities = getLegalEntities();
  const properties = getProperties();
  const contacts = getContacts();

  const STEPS = [
    { id: 'type', label: 'Type' },
    { id: 'client', label: 'Client' },
    { id: 'property', label: 'Property' },
    { id: 'details', label: 'Details' },
    { id: 'terms', label: 'Terms' },
    { id: 'review', label: 'Review' }
  ];

  const today = new Date().toISOString().slice(0, 10);

  let step = $state('type');
  let accepted = $state(false);
  let acceptError = $state('');
  let acceptRef = $state('');
  let frozen = $state(null);

  let form = $state({
    instruction_type: 'Mandate',
    service_line: '',
    client_account_id: '',
    legal_entity_account_id: '',
    primary_contact_id: '',
    property_id: '',
    sector: '',
    signed_date: '',
    comments: '',
    owning_office_id: '',
    negotiator: '',
    expected_revenue: '',
    start_date: today,
    instruction_status: 'Active'
  });

  const stepIndex = $derived(STEPS.findIndex((s) => s.id === step));

  // A legal entity always sits under exactly one Brand/Group parent, so once the
  // brand is chosen the invoice party is a two- or three-item list, not all seven.
  const brandEntities = $derived(
    form.client_account_id
      ? legalEntities.filter((e) => String(e.parent_account_id) === String(form.client_account_id))
      : legalEntities
  );
  // A contact belongs to a single legal entity, so this narrows to the people who
  // actually work for the party being invoiced.
  const entityContacts = $derived(
    form.legal_entity_account_id
      ? contacts.filter((c) => String(c.account_id) === String(form.legal_entity_account_id))
      : []
  );

  const selectedServiceLine = $derived(
    serviceLines.find((s) => s.service_line === form.service_line) ?? null
  );
  const selectedBrand = $derived(brands.find((b) => String(b.id) === String(form.client_account_id)) ?? null);
  const selectedEntity = $derived(legalEntities.find((e) => String(e.id) === String(form.legal_entity_account_id)) ?? null);
  const selectedOffice = $derived(offices.find((o) => String(o.id) === String(form.owning_office_id)) ?? null);
  const selectedProperty = $derived(properties.find((p) => String(p.id) === String(form.property_id)) ?? null);
  const selectedContact = $derived(contacts.find((c) => String(c.id) === String(form.primary_contact_id)) ?? null);

  // Picking the brand can invalidate a previously chosen entity (and its contact).
  $effect(() => {
    if (
      form.legal_entity_account_id &&
      !brandEntities.some((e) => String(e.id) === String(form.legal_entity_account_id))
    ) {
      form.legal_entity_account_id = '';
      form.primary_contact_id = '';
    }
  });
  // The property carries a sector; use it as the default but let it be overridden.
  $effect(() => {
    if (selectedProperty && !form.sector) form.sector = selectedProperty.sector;
  });

  // Only the fields the database insists on are graded. Property and the detail
  // fields are genuinely optional, so they never block acceptance.
  const required = $derived([
    { key: 'service_line', step: 'type', label: 'Service line', ok: !!form.service_line },
    { key: 'client_account_id', step: 'client', label: 'Client brand', ok: !!form.client_account_id },
    { key: 'legal_entity_account_id', step: 'client', label: 'Legal entity', ok: !!form.legal_entity_account_id },
    { key: 'owning_office_id', step: 'terms', label: 'Owning office', ok: !!form.owning_office_id },
    { key: 'start_date', step: 'terms', label: 'Start date', ok: !!form.start_date }
  ]);
  const missing = $derived(required.filter((r) => !r.ok));
  const progress = $derived(required.filter((r) => r.ok).length);

  function goto(id) {
    step = id;
  }
  function chooseServiceLine(line) {
    form.service_line = line;
    if (step === 'type') step = 'client';
  }
  function chooseBrand(event) {
    form.client_account_id = event.currentTarget.value;
  }
  function chooseEntity(event) {
    form.legal_entity_account_id = event.currentTarget.value;
    form.primary_contact_id = '';
  }

  function payload() {
    return {
      name: acceptRef || null,
      type: form.instruction_type,
      serviceLine: form.service_line || null,
      client: selectedBrand?.name ?? null,
      legalEntity: selectedEntity?.name ?? null,
      primaryContact: selectedContact?.name ?? null,
      property: selectedProperty?.name ?? null,
      sector: form.sector || null,
      owningOffice: selectedOffice?.name ?? null,
      negotiator: form.negotiator || null,
      expectedRevenue: Number(form.expected_revenue) || 0,
      startDate: form.start_date || null,
      signedDate: form.signed_date || null,
      status: form.instruction_status,
      comments: form.comments || null
    };
  }

  function accept() {
    acceptError = '';
    if (missing.length) {
      acceptError = `Still missing: ${missing.map((m) => m.label).join(', ')}.`;
      step = missing[0].step;
      return;
    }
    const res = createInstruction({
      instruction_type: form.instruction_type,
      service_line: form.service_line,
      client_account_id: form.client_account_id,
      legal_entity_account_id: form.legal_entity_account_id,
      primary_contact_id: form.primary_contact_id || null,
      property_id: form.property_id || null,
      owning_office_id: form.owning_office_id,
      instruction_status: form.instruction_status,
      start_date: form.start_date,
      signed_date: form.signed_date || null,
      expected_revenue: form.expected_revenue,
      sector: form.sector || null,
      negotiator: form.negotiator || null,
      comments: form.comments || null
    });
    if (!res.ok) {
      acceptError = res.error;
      return;
    }
    acceptRef = res.name;
    accepted = true;
    frozen = { kf_Instruction: payload() };
    oncreated();
  }

  const money = (v) => new Intl.NumberFormat('en-GB').format(Number(v) || 0);
</script>

<div>
  <div class="steps">
    {#each STEPS as s, i (s.id)}
      <button
        class="step-pill"
        class:active={step === s.id}
        class:done={i < stepIndex}
        data-step={s.id}
        onclick={() => goto(s.id)}
      >
        <span class="num">{i + 1}</span>{s.label}
      </button>
    {/each}
  </div>

  {#if accepted}
    <div class="success-banner show">
      <strong>{acceptRef} accepted.</strong>
      <span class="faint">
        The relationship record is complete. Add revenue against it on the WIP tab.
      </span>
    </div>
  {/if}

  <!-- --------------------------------------------------------- type -->
  {#if step === 'type'}
    <div class="card">
      <h2>1 · What are you creating?</h2>
      <p class="faint" style="margin:6px 0 12px">
        Every instruction collapses to one of three core shapes and exactly one
        service line. The service line decides which parent table the record is
        registerable against (PL-1).
      </p>

      <div class="seg" role="group" aria-label="Core shape">
        {#each ['Mandate', 'Engagement', 'Instruction'] as t (t)}
          <button class:active={form.instruction_type === t} onclick={() => (form.instruction_type = t)}>
            {t}
          </button>
        {/each}
      </div>

      <h3 style="margin:16px 0 8px">Service line <span style="color:var(--bad)">*</span></h3>
      <div class="type-grid">
        {#each serviceLines as s (s.id)}
          <button
            class="type-card"
            class:selected={form.service_line === s.service_line}
            data-sl={s.service_line}
            onclick={() => chooseServiceLine(s.service_line)}
          >
            <div class="t-name">{s.service_line}</div>
            <div class="t-badges">
              <span class="tag">{s.table_name}</span>
              <span class="tag rule">{s.ref}</span>
            </div>
          </button>
        {/each}
      </div>
    </div>

  <!-- ------------------------------------------------------- client -->
  {:else if step === 'client'}
    <div class="card">
      <h2>2 · Client</h2>
      <p class="faint" style="margin:6px 0 12px">
        The relationship owner (Brand/Group) is separate from the party that gets
        invoiced (Legal Entity). The database rejects an invoice party that is not
        a Legal Entity (F5).
      </p>

      <div class="form-grid">
        <div class="field">
          <label for="i-brand">Client brand (relationship owner) <span class="req">*</span></label>
          <select id="i-brand" value={form.client_account_id} onchange={chooseBrand}>
            <option value="" disabled>Choose…</option>
            {#each brands as a (a.id)}
              <option value={a.id}>{a.name}</option>
            {/each}
          </select>
        </div>
        <div class="field">
          <label for="i-le">Legal entity (invoice party) <span class="req">*</span></label>
          <select id="i-le" value={form.legal_entity_account_id} onchange={chooseEntity} disabled={!form.client_account_id}>
            <option value="" disabled>Choose…</option>
            {#each brandEntities as a (a.id)}
              <option value={a.id}>{a.name}</option>
            {/each}
          </select>
          <p class="hint">Narrowed to the entities owned by the chosen brand.</p>
        </div>
        <div class="field span-2">
          <label for="i-contact">Primary contact</label>
          <select id="i-contact" bind:value={form.primary_contact_id} disabled={!form.legal_entity_account_id}>
            <option value="">None</option>
            {#each entityContacts as c (c.id)}
              <option value={c.id}>{c.name}</option>
            {/each}
          </select>
          <p class="hint">Contacts are the people registered against the legal entity.</p>
        </div>
      </div>
    </div>

  <!-- ----------------------------------------------------- property -->
  {:else if step === 'property'}
    <div class="card">
      <h2>3 · Property</h2>
      <p class="faint" style="margin:6px 0 12px">
        Optional. Attaching a property records the asset the instruction acts on
        and pre-fills the sector; both live on the instruction, not the WIP line.
      </p>

      <div class="form-grid">
        <div class="field">
          <label for="i-prop">Property</label>
          <select id="i-prop" bind:value={form.property_id}>
            <option value="">None</option>
            {#each properties as p (p.id)}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
        </div>
        <div class="field">
          <label for="i-sector">Sector</label>
          <input id="i-sector" bind:value={form.sector} placeholder="Office" />
          <p class="hint">Defaults from the property; editable.</p>
        </div>
      </div>
    </div>

  <!-- ------------------------------------------------------ details -->
  {:else if step === 'details'}
    <div class="card">
      <h2>4 · Details</h2>
      <p class="faint" style="margin:6px 0 12px">
        Desk notes. The signed date is the moment the mandate, engagement or
        instruction was executed, which is distinct from the start date.
      </p>

      <div class="form-grid">
        <div class="field">
          <label for="i-signed">Signed date</label>
          <input id="i-signed" type="date" bind:value={form.signed_date} />
        </div>
        <div class="field span-2">
          <label for="i-comments">Comments</label>
          <textarea id="i-comments" rows="3" bind:value={form.comments}
                    placeholder="Standard fee arrangement."></textarea>
        </div>
      </div>
    </div>

  <!-- -------------------------------------------------------- terms -->
  {:else if step === 'terms'}
    <div class="card">
      <h2>5 · Terms</h2>
      <p class="faint" style="margin:6px 0 12px">
        Commercial ownership. The owning office sets the VAT rate and the local
        ERP that billing posts to.
      </p>

      <div class="form-grid">
        <div class="field">
          <label for="i-office">Owning office <span class="req">*</span></label>
          <select id="i-office" bind:value={form.owning_office_id}>
            <option value="" disabled>Choose…</option>
            {#each offices as o (o.id)}
              <option value={o.id}>{o.name} · {o.city} ({o.country})</option>
            {/each}
          </select>
          {#if selectedOffice}
            <p class="hint">VAT {selectedOffice.vat_percent}% · {selectedOffice.erp_local_system}</p>
          {/if}
        </div>
        <div class="field">
          <label for="i-start">Start date <span class="req">*</span></label>
          <input id="i-start" type="date" bind:value={form.start_date} />
        </div>
        <div class="field">
          <label for="i-rev">Expected revenue</label>
          <input id="i-rev" type="number" min="0" step="1000" bind:value={form.expected_revenue}
                 placeholder="250000" />
          {#if form.expected_revenue}
            <p class="hint">{money(form.expected_revenue)}</p>
          {/if}
        </div>
        <div class="field">
          <label for="i-neg">Negotiator</label>
          <input id="i-neg" bind:value={form.negotiator} placeholder="Camille Roux" />
        </div>
        <div class="field">
          <label for="i-status">Status</label>
          <select id="i-status" bind:value={form.instruction_status}>
            <option>Active</option>
            <option>On Hold</option>
            <option>Completed</option>
          </select>
        </div>
      </div>
    </div>

  <!-- ------------------------------------------------------- review -->
  {:else}
    <div class="card">
      <h2>6 · Review &amp; accept</h2>
      <p class="faint" style="margin:6px 0 12px">
        Acceptance writes a real row through the same path the app uses, so the
        PL-1 parentage and F5 entity checks run for real.
      </p>

      <div class="readiness">
        {#each required as r (r.key)}
          <div class="readiness-row" class:ok={r.ok} class:missing={!r.ok}>
            <span class="status">{r.ok ? '✓' : '✕'}</span>
            <span class:missing-labels={!r.ok}>{r.label}</span>
            {#if !r.ok}
              <button class="jump" onclick={() => goto(r.step)}>Fix on {r.step} →</button>
            {/if}
          </div>
        {/each}
      </div>

      <div class="review-grid">
        <div class="review-card">
          <h4>Record <button class="edit" onclick={() => goto('type')}>Edit</button></h4>
          <div class="review-row"><span class="k">Shape</span><span class="v">{form.instruction_type}</span></div>
          <div class="review-row"><span class="k">Service line</span><span class="v">{selectedServiceLine?.service_line ?? '—'}</span></div>
          <div class="review-row"><span class="k">Parent table</span><span class="v mono">{selectedServiceLine?.table_name ?? '—'}</span></div>
        </div>

        <div class="review-card">
          <h4>Client <button class="edit" onclick={() => goto('client')}>Edit</button></h4>
          <div class="review-row"><span class="k">Brand</span><span class="v">{selectedBrand?.name ?? '—'}</span></div>
          <div class="review-row"><span class="k">Legal entity</span><span class="v">{selectedEntity?.name ?? '—'}</span></div>
          <div class="review-row"><span class="k">Contact</span><span class="v">{selectedContact?.name ?? '—'}</span></div>
        </div>

        <div class="review-card">
          <h4>Property <button class="edit" onclick={() => goto('property')}>Edit</button></h4>
          <div class="review-row"><span class="k">Property</span><span class="v">{selectedProperty?.name ?? '—'}</span></div>
          <div class="review-row"><span class="k">Sector</span><span class="v">{form.sector || '—'}</span></div>
        </div>

        <div class="review-card">
          <h4>Terms <button class="edit" onclick={() => goto('terms')}>Edit</button></h4>
          <div class="review-row"><span class="k">Owning office</span><span class="v">{selectedOffice?.name ?? '—'}</span></div>
          <div class="review-row"><span class="k">Start date</span><span class="v mono">{form.start_date || '—'}</span></div>
          <div class="review-row"><span class="k">Expected revenue</span><span class="v mono">{money(form.expected_revenue)}</span></div>
          <div class="review-row"><span class="k">Negotiator</span><span class="v">{form.negotiator || '—'}</span></div>
        </div>
      </div>

      {#if acceptError}
        <div class="accept-error show"><strong>Rejected.</strong> {acceptError}</div>
      {/if}

      {#if frozen}
        <h3 style="margin:4px 0 8px">Frozen payload</h3>
        <pre class="json-out">{JSON.stringify(frozen, null, 2)}</pre>
      {/if}
    </div>
  {/if}

  <div class="wizard-nav">
    <button class="ghost" disabled={stepIndex === 0} onclick={() => goto(STEPS[stepIndex - 1].id)}>
      ← Back
    </button>
    {#if step === 'review'}
      <div class="row">
        <span class="faint">{progress}/{required.length} required fields</span>
        <button class="primary" id="accept-btn" disabled={missing.length > 0} onclick={accept}>
          Accept instruction
        </button>
      </div>
    {:else}
      <button class="primary" onclick={() => goto(STEPS[stepIndex + 1].id)}>Next →</button>
    {/if}
  </div>
</div>
