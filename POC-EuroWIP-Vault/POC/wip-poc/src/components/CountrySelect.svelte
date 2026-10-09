<script>
  import { OPTION_COUNTRIES } from '../lib/loqate.js';
  import { flagFor } from '../lib/flags.js';

  // Value is the country name (matching COUNTRY_ISO keys); the picker shows the
  // flag image rather than the name.
  let { value = '', onchange = () => {} } = $props();

  const OPTIONS = [...OPTION_COUNTRIES, 'Other'];
  let open = $state(false);
  let root;

  // Close on any click outside the control.
  $effect(() => {
    if (!open) return;
    const onDoc = (e) => { if (root && !root.contains(e.target)) open = false; };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  });

  function choose(c) {
    onchange(c);
    open = false;
  }
</script>

<div class="country-select" bind:this={root}>
  <button
    type="button"
    class="country-btn"
    aria-label="Country"
    aria-expanded={open}
    title={value || 'Choose a country'}
    onclick={() => (open = !open)}
  >
    <img src={flagFor(value)} alt="" />
    <span class="caret">▾</span>
  </button>
  {#if open}
    <ul class="country-menu">
      {#each OPTIONS as c (c)}
        <li>
          <button type="button" class="country-option" class:selected={c === value} onclick={() => choose(c)}>
            <img src={flagFor(c)} alt="" />
            <span>{c}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
