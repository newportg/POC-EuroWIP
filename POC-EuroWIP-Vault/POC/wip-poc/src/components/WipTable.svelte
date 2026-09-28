<script>
  let { rows = [], selectedId = null, onselect, offices = [], filters = $bindable() } = $props();

  const fmt = (n) =>
    n == null ? '—' : new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(n);
</script>

<div class="card">
  <div class="spread" style="margin-bottom:12px">
    <h2>WIP lines</h2>
    <div class="row">
      <input
        class="search"
        type="search"
        placeholder="Search name, brand, instruction…"
        bind:value={filters.search}
      />
      <select bind:value={filters.officeId} style="width:auto">
        <option value="">All offices</option>
        {#each offices as o (o.id)}
          <option value={o.id}>{o.name}</option>
        {/each}
      </select>
      <select bind:value={filters.status} style="width:auto">
        <option value="">All statuses</option>
        <option value="WIP">WIP</option>
        <option value="Billed">Billed</option>
        <option value="Paid">Paid</option>
        <option value="Lost">Lost</option>
      </select>
      <label class="stale-toggle">
        <input type="checkbox" bind:checked={filters.staleOnly} style="width:auto" />
        Stale only
      </label>
    </div>
  </div>

  <div class="scroll" style="max-height:460px">
    <table>
      <thead>
        <tr>
          <th>Line</th>
          <th>Status</th>
          <th>Brand</th>
          <th>Service line</th>
          <th>Office</th>
          <th class="num">Gross</th>
          <th class="num">Retained</th>
          <th class="num">Prob</th>
          <th class="num">Weighted</th>
          <th>Flags</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as r (r.id)}
          <tr class:selected={r.id === selectedId} onclick={() => onselect(r.id)}>
            <td class="mono">{r.name}</td>
            <td>
              <span class="pill {r.wip_status}">{r.wip_status}</span>
            </td>
            <td>{r.brand_name}</td>
            <td class="muted">{r.service_line}</td>
            <td class="muted">{r.office_city}</td>
            <td class="num">{fmt(r.gross_fee)}</td>
            <td class="num">{fmt(r.office_retained)}</td>
            <td class="num">{r.probability}%</td>
            <td class="num" style="color:#79b0ff">{fmt(r.weighted_office_retained)}</td>
            <td>
              {#if r.is_stale}<span class="tag flag">STALE</span>{/if}
              {#if r.period_locked}<span class="tag">LOCKED</span>{/if}
              {#if r.erp_local_system_ref === null && r.wip_status === 'Billed'}
                <span class="tag flag">NO ERP</span>
              {/if}
            </td>
          </tr>
        {:else}
          <tr><td colspan="10" class="muted" style="text-align:center;padding:24px">
            No lines match these filters.
          </td></tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="faint" style="margin:10px 0 0;font-size:11px">
    {rows.length} line{rows.length === 1 ? '' : 's'} shown
  </p>
</div>

<style>
  .search { width: 220px; }
  .stale-toggle {
    display: flex; align-items: center; gap: 6px; margin: 0;
    text-transform: none; letter-spacing: 0; font-size: 12px; color: var(--muted);
    white-space: nowrap;
  }
</style>
