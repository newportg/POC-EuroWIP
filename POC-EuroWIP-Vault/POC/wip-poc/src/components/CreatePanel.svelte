<script>
  import {
    createInstruction, createWip,
    getBrands, getLegalEntities, getOffices, getProperties, getContacts,
    getServiceLines, getInstructions, getFeeSchedules
  } from '../lib/repo.js';

  let { oncreated = () => {}, onview = () => {}, version = 0 } = $props();

  const offices = getOffices();
  const serviceLines = getServiceLines();
  const brands = getBrands();
  const legalEntities = getLegalEntities();
  const properties = getProperties();
  const contacts = getContacts();
  const feeSchedules = getFeeSchedules();

  // ------------------------------------------------------------- step 1
  let iError = $state('');
  let iOk = $state('');
  let instruction = $state({
    instruction_type: 'Mandate',
    service_line: '',
    client_account_id: '',
    legal_entity_account_id: '',
    primary_contact_id: '',
    property_id: '',
    owning_office_id: '',
    instruction_status: 'Active',
    start_date: new Date().toISOString().slice(0, 10),
    signed_date: '',
    expected_revenue: '',
    sector: '',
    negotiator: '',
    comments: ''
  });

  // The service line drives which legal entity is plausible, so preselect the
  // first one rather than leaving an unfiltered choice.
  $effect(() => {
    if (!instruction.service_line) return;
    const first = legalEntities[0];
    if (first && !legalEntities.some((e) => String(e.id) === String(instruction.legal_entity_account_id))) {
      instruction.legal_entity_account_id = String(first.id);
    }
  });

  function submitInstruction(ev) {
    ev.preventDefault();
    iError = '';
    iOk = '';
    const res = createInstruction({
      ...instruction,
      primary_contact_id: instruction.primary_contact_id || null,
      property_id: instruction.property_id || null,
      signed_date: instruction.signed_date || null,
      sector: instruction.sector || null,
      negotiator: instruction.negotiator || null,
      comments: instruction.comments || null
    });
    if (!res.ok) {
      iError = res.error;
      return;
    }
    iOk = `Created ${res.name}.`;
    instruction = {
      ...instruction,
      expected_revenue: '',
      sector: '',
      negotiator: '',
      comments: ''
    };
    wip.instruction_id = String(res.id);
    oncreated();
  }

  // ------------------------------------------------------------- step 2
  // The repo reads a module-level database, which is not a reactive dependency.
  // Without naming `version` here, this would compute once and cache forever,
  // and a just-created instruction would never appear as a WIP parent.
  const instructions = $derived.by(() => {
    void version;
    return getInstructions().filter((i) => i.instruction_status !== 'Withdrawn');
  });
  const selectedInstruction = $derived(
    instructions.find((i) => String(i.id) === String(wip.instruction_id)) ?? null
  );
  // A fee schedule belongs to a specific Instruction, and is Capital Markets
  // only, so the options are narrowed to the selected parent.
  const eligibleFeeSchedules = $derived(
    selectedInstruction?.service_line === 'Capital Markets'
      ? feeSchedules.filter((f) => f.instruction_id === selectedInstruction.id)
      : []
  );

  let wError = $state('');
  let wOk = $state('');
  let wip = $state({
    instruction_id: '',
    net_fee_to_group: '',
    office_retained: '',
    probability: '25',
    gross_fee: '',
    reporting_month: firstOfCurrentMonth(),
    completion_month: '',
    transaction_currency: 'EUR',
    comments: ''
  });

  function firstOfCurrentMonth() {
    const d = new Date();
    d.setUTCDate(1);
    return d.toISOString().slice(0, 7);
  }

  function submitWip(ev) {
    ev.preventDefault();
    wError = '';
    wOk = '';
    const res = createWip({
      ...wip,
      instruction_id: wip.instruction_id ? Number(wip.instruction_id) : null,
      fee_schedule_id: wip.fee_schedule_id ?? null,
      // <input type="month"> gives YYYY-MM; the columns store the first of the
      // month as YYYY-MM-01, which is what makes completion_month + 30 days
      // work for the stale rule.
      reporting_month: `${wip.reporting_month}-01`,
      completion_month: wip.completion_month ? `${wip.completion_month}-01` : null,
      comments: wip.comments || null
    });
    if (!res.ok) {
      wError = res.error;
      return;
    }
    wOk = `Created ${res.name} under ${selectedInstruction?.name}.`;
    wip = { ...wip, net_fee_to_group: '', office_retained: '', gross_fee: '', comments: '' };
    oncreated();
    onview(res.name);
  }

  const money = (v) => (v === '' ? '0' : v);
