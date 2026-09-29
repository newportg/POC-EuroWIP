<script>
  import { getAlerts, getReceivables, getReceivableBuckets, getPeriods, getEvents,
           lockPeriod, unlockPeriod, dismissAlert } from '../lib/repo.js';

  let { onchanged = () => {} } = $props();
  let version = $state(0);

  const fmt = (n) =>
    n == null ? '—' : new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(n);

  // Each derived must name `version` so it recomputes. A derived over a plain
  // function call has no reactive dependency, and would otherwise freeze at its
  // first value the moment a period is locked or an alert dismissed.
  const read = (fn) => () => { void version; return fn(); };

  let alerts = $derived.by(read(() => getAlerts().filter((a) => !a.resolved)));
  let buckets = $derived.by(read(getReceivableBuckets));
  let receivables = $derived.by(read(getReceivables));
  let periods = $derived.by(read(getPeriods));
  let events = $derived.by(read(() => getEvents(25)));

  const bucketTone = { '0-30': 'var(--good)', '31-60': 'var(--warn)', '61-90': '#f0883e', '90+': 'var(--bad)' };
  const maxTotal = $derived(Math.max(1, ...buckets.map((b) => b.total)));

  function refresh() { version += 1; onchanged(); }
</script>

<div class="cols">
  <div class="grid" style="gap:12px">
    <div class="card">
      <div class="spread" style="margin-bottom:10px">
        <h2>Alerts</h2>
        <span class="faint" style="font-size:11px">{alerts.length} open</span>
      </div>
      {#if alerts.length}
        <div class="grid" style="gap:8px">
          {#each alerts as a (a.id)}
            <div class="alert-row {a.severity}">
              <span class="tag rule">{a.alert_type}</span>
              <div style="flex:1">
                <div style="font-size:13px">{a.message}</div>
                {#if a.wip_name}
                  <div class="faint mono" style="font-size:11px">{a.wip_name}</div>
                {/if}
              </div>
              <button class="ghost" onclick={() => { dismissAlert(a.id); refresh(); }}>
                Dismiss
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <p class="faint" style="margin:0">No open alerts.</p>
      {/if}
    </div>

    <div class="card">
      <div class="spread" style="margin-bottom:10px">
        <h2>Receivables ageing</h2>
        <span class="faint" style="font-size:11px">inferred · see Q7</span>
      </div>
      {#if buckets.length}
        {#each buckets as b (b.bucket)}
          <div class="bucket">
            <div class="spread" style="margin-bottom:4px">
              <span class="mono" style="font-size:12px">{b.lines} line{b.lines === 1 ? '' : 's'}</span>
              <span class="mono muted" style="font-size:12px">{fmt(b.total)}</span>
            </div>
            <div class="track">
              <div class="fill" style="width:{(b.total / maxTotal) * 100}%;background:{bucketTone[b.bucket] ?? 'var(--muted)'}"></div>
            </div>
            <div class="faint" style="font-size:10px;margin-top:2px">{b.bucket} days overdue</div>
          </div>
        {/each}
        <table style="margin-top:12px">
          <thead>
            <tr><th>Line</th><th>Brand</th><th>Invoice</th><th class="num">Incl. VAT</th><th class="num">Days</th></tr>
          </thead>
          <tbody>
            {#each receivables as r (r.id)}
              <tr class="nodrag">
                <td class="mono">{r.name}</td>
                <td class="muted">{r.brand_name}</td>
                <td class="mono muted">{r.invoice_number}</td>
                <td class="num">{fmt(r.gross_incl_vat)}</td>
                <td class="num">{r.days_overdue}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="faint" style="margin:0">Nothing outstanding.</p>
      {/if}
    </div>
  </div>

  <div class="grid" style="gap:12px">
    <div class="card">
      <div class="spread" style="margin-bottom:10px">
        <h2>Reporting periods</h2>
        <span class="faint" style="font-size:11px">FL-4 lock</span>
      </div>
      <table>
        <thead>
          <tr><th>Month</th><th class="num">Lines</th><th class="num">Weighted</th><th></th></tr>
        </thead>
        <tbody>
          {#each periods as p (p.reporting_month)}
            <tr class="nodrag">
              <td class="mono">{p.reporting_month}</td>
              <td class="num">{p.lines}</td>
              <td class="num">{fmt(p.weighted)}</td>
              <td>
                {#if p.locked > 0 && p.locked === p.lines}
                  <span class="tag">LOCKED</span>
                  <button class="ghost" style="padding:2px 8px;font-size:11px"
                          onclick={() => { unlockPeriod(p.reporting_month, 'poc.user'); refresh(); }}>
                    Unlock
                  </button>
                {:else if p.locked > 0}
                  <span class="tag flag">PARTIAL</span>
                {:else}
                  <button class="ghost" style="padding:2px 8px;font-size:11px"
                          onclick={() => { lockPeriod(p.reporting_month, 'poc.user'); refresh(); }}>
                    Lock
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="faint" style="font-size:11px;margin:10px 0 0">
        A locked period rejects edits to fee, probability, status and invoice fields.
        The production rule locks on the 15th of the following month; here you drive it by hand.
      </p>
    </div>

    <div class="card">
      <h2 style="margin-bottom:10px">Event log</h2>
      <div class="scroll" style="max-height:300px">
        <table>
          <thead>
            <tr><th>When</th><th>Entity</th><th>Event</th><th>Detail</th></tr>
          </thead>
          <tbody>
            {#each events as e (e.id)}
              <tr class="nodrag">
                <td class="mono faint" style="font-size:11px">{e.event_time?.slice(5, 16)}</td>
                <td class="mono faint" style="font-size:11px">{e.entity}#{e.entity_id}</td>
                <td style="font-size:12px">{e.event}</td>
                <td class="muted" style="font-size:11px">{e.detail}</td>
              </tr>
            {:else}
              <tr><td colspan="4" class="faint">Nothing yet.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<style>
  .cols { display: grid; grid-template-columns: 1.15fr 1fr; gap: 12px; align-items: start; }
  .bucket { margin-bottom: 12px; }
  .track { height: 6px; background: var(--panel-2); border-radius: 999px; overflow: hidden; }
  .fill { height: 100%; border-radius: 999px; }
  tr.nodrag { cursor: default; }
  tr.nodrag:hover { background: transparent; }
  @media (max-width: 1100px) { .cols { grid-template-columns: 1fr; } }
</style>
