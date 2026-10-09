<script>
  import { createWip, getInstructions, getFeeSchedules } from '../lib/repo.js';
  import InstructionWizard from './InstructionWizard.svelte';

  let { oncreated = () => {}, onview = () => {}, version = 0 } = $props();

  // The Create tab carries two intents that are really one chain: a relationship
  // record (Instruction) and, under it, the revenue lines (WIP). They are split
  // into modes so the wizard can own the whole width.
  let mode = $state('instruction');

  const instructions = $derived.by(() => {
    void version;
    return getInstructions().filter((i) => i.instruction_status !== 'Withdrawn');
  });
  const feeSchedules = getFeeSchedules();

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

<div class="spread" style="margin-bottom:12px">
  <div class="seg">
    <button class:active={mode === 'instruction'} onclick={() => (mode = 'instruction')}>
      Create an Instruction
    </button>
    <button class:active={mode === 'wip'} onclick={() => (mode = 'wip')}>
      Create a WIP line
    </button>
  </div>
  <p class="faint" style="margin:0;font-size:12px">
    {mode === 'instruction'
      ? 'The relationship record: service line, client and the party that gets invoiced.'
      : 'Revenue and billing lines under an existing instruction.'}
  </p>
</div>

{#if mode === 'instruction'}
  <InstructionWizard {oncreated} {onview} {version} />
{:else}
  <form id="wip-line-form" class="card" onsubmit={submitWip}>
    <h2>Create a WIP line</h2>
    <p class="faint" style="margin:6px 0 12px">
      A revenue or billing line under an Instruction. Leave the classification
      fields alone — PL-2 copies them down from the parent.
    </p>

    {#if wError}<div class="accept-error show"><strong>Rejected.</strong> {wError}</div>{/if}
    {#if wOk}<div class="success-banner show"><strong>{wOk}</strong></div>{/if}

    <div class="form-grid">
      <div class="field span-2">
        <label for="w-instr">Parent Instruction (PL-1) <span class="req">*</span></label>
        <select id="w-instr" bind:value={wip.instruction_id} required>
          <option value="" disabled>Choose…</option>
          {#each instructions as i (i.id)}
            <option value={i.id}>{i.name} · {i.service_line} · {i.client_name}</option>
          {/each}
        </select>
      </div>

      {#if selectedInstruction}
        <div class="span-2 row" style="flex-wrap:wrap">
          <span class="tag">{selectedInstruction.service_line}</span>
          <span class="tag">{selectedInstruction.client_name}</span>
          <span class="tag">{selectedInstruction.office_name}</span>
          <span class="faint">PL-2 will copy these onto the new line.</span>
        </div>
      {/if}

      <div class="field">
        <label for="w-net">Net fee to group</label>
        <input id="w-net" type="number" min="0" step="1000" bind:value={wip.net_fee_to_group}
               placeholder="120000" />
      </div>
      <div class="field">
        <label for="w-retained">Office retained</label>
        <input id="w-retained" type="number" min="0" step="1000" bind:value={wip.office_retained}
               placeholder="24000" />
      </div>
      <div class="field">
        <label for="w-prob">Probability %</label>
        <input id="w-prob" type="number" min="0" max="100" bind:value={wip.probability} />
      </div>
      <div class="field">
        <label for="w-gross">Gross fee</label>
        <input id="w-gross" type="number" min="0" step="1000" bind:value={wip.gross_fee}
               placeholder="120000" />
      </div>
      <div class="field">
        <label for="w-reporting">Reporting month <span class="req">*</span></label>
        <input id="w-reporting" type="month" bind:value={wip.reporting_month} required />
      </div>
      <div class="field">
        <label for="w-completion">Completion month</label>
        <input id="w-completion" type="month" bind:value={wip.completion_month} />
      </div>
      <div class="field">
        <label for="w-currency">Transaction currency</label>
        <select id="w-currency" bind:value={wip.transaction_currency}>
          <option>EUR</option>
          <option>GBP</option>
          <option>USD</option>
        </select>
      </div>
      <div class="field">
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
      <div class="field span-2">
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
{/if}

<style>
  .hint { font-size: 11px; margin: 6px 0 0; }
</style>
