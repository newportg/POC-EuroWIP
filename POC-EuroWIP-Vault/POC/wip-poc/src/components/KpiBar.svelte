<script>
  let { kpi = {}, currencyNote = null } = $props();

  const fmt = (n) =>
    n == null
      ? '—'
      : new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(n);
</script>

<div class="kpis">
  <div class="kpi">
    <div class="kpi-label">Gross pipeline</div>
    <div class="kpi-value">{fmt(kpi.gross_pipeline)}</div>
  </div>
  <div class="kpi accent">
    <div class="kpi-label">Weighted retained</div>
    <div class="kpi-value">{fmt(kpi.weighted_retained)}</div>
    <div class="kpi-sub">retained × probability</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Billed</div>
    <div class="kpi-value">{fmt(kpi.billed)}</div>
  </div>
  <div class="kpi good">
    <div class="kpi-label">Paid</div>
    <div class="kpi-value">{fmt(kpi.paid)}</div>
  </div>
  <div class="kpi bad">
    <div class="kpi-label">Lost</div>
    <div class="kpi-value">{fmt(kpi.lost)}</div>
  </div>
  <div class="kpi warn">
    <div class="kpi-label">Stale lines</div>
    <div class="kpi-value">{kpi.stale_lines ?? 0}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Locked lines</div>
    <div class="kpi-value">{kpi.locked_lines ?? 0}</div>
  </div>
</div>

{#if currencyNote}
  <p class="currency-note">{currencyNote}</p>
{/if}

<style>
  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
  }
  .kpi {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 12px 14px;
  }
  .kpi-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--faint);
    font-weight: 600;
  }
  .kpi-value {
    font-family: var(--mono);
    font-size: 21px;
    font-variant-numeric: tabular-nums;
    margin-top: 4px;
  }
  .kpi-sub { font-size: 10px; color: var(--faint); margin-top: 2px; }
  .kpi.accent { border-color: #24405f; }
  .kpi.accent .kpi-value { color: #79b0ff; }
  .kpi.good .kpi-value { color: var(--good); }
  .kpi.bad .kpi-value { color: var(--bad); }
  .kpi.warn .kpi-value { color: var(--warn); }
  .currency-note {
    margin: 8px 0 0;
    font-size: 11px;
    color: var(--warn);
    background: #2a2313;
    border: 1px solid #4a3a13;
    border-radius: 6px;
    padding: 6px 10px;
  }
</style>
