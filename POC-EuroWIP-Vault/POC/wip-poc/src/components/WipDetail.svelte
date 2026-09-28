<script>
  import { changeStatus, updateProbability } from '../lib/repo.js';

  let { line = null, onclose, onchanged } = $props();

  let error = $state('');
  let okMsg = $state('');
  let invoice = $state({ invoice_number: '', invoice_due_date: '', date_paid_in_full: '', erp_local_system_ref: '' });
  let newProbability = $state(null);

  $effect(() => {
    if (!line) return;
    error = '';
    okMsg = '';
    newProbability = line.probability;
    invoice = {
      invoice_number: line.invoice_number ?? '',
      invoice_due_date: line.invoice_due_date ?? '',
      date_paid_in_full: line.date_paid_in_full ?? '',
      erp_local_system_ref: line.erp_local_system_ref ?? ''
    };
  });

  const fmt = (n) =>
    n == null ? '—' : new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(n);

  function move(next) {
    error = '';
    okMsg = '';
    const res = changeStatus(line.id, next, invoice);
    if (!res.ok) {
      error = res.error;
      return;
    }
    okMsg = `Moved to ${next}.`;
    onchanged();
  }

  function saveProbability() {
    error = '';
    okMsg = '';
    const res = updateProbability(line.id, Number(newProbability));
    if (!res.ok) {
      error = res.error;
      newProbability = line.probability;
      return;
    }
    okMsg = 'Probability updated.';
    onchanged();
  }
</script>

{#if line}
  <div class="card detail">
    <div class="spread">
      <div>
        <h2 class="mono">{line.name}</h2>
        <div class="faint" style="font-size:11px">
          {line.parent_type} → <span class="mono">{line.instruction_name}</span>
        </div>
      </div>
      <button class="ghost" onclick={onclose}>Close</button>
    </div>

    <div class="facts">
      <div><span class="lbl">Status</span><span class="pill {line.wip_status}">{line.wip_status}</span></div>
      <div><span class="lbl">Brand / Group</span>{line.brand_name}</div>
      <div><span class="lbl">Legal entity</span>{line.legal_entity_name}</div>
      <div><span class="lbl">Service line</span>{line.service_line}</div>
      <div><span class="lbl">Office</span>{line.office_name} ({line.office_city})</div>
      <div><span class="lbl">ERP system</span>{line.erp_local_system}</div>
      <div><span class="lbl">Reporting month</span><span class="mono">{line.reporting_month}</span></div>
      <div><span class="lbl">Completion month</span><span class="mono">{line.completion_month}</span></div>
      <div><span class="lbl">Currency</span>{line.transaction_currency}</div>
      <div><span class="lbl">Net fee</span><span class="num">{fmt(line.net_fee_to_group)}</span></div>
      <div><span class="lbl">Office retained</span><span class="num">{fmt(line.office_retained)}</span></div>
      <div><span class="lbl">Gross fee</span><span class="num">{fmt(line.gross_fee)}</span></div>
      <div><span class="lbl">Weighted retained</span><span class="num" style="color:#79b0ff">{fmt(line.weighted_office_retained)}</span></div>
    </div>

    {#if line.is_stale}
      <p class="stale">
        Stale — completion month is more than 30 days in the past. Probability is
        expected to be revisited.
      </p>
    {/if}

    {#if error}
      <p class="error"><strong>Rejected by the database.</strong> {error}</p>
    {/if}
    {#if okMsg}
      <p class="ok">{okMsg}</p>
    {/if}

    <h3 style="margin-top:16px">Move this line</h3>
    <div class="fields">
      <div>
        <label for="inv">Invoice number (at Billed)</label>
        <input id="inv" bind:value={invoice.invoice_number} placeholder="INV-2026-0006" />
      </div>
      <div>
        <label for="due">Invoice due date (at Billed)</label>
        <input id="due" type="date" bind:value={invoice.invoice_due_date} />
      </div>
      <div>
        <label for="erp">ERP local system ref (at Billed)</label>
        <input id="erp" bind:value={invoice.erp_local_system_ref} placeholder="PG-2026-0005" />
      </div>
      <div>
        <label for="paid">Date paid in full (at Paid)</label>
        <input id="paid" type="date" bind:value={invoice.date_paid_in_full} />
      </div>
    </div>

    <div class="row" style="margin-top:10px">
      {#if line.wip_status === 'WIP'}
        <button class="primary" onclick={() => move('Billed')}>Bill it</button>
      {/if}
      {#if line.wip_status === 'Billed'}
        <button class="primary" onclick={() => move('Paid')}>Mark paid</button>
      {/if}
      {#if line.wip_status === 'WIP' || line.wip_status === 'Billed'}
        <button class="danger" onclick={() => move('Lost')}>Mark lost</button>
      {/if}
      {#if line.wip_status === 'Paid' || line.wip_status === 'Lost'}
        <span class="faint" style="font-size:12px">Terminal status — this line cannot be moved.</span>
      {/if}
      {#if line.period_locked}
        <span class="tag flag">PERIOD LOCKED</span>
      {/if}
    </div>

    <p class="faint" style="font-size:11px;margin:8px 0 0">
      Try billing with the fields empty — the invoice-requirement rule rejects it.
      Billing a sub-30% line is allowed but raises the FL-5 gaming alert.
    </p>

    <h3 style="margin-top:16px">Probability</h3>
    <div class="row">
      <input
        type="number"
        min="0"
        max="100"
        bind:value={newProbability}
        style="width:90px"
        disabled={line.wip_status !== 'WIP'}
      />
      <button onclick={saveProbability} disabled={line.wip_status !== 'WIP'}>Save</button>
      {#if line.previous_probability != null}
        <span class="faint" style="font-size:11px">previous: {line.previous_probability}%</span>
      {/if}
    </div>
  </div>
{/if}

<style>
  .detail { position: sticky; top: 16px; }
  .lbl {
    display: block;
    font-size: 11px;
    color: var(--muted);
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 14px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--line-soft);
    font-size: 13px;
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 14px;
    margin-top: 8px;
  }
  .error {
    margin: 12px 0 0;
    padding: 9px 11px;
    background: #2d1618;
    border: 1px solid #4a2626;
    border-radius: 7px;
    color: #ffb4ae;
    font-size: 12px;
  }
  .ok {
    margin: 12px 0 0;
    padding: 9px 11px;
    background: #12321c;
    border: 1px solid #1d4a2b;
    border-radius: 7px;
    color: #7ee787;
    font-size: 12px;
  }
  .stale {
    margin: 12px 0 0;
    padding: 8px 10px;
    background: #2a2313;
    border: 1px solid #4a3a13;
    border-radius: 6px;
    color: #e3b341;
    font-size: 12px;
  }
</style>
