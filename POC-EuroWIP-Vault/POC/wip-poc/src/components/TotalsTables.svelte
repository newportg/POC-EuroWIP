<script>
  /**
   * Dashboard breakdowns: totals by status, by owning office and by service
   * line, all scoped to the selected reporting month.
   *
   * "In hand" is the WIP state — work won but not yet billed. The office and
   * service-line tables put every lifecycle state side by side, so one row
   * answers what a group still holds in hand, what it has billed and what it
   * has lost.
   */
  let { statusRows = [], officeRows = [], serviceRows = [], month = '' } = $props();

  const STATUS_LABEL = {
    WIP: 'In hand (WIP)',
    Billed: 'Billed',
    Paid: 'Paid',
    Lost: 'Lost'
  };

  const fmt = (n) =>
    n == null ? '—' : new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(n);

  const sum = (rows, key) => rows.reduce((acc, r) => acc + (r[key] ?? 0), 0);

  const share = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');

  const scope = $derived(month || 'All reporting months');

  const statusGross = $derived(sum(statusRows, 'gross'));
</script>

<div class="breakdowns">
  <section class="card">
    <div class="spread" style="margin-bottom:10px">
      <h3>Totals by status</h3>
      <span class="faint" style="font-size:11px">{scope}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Status</th>
          <th class="num">Lines</th>
          <th class="num">Gross</th>
          <th class="num">Share</th>
          <th class="num">Weighted</th>
        </tr>
      </thead>
      <tbody>
        {#each statusRows as r (r.status)}
          <tr class="nodrag">
            <td><span class="pill {r.status}">{STATUS_LABEL[r.status] ?? r.status}</span></td>
            <td class="num">{fmt(r.lines)}</td>
            <td class="num">{fmt(r.gross)}</td>
            <td class="num muted">{share(r.gross ?? 0, statusGross)}</td>
            <td class="num weighted">{fmt(r.weighted)}</td>
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          <td class="num">{fmt(sum(statusRows, 'lines'))}</td>
          <td class="num">{fmt(statusGross)}</td>
          <td class="num muted">{statusGross ? '100%' : '—'}</td>
          <td class="num weighted">{fmt(sum(statusRows, 'weighted'))}</td>
        </tr>
      </tfoot>
    </table>
    <p class="faint note">
      In hand = WIP lines not yet billed. Weighted = office retained ×
      probability, open lines only.
    </p>
  </section>

  {#snippet groupTable(rows, key, header)}
    <table>
      <thead>
        <tr>
          <th>{header}</th>
          <th class="num">Lines</th>
          <th class="num">In hand</th>
          <th class="num">Billed</th>
          <th class="num">Paid</th>
          <th class="num">Lost</th>
          <th class="num">Weighted</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as r (r[key])}
          <tr class="nodrag">
            <td>{r[key]}</td>
            <td class="num">{fmt(r.lines)}</td>
            <td class="num">{fmt(r.in_hand)}</td>
            <td class="num">{fmt(r.billed)}</td>
            <td class="num">{fmt(r.paid)}</td>
            <td class="num lost">{fmt(r.lost)}</td>
            <td class="num weighted">{fmt(r.weighted)}</td>
          </tr>
        {:else}
          <tr>
            <td colspan="7" class="muted" style="text-align:center;padding:20px">
              No lines in this scope.
            </td>
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          <td class="num">{fmt(sum(rows, 'lines'))}</td>
          <td class="num">{fmt(sum(rows, 'in_hand'))}</td>
          <td class="num">{fmt(sum(rows, 'billed'))}</td>
          <td class="num">{fmt(sum(rows, 'paid'))}</td>
          <td class="num lost">{fmt(sum(rows, 'lost'))}</td>
          <td class="num weighted">{fmt(sum(rows, 'weighted'))}</td>
        </tr>
      </tfoot>
    </table>
  {/snippet}

  <section class="card">
    <div class="spread" style="margin-bottom:10px">
      <h3>Totals by office</h3>
      <span class="faint" style="font-size:11px">{scope}</span>
    </div>
    {@render groupTable(officeRows, 'group_name', 'Office')}
  </section>

  <section class="card wide">
    <div class="spread" style="margin-bottom:10px">
      <h3>Totals by service line</h3>
      <span class="faint" style="font-size:11px">{scope}</span>
    </div>
    {@render groupTable(serviceRows, 'group_name', 'Service line')}
  </section>
</div>

<style>
  .breakdowns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    align-items: start;
    margin-top: 12px;
  }
  .breakdowns .wide { grid-column: 1 / -1; }
  .note { margin: 10px 0 0; font-size: 11px; line-height: 1.5; }
  .weighted { color: #79b0ff; }
  .lost { color: var(--bad); }
  tfoot td {
    border-top: 1px solid var(--line);
    border-bottom: none;
    font-weight: 600;
  }
  /* The group tables are presentation, not a selectable list. */
  tr.nodrag { cursor: default; }
  tr.nodrag:hover { background: transparent; }
  @media (max-width: 1100px) { .breakdowns { grid-template-columns: 1fr; } }
</style>
