<script>
  import { onMount } from 'svelte';
  import { openDatabase } from './lib/db.js';
  import * as repo from './lib/repo.js';
  import KpiBar from './components/KpiBar.svelte';
  import TotalsTables from './components/TotalsTables.svelte';
  import WipTable from './components/WipTable.svelte';
  import WipDetail from './components/WipDetail.svelte';
  import SidePanels from './components/SidePanels.svelte';
  import ModelPanel from './components/ModelPanel.svelte';
  import CreatePanel from './components/CreatePanel.svelte';

  let ready = $state(false);
  let fatal = $state('');
  let version = $state(0);
  let tab = $state('dashboard');
  let month = $state('');
  let selectedId = $state(null);
  let showIntro = $state(false);

  let filters = $state({ search: '', officeId: '', status: '', staleOnly: false });

  const bump = () => { version += 1; };

  // Derived reads. `version` is the invalidation key: every mutation bumps it,
  // which re-runs the queries against the live in-memory database.
  let rows          = $derived(version >= 0 && repo.getWip(filters));
  let offices       = $derived(repo.getOffices());
  let instructions  = $derived(repo.getInstructions());
  let serviceLines  = $derived(repo.getServiceLines());
  let periods       = $derived(repo.getPeriods());
  // The KPI and totals reads also key off `version`, so billing or losing a
  // line refreshes them along with the table.
  let kpi           = $derived(version >= 0 && repo.getKpis(month || null));
  let selected      = $derived(selectedId ? repo.getWipLine(selectedId) : null);
  let statusTotals  = $derived(version >= 0 && repo.getTotalsByStatus(month || null));
  let officeTotals  = $derived(version >= 0 && repo.getTotalsByOffice(month || null));
  let serviceTotals = $derived(version >= 0 && repo.getTotalsByServiceLine(month || null));

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
      showIntro = true; // offer the walkthrough on start
    } catch (err) {
      fatal = String(err?.message ?? err);
    }
  });

  /** Open the animated walkthrough (a static page shipped in /tour). */
  function openTour() {
    window.open('./tour/index.html', '_blank', 'noopener');
  }
  function watchTour() {
    openTour();
    showIntro = false;
  }

  function reseedAll() {
    repo.reseed();
    selectedId = null;
    bump();
  }

  /** Jump from a newly created record to it in the WIP list. */
  function viewInWip(name) {
    filters = { ...filters, search: name, status: '', staleOnly: false };
    tab = 'wip';
    selectedId = null;
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
      <button class="tour-btn" onclick={openTour} title="Watch the animated walkthrough">▶ Tour</button>
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
    <button class="tab" class:active={tab === 'dashboard'} onclick={() => (tab = 'dashboard')}>Dashboard</button>
    <button class="tab" class:active={tab === 'create'} onclick={() => (tab = 'create')}>Create</button>
    <button class="tab" class:active={tab === 'wip'} onclick={() => (tab = 'wip')}>WIP</button>
    <button class="tab" class:active={tab === 'controls'} onclick={() => (tab = 'controls')}>Controls</button>
    <button class="tab" class:active={tab === 'model'} onclick={() => (tab = 'model')}>Model &amp; questions</button>
  </nav>

  <main>
    {#snippet kpis()}
      <KpiBar kpi={kpi} currencyNote={currencyNote} />
    {/snippet}

    {#snippet totals()}
      <TotalsTables
        statusRows={statusTotals}
        officeRows={officeTotals}
        serviceRows={serviceTotals}
        {month}
      />
    {/snippet}

    {#if tab === 'dashboard'}
      {@render kpis()}
      {@render totals()}
    {:else if tab === 'wip'}
      {@render kpis()}

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

  {#if showIntro}
    <div class="intro-overlay" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div class="intro-card">
        <div class="intro-icon">▶</div>
        <h2 id="intro-title">New here?</h2>
        <p>
          Watch a short animated walkthrough of how this works — the dashboard,
          creating an instruction, and the WIP line it opens automatically.
        </p>
        <div class="intro-actions">
          <button class="primary" id="introWatch" onclick={watchTour}>Watch the slideshow</button>
          <button class="ghost" id="introSkip" onclick={() => (showIntro = false)}>Skip to the app</button>
        </div>
        <p class="intro-note">You can reopen it any time from the <b>▶ Tour</b> button, top-right.</p>
      </div>
    </div>
  {/if}
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
  .loading, .fatal { padding: 60px 24px; text-align: center; }
  .fatal { color: var(--bad); }

  .tour-btn { border-color: #24405f; color: #79b0ff; }

  .intro-overlay {
    position: fixed; inset: 0; z-index: 100; display: grid; place-items: center;
    background: rgba(6, 8, 12, 0.62); backdrop-filter: blur(3px); padding: 20px;
  }
  .intro-card {
    width: min(440px, 100%); background: var(--panel); border: 1px solid var(--line);
    border-radius: 14px; padding: 24px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
    animation: intropop 0.28s ease-out both;
  }
  @keyframes intropop {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to { opacity: 1; transform: none; }
  }
  .intro-icon {
    width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center;
    background: var(--accent-soft); color: var(--accent); font-size: 16px; margin-bottom: 12px;
  }
  .intro-card h2 { font-size: 18px; }
  .intro-card p { margin: 8px 0 0; font-size: 13px; color: var(--muted); line-height: 1.55; }
  .intro-actions { display: flex; gap: 8px; margin-top: 18px; }
  .intro-note { margin-top: 14px; font-size: 11px; color: var(--faint); }
  .intro-note b { color: var(--muted); }

  @media (max-width: 1100px) { .work { grid-template-columns: 1fr; } }
</style>
