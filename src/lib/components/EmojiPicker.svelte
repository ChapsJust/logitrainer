<script lang="ts">
  const EMOJIS = ['🏠', '🏢', '🏫', '🏰', '⛪', '🏥', '🏪', '🏟️', '🌳', '🏖️', '⛰️', '🚗', '🚇', '🏋️', '🎮', '📚', '🍕', '☕', '🎨', '⭐'];

  let { value = $bindable() }: { value: string } = $props();
</script>

<div class="grid">
  {#each EMOJIS as e (e)}
    <button type="button" class:on={value === e} onclick={() => (value = e)} aria-label={e}>{e}</button>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(46px, 1fr));
    gap: 6px;
  }

  button {
    height: 46px;
    font-size: 1.5rem;
    border-radius: 12px;
    background: var(--surface-2);
    border: 2px solid transparent;
  }

  button.on {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
</style>
