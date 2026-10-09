<script>
  import InstructionWizard from './InstructionWizard.svelte';

  // The Create tab is the instruction wizard and nothing else: completing the
  // review opens the instruction *and* its first WIP line, so there is no
  // separate WIP-creation mode.
  let { oncreated = () => {}, onview = () => {}, version = 0 } = $props();
</script>

<InstructionWizard {oncreated} {onview} {version} />
