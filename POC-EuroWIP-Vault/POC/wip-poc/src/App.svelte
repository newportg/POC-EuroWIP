<script>
  import { onMount } from 'svelte';
  import { openDatabase } from './lib/db.js';
  import * as repo from './lib/repo.js';
  import KpiBar from './components/KpiBar.svelte';
  import WipTable from './components/WipTable.svelte';
  import WipDetail from './components/WipDetail.svelte';
  import SidePanels from './components/SidePanels.svelte';
  import ModelPanel from './components/ModelPanel.svelte';
  import CreatePanel from './components/CreatePanel.svelte';

  let ready = $state(false);
  let fatal = $state('');
  let version = $state(0);
  let tab = $state('wip');
  let month = $state('');
  let selectedId = $state(null);

  let filters = $state({ search: '', officeId: '', status: '', staleOnly: false });

  const bump = () => { version += 1; };

  // Derived reads. `version` is the invalidation key: every mutation bumps it,
  // which re-runs the queries against the live in-memory database.
  let rows          = $derived(version >= 0 && repo.getWip(filters));
  let offices       = $derived(repo.getOffices());
  let instructions  = $derived(repo.getInstructions());
  let serviceLines  = $derived(repo.getServiceLines());
  let periods       = $derived(repo.getPeriods());
  let kpi           = $derived(repo.getKpis(month || null));
  let selected      = $derived(selectedId ? repo.getWipLine(selectedId) : null);
  let pipeline      = $derived(repo.getPipelineByServiceLine(month || null));

  // Single-currency check: the pipeline KPIs add EUR and GBP lines together,
  // which is the same defect the wiki flagged in the reporting model.
  let currencyNote = $derived.by(() => {
    const codes = [...new Set(rows.map((r) => r.transaction_currency).filter(Boolean))];
    return codes.length > 1
      ? `Mixed currencies (${codes.join(', ')}) are summed without conversion. Flagged as a reporting gap.`
      : null;
  });

  const monthOptions = $derived([...new Set(periods.map((p) => p.reporting_month))].sort().reverse());

  onMount(async () => {
    try {
      await openDatabase();
      ready = true;
      bump();
    } catch (err) {
      fatal = String(err?.message ?? err);
    }
  });

  function reseedAll() {
    repo.reseed();
    selectedId = null;
    bump();
  }

  /** Jump from a newly created record to it in the WIP list. */
  function viewInWip(name) {
    filters = { ...filters, search: name, status: '', staleOnly: false };
    tab = 'wip';
  }
</script>

{#if fatal}
  <div class="fatal">
    <h2>Could not start the database</h2>
    <p class="mono">{fatal}</p>
  </div>
{:else if !ready}
  <div class="loading">Loading the schema and seed…</div>
{:else}
  <header>
    <div>
      <h1>WIP &nbsp;<span class="muted">·</span>&nbsp; pipeline</h1>
      <p class="faint" style="margin:2px 0 0;font-size:12px">
        EuroWIP lifecycle, automation and period locking, as a relational model
      </p>
    </div>
    <div class="row">
      <select bind:value={month} style="width:auto">
        <option value="">All reporting months</option>
        {#each monthOptions as m (m)}
          <option value={m}>{m}</option>
        {/each}
      </select>
      <button onclick={() => repo.downloadDatabase()}>Download .sqlite</button>
      <button class="danger" onclick={reseedAll}>Reseed</button>
    </div>
  </header>

  <nav>
    <button class="tab" class:active={tab === 'wip'} onclick={() => (tab = 'wip')}>WIP</button>
    <button class="tab" class:active={tab === 'create'} onclick={() => (tab = 'create')}>Create</button>
    <button class="tab" class:active={tab === 'controls'} onclick={() => (tab = 'controls')}>Controls</button>
    <button class="tab" class:active={tab === 'model'} onclick={() => (tab = 'model')}>Model &amp; questions</button>
  </nav>

  <main>
    {#if tab === 'wip'}
      <KpiBar kpi={kpi} currencyNote={currencyNote} />

      {#if month && pipeline.length}
        <div class="card" style="margin-top:12px">
          <h3 style="margin-bottom:8px">Open pipeline by service line</h3>
          <table>
            <thead>
              <tr><th>Service line</th><th class="num">Lines</th><th class="num">Gross</th><th class="num">Weighted retained</th></tr>
            </thead>
            <tbody>
              {#each pipeline as p (p.service_line)}
                <tr class="nodrag">
                  <td>{p.service_line}</td>
                  <td class="num">{p.lines}</td>
                  <td class="num">{new Intl.NumberFormat('en-GB').format(p.gross)}</td>
                  <td class="num" style="color:#79b0ff">{new Intl.NumberFormat('en-GB').format(p.weighted)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      <div class="work" style="margin-top:12px">
        <div>
          <WipTable
            {rows}
            {offices}
            {filters}
            {selectedId}
            onselect={(id) => (selectedId = id)}
          />
        </div>
        <div>
          <WipDetail line={selected} onclose={() => (selectedId = null)} onchanged={bump} />
          {#if !selected}
            <div class="card hint">
              <h2 style="margin-bottom:8px">Try this</h2>
              <ol style="margin:0;padding-left:18px;font-size:12px;line-height:1.8">
                <li>Open a line and press <strong>Bill it</strong> with the fields empty — the invoice-requirement rule rejects it.</li>
                <li>Fill the invoice fields and bill a line under 30% probability — it succeeds and raises the FL-5 alert.</li>
                <li>Go to <strong>Controls</strong> and lock a reporting month, then try to edit one of its lines.</li>
                <li>Withdraw an instruction on the <strong>Model</strong> tab's parent and watch the cascade.</li>
              </ol>
            </div>
          {/if}
        </div>
      </div>
    {:else if tab === 'create'}
      <CreatePanel oncreated={bump} onview={viewInWip} {version} />
    {:else if tab === 'controls'}
      <SidePanels onchanged={bump} />
    {:else}
      <ModelPanel {instructions} {serviceLines} />
    {/if}
  </main>
{/if}

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding: 20px 24px 14px;
    flex-wrap: wrap;
  }
  h1 { font-size: 20px; letter-spacing: -0.01em; }
  nav {
    display: flex;
    gap: 2px;
    padding: 0 24px;
    border-bottom: 1px solid var(--line);
  }
  .tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    padding: 8px 14px;
    color: var(--muted);
    font-size: 13px;
  }
  .tab:hover { background: none; color: var(--text); }
  .tab.active { color: var(--text); border-bottom-color: var(--accent); font-weight: 600; }
  main { padding: 18px 24px 40px; }
  .work { display: grid; grid-template-columns: 1.5fr 1fr; gap: 12px; align-items: start; }
  .hint ol { color: var(--muted); }
  .hint li { margin-bottom: 4px; }
  .loading, .fatal { padding: 60px 24px; text-align: center; }
  .fatal { color: var(--bad); }
  tr.nodrag { cursor: default; }
  tr.nodrag:hover { background: transparent; }
  @media (max-width: 1100px) { .work { grid-template-columns: 1fr; } }
</style>
