<script lang="ts">
  import Icon from './Icon.svelte';

  let { checked = $bindable(), label, onchange }: { checked: boolean; label: string; onchange?: (v: boolean) => void } = $props();
</script>

<button
  class="switch"
  class:on={checked}
  role="switch"
  aria-checked={checked}
  aria-label={label}
  onclick={(e) => {
    e.stopPropagation();
    checked = !checked;
    onchange?.(checked);
  }}
>
  <span class="thumb">{#if checked}<Icon name="check" size={16} stroke={2.4} />{/if}</span>
</button>

<style>
  .switch {
    width: 52px;
    height: 32px;
    border-radius: 16px;
    border: 2px solid var(--outline);
    background: var(--surface-highest);
    position: relative;
    flex-shrink: 0;
    transition: background 0.2s var(--ease), border-color 0.2s;
  }

  .thumb {
    position: absolute;
    top: 50%;
    left: 6px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--outline);
    transform: translateY(-50%);
    transition: all 0.2s var(--ease);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .switch.on {
    background: var(--p);
    border-color: var(--p);
  }

  .switch.on .thumb {
    left: 22px;
    width: 24px;
    height: 24px;
    background: var(--onp);
    color: var(--p);
  }
</style>
