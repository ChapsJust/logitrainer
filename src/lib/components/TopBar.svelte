<script lang="ts">
  import type { Snippet } from 'svelte';
  import { nav } from '../nav.svelte';

  interface Props {
    title: string;
    subtitle?: string;
    back?: boolean;
    actions?: Snippet;
  }

  let { title, subtitle = '', back = false, actions }: Props = $props();
</script>

<header class="top">
  {#if back}
    <button class="icon-btn" onclick={() => nav.back()} aria-label="Retour">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
    </button>
  {/if}
  <div class="titles grow" class:pad={!back}>
    <h1 class="ellipsis">{title}</h1>
    {#if subtitle}<p class="muted small ellipsis">{subtitle}</p>{/if}
  </div>
  {#if actions}{@render actions()}{/if}
</header>

<style>
  .top {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: calc(var(--safe-top) + 8px) 8px 8px;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    max-width: 720px;
    margin: 0 auto;
  }

  .titles.pad {
    padding-left: 10px;
  }

  h1 {
    font-size: 1.35rem;
    font-weight: 800;
  }
</style>
