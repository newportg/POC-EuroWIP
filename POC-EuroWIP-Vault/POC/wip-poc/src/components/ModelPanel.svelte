<script>
  let { instructions = [], serviceLines = [] } = $props();

  const rules = [
    ['PL-1', 'A WIP line must hang off exactly one parent, stamped at creation.', 'trigger'],
    ['PL-2', 'Service line, sector, brand, negotiator, office and VAT are denormalised from the Instruction on create.', 'trigger'],
    ['PL-3', 'Every probability change captures a pre-image before applying.', 'trigger'],
    ['PL-4', 'A locked period rejects edits to fee, probability, status and invoice fields.', 'trigger'],
    ['FL-2', 'Withdrawing an Instruction cascades its open WIP lines to Lost.', 'trigger'],
    ['FL-3', 'A cascade into a closed period is refused rather than silently rewriting history.', 'trigger'],
    ['FL-4', 'The period is locked on the 15th of the following month.', 'rule'],
    ['FL-5', 'Billing from under 30% probability raises a gaming alert.', 'trigger'],
    ['F5', 'The invoice entity must be classified as a Legal Entity.', 'trigger'],
    ['BR', 'Status is WIP → Billed → Paid, with Lost. Paid and Lost are terminal.', 'check'],
    ['BR', 'Invoice number, due date and ERP reference are required at Billed.', 'trigger'],
    ['BR', 'Date paid in full is required at Paid, and the invoice number is never cleared.', 'trigger'],
    ['BR', 'Probability freezes the moment status leaves WIP.', 'trigger'],
    ['BR', 'Fee schedule is a Capital Markets table and links nowhere else.', 'trigger']
  ];

  const questions = [
    ['Q1', 'kf_fin_localsystemref has no authoritative source table. Stubbed as a WIP field.', 'blocking'],
    ['Q2', 'PL-1/FL-2/FL-3 still describe the retired 13-lookup parent model.', 'blocking'],
    ['Q3', 'Staleness is a business trigger with no Dataverse equivalent; the POC makes it a view column plus a UI flag.', 'open'],
    ['Q7', 'Reporting KPIs reference kf_Deal.kf_fin_outstanding, which does not exist. Aged receivables here is an inferred derivation.', 'blocking']
  ];
</script>

<div class="cols">
  <div class="grid" style="gap:12px">
    <div class="card">
      <h2 style="margin-bottom:10px">Relational model</h2>
      <pre class="diagram">{`kf_serviceline (1)
      |
      | 1
      v
kf_Instruction (1) --------- n ---- kf_WIP
      |                                |
      | 1                              | 1
      v                                v
kf_Account (Legal Entity)      kf_FeeSchedule
                                     (Capital Markets only)

kf_WIP -- n --> kf_BusinessUnit   (owning office, sets VAT)
kf_WIP -- n --> kf_Account        (client brand)
kf_Instruction -- n --> kf_DealProperty -- n --> kf_Property`}</pre>
      <p class="faint" style="font-size:11px;margin:10px 0 0">
        Thirteen service-line parent tables are collapsed into a single
        <span class="mono">service_line_parent</span> table, and the universal property
        junction is <span class="mono">deal_property</span>.
      </p>
    </div>

    <div class="card">
      <h2 style="margin-bottom:10px">Open questions carried from the wiki</h2>
      <div class="grid" style="gap:8px">
        {#each questions as [id, text, kind] (id)}
          <div class="q">
            <span class="tag rule">{id}</span>
            <span class="tag {kind === 'blocking' ? 'flag' : ''}">{kind}</span>
            <span style="flex:1;font-size:12px">{text}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <div class="grid" style="gap:12px">
    <div class="card">
      <h2 style="margin-bottom:10px">Rules enforced by the database</h2>
      <table>
        <thead><tr><th>Code</th><th>Rule</th><th>Enforced as</th></tr></thead>
        <tbody>
          {#each rules as [code, text, kind] (code + text)}
            <tr class="nodrag">
              <td class="mono" style="white-space:nowrap">{code}</td>
              <td style="font-size:12px">{text}</td>
              <td><span class="tag">{kind}</span></td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="faint" style="font-size:11px;margin:10px 0 0">
        These are not application-level validations. They are constraints and triggers
        in the schema, so they hold no matter which client writes the data.
      </p>
    </div>

    <div class="card">
      <h2 style="margin-bottom:10px">Instructions</h2>
      <div class="scroll" style="max-height:340px">
        <table>
          <thead>
            <tr><th>Ref</th><th>Service line</th><th>Client</th><th>Status</th></tr>
          </thead>
          <tbody>
            {#each instructions as i (i.id)}
              <tr class="nodrag">
                <td class="mono">{i.name}</td>
                <td class="muted">{i.service_line}</td>
                <td>{i.client_name}</td>
                <td>
                  <span class="pill {i.instruction_status === 'Withdrawn' ? 'Lost' : i.instruction_status === 'Active' ? 'Paid' : 'Billed'}">
                    {i.instruction_status}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h2 style="margin-bottom:10px">Service lines ({serviceLines.length})</h2>
      <div class="sl">
        {#each serviceLines as s (s.id)}
          <span class="tag">{s.service_line}</span>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
  .diagram {
    font-family: var(--mono);
    font-size: 11px;
    line-height: 1.55;
    background: #10131a;
    border: 1px solid var(--line-soft);
    border-radius: 8px;
    padding: 12px;
    margin: 0;
    overflow-x: auto;
    color: #b8c0d0;
  }
  .q { display: flex; gap: 8px; align-items: flex-start; }
  .sl { display: flex; flex-wrap: wrap; gap: 5px; }
  tr.nodrag { cursor: default; }
  tr.nodrag:hover { background: transparent; }
  @media (max-width: 1100px) { .cols { grid-template-columns: 1fr; } }
</style>
