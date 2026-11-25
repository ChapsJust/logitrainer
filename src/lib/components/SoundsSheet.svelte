<script lang="ts">
  import Sheet from './Sheet.svelte';
  import { MAJOR, MAJOR_TRICKS } from '../major';

  let { open = $bindable() }: { open: boolean } = $props();
</script>

<Sheet bind:open title="Les 10 sons">
  <div class="tbl">
    {#each Object.entries(MAJOR) as [d, s] (d)}
      <div class="tr">
        <span class="d">{d}</span>
        <span class="s">{s.toUpperCase()}</span>
        <span class="t body-m onv">{MAJOR_TRICKS[d]}</span>
      </div>
    {/each}
  </div>
  <p class="body-m onv" style="margin-top: 14px">
    Les voyelles (a, e, i, o, u, y), les lettres muettes et les sons nasals (an, on, in) ne comptent pas. On écoute les sons, on
    ne regarde pas l'orthographe : « mot » = M seulement (le t est muet), « mite » = M + T.
  </p>
</Sheet>

<style>
  .tr {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--divider);
  }

  .d {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: var(--pc);
    color: var(--onpc);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .s {
    width: 80px;
    font-weight: 700;
    color: var(--p);
    flex-shrink: 0;
  }
</style>