</script>

<div class="cols">
  <!-- -------------------------------------------------- 1. Instruction -->
  <form class="card" onsubmit={submitInstruction}>
    <div class="step">1</div>
    <h2>Create an Instruction</h2>
    <p class="faint hint">
      The relationship record. It owns the service line, the client and the
      legal entity, and it is the only route to a WIP line.
    </p>

    {#if iError}<p class="error">{iError}</p>{/if}
    {#if iOk}<p class="ok">{iOk}</p>{/if}

    <div class="fields">
      <div>
        <label for="i-type">Type</label>
        <select id="i-type" bind:value={instruction.instruction_type}>
          <option>Mandate</option>
          <option>Engagement</option>
          <option>Instruction</option>
        </select>
      </div>
      <div>
        <label for="i-sl">Service line</label>
        <select id="i-sl" bind:value={instruction.service_line} required>
          <option value="" disabled>Choose…</option>
          {#each serviceLines as s (s.id)}
            <option value={s.service_line}>{s.service_line}</option>
          {/each}
        </select>
      </div>
      <div>
        <label for="i-brand">Client brand (relationship owner)</label>
        <select id="i-brand" bind:value={instruction.client_account_id} required>
          <option value="" disabled>Choose…</option>
          {#each brands as a (a.id)}
            <option value={a.id}>{a.name}</option>
          {/each}
        </select>
      </div>
      <div>
        <label for="i-le">Legal entity (invoice party)</label>
        <select id="i-le" bind:value={instruction.legal_entity_account_id} required>
          <option value="" disabled>Choose…</option>
          {#each legalEntities as a (a.id)}
            <option value={a.id}>{a.name}</option>
          {/each}
        </select>
      </div>
      <div>
        <label for="i-office">Owning office</label>
        <select id="i-office" bind:value={instruction.owning_office_id} required>
          <option value="" disabled>Choose…</option>
          {#each offices as o (o.id)}
            <option value={o.id}>{o.name} · {o.city}</option>
          {/each}
        </select>
      </div>
      <div>
        <label for="i-status">Status</label>
        <select id="i-status" bind:value={instruction.instruction_status}>
          <option>Active</option>
          <option>On Hold</option>
          <option>Completed</option>
        </select>
      </div>
      <div>
        <label for="i-start">Start date</label>
        <input id="i-start" type="date" bind:value={instruction.start_date} required />
      </div>
      <div>
        <label for="i-signed">Signed date</label>
        <input id="i-signed" type="date" bind:value={instruction.signed_date} />
      </div>
      <div>
        <label for="i-contact">Primary contact</label>
        <select id="i-contact" bind:value={instruction.primary_contact_id}>
          <option value="">None</option>
          {#each contacts as c (c.id)}
            <option value={c.id}>{c.name}</option>
          {/each}
        </select>
      </div>
      <div>
        <label for="i-prop">Property</label>
        <select id="i-prop" bind:value={instruction.property_id}>
          <option value="">None</option>
          {#each properties as p (p.id)}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
      </div>
      <div>
        <label for="i-sector">Sector</label>
        <input id="i-sector" bind:value={instruction.sector} placeholder="Office" />
      </div>
      <div>
        <label for="i-neg">Negotiator</label>
        <input id="i-neg" bind:value={instruction.negotiator} placeholder="Camille Roux" />
      </div>
      <div class="wide">
        <label for="i-rev">Expected revenue</label>
        <input id="i-rev" type="number" min="0" step="1000" bind:value={instruction.expected_revenue}
               placeholder="250000" />
      </div>
      <div class="wide">
        <label for="i-comments">Comments</label>
        <input id="i-comments" bind:value={instruction.comments} placeholder="Standard fee arrangement." />
      </div>
    </div>

    <button class="primary" type="submit" style="margin-top:12px">Create instruction</button>
    <p class="faint hint" style="margin:8px 0 0">
      PL-1 requires exactly one service-line parent, and it must match the
      service line. The reference is generated as <span class="mono">INS-{'{'}000000{'}'}</span>.
    </p>
  </form>

  <!-- ----------------------------------------------------- 2. WIP line -->
  <form class="card" onsubmit={submitWip}>
    <div class="step">2</div>
    <h2>Create a WIP line</h2>
    <p class="faint hint">
      A revenue or billing line under an Instruction. Leave the classification
      fields alone — PL-2 copies them down from the parent.
    </p>

    {#if wError}<p class="error">{wError}</p>{/if}
    {#if wOk}<p class="ok">{wOk}</p>{/if}

    <div class="fields">
      <div class="wide">
        <label for="w-instr">Parent Instruction (PL-1)</label>
        <select id="w-instr" bind:value={wip.instruction_id} required>
          <option value="" disabled>Choose…</option>
          {#each instructions as i (i.id)}
            <option value={i.id}>{i.name} · {i.service_line} · {i.client_name}</option>
          {/each}
        </select>
      </div>

      {#if selectedInstruction}
        <div class="wide parent-strip">
          <span class="tag">{selectedInstruction.service_line}</span>
          <span class="tag">{selectedInstruction.client_name}</span>
          <span class="tag">{selectedInstruction.office_name}</span>
          <span class="faint">PL-2 will copy these onto the new line.</span>
        </div>
      {/if}

      <div>
        <label for="w-net">Net fee to group</label>
        <input id="w-net" type="number" min="0" step="1000" bind:value={wip.net_fee_to_group}
               placeholder="120000" />
      </div>
      <div>
        <label for="w-retained">Office retained</label>
        <input id="w-retained" type="number" min="0" step="1000" bind:value={wip.office_retained}
               placeholder="24000" />
      </div>
      <div>
        <label for="w-prob">Probability %</label>
        <input id="w-prob" type="number" min="0" max="100" bind:value={wip.probability} />
      </div>
      <div>
        <label for="w-gross">Gross fee</label>
        <input id="w-gross" type="number" min="0" step="1000" bind:value={wip.gross_fee}
               placeholder="120000" />
      </div>
      <div>
        <label for="w-reporting">Reporting month</label>
        <input id="w-reporting" type="month" bind:value={wip.reporting_month} required />
      </div>
      <div>
        <label for="w-completion">Completion month</label>
        <input id="w-completion" type="month" bind:value={wip.completion_month} />
      </div>
      <div>
        <label for="w-currency">Transaction currency</label>
        <select id="w-currency" bind:value={wip.transaction_currency}>
          <option>EUR</option>
          <option>GBP</option>
          <option>USD</option>
        </select>
      </div>
      <div>
        <label for="w-fs">Fee schedule</label>
        <select id="w-fs" bind:value={wip.fee_schedule_id} disabled={!eligibleFeeSchedules.length}>
          <option value={null}>
            {eligibleFeeSchedules.length ? 'None' : 'Capital Markets only'}
          </option>
          {#each eligibleFeeSchedules as f (f.id)}
            <option value={f.id}>{f.name} · {money(f.fee_amount)}</option>
          {/each}
        </select>
      </div>
      <div class="wide">
        <label for="w-comments">Comments</label>
        <input id="w-comments" bind:value={wip.comments} placeholder="Phase 1 valuation work." />
      </div>
    </div>

    <div class="row" style="margin-top:12px">
      <button class="primary" type="submit">Create WIP line</button>
      {#if selectedInstruction && wip.office_retained !== '' && wip.probability !== ''}
        <span class="faint hint" style="margin:0">
          weighted ≈
          {new Intl.NumberFormat('en-GB').format(
            (Number(wip.office_retained) || 0) * (Number(wip.probability) || 0) / 100
          )}
        </span>
      {/if}
    </div>
    <p class="faint hint" style="margin:8px 0 0">
      The reference is generated as <span class="mono">WIP-{'{'}000000{'}'}</span>, and the weighted
      value is a stored generated column, so it cannot drift from its inputs.
    </p>
  </form>
</div>

<style>
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
  .step {
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border-radius: 999px;
    background: var(--accent-soft); color: #79b0ff;
    font-size: 12px; font-weight: 700; margin-bottom: 8px;
  }
  .fields {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 12px; margin-top: 12px;
  }
  .wide { grid-column: 1 / -1; }
  .parent-strip { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .hint { font-size: 11px; margin: 6px 0 0; }
  .error {
    margin: 10px 0 0; padding: 8px 10px; background: #2d1618;
    border: 1px solid #4a2626; border-radius: 7px; color: #ffb4ae; font-size: 12px;
  }
  .ok {
    margin: 10px 0 0; padding: 8px 10px; background: #12321c;
    border: 1px solid #1d4a2b; border-radius: 7px; color: #7ee787; font-size: 12px;
  }
  @media (max-width: 1100px) { .cols { grid-template-columns: 1fr; } }
</style>
