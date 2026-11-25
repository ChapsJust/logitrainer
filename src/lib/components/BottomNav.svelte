<script lang="ts">
  import { nav, type Tab } from '../nav.svelte';

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'home', label: 'Palais', icon: 'M3 10 12 3l9 7M5 10v10h14V10M9 20v-6h6v6' },
    { id: 'search', label: 'Recherche', icon: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4' },
    { id: 'numbers', label: 'Nombres', icon: 'M5 9h14M5 15h14M10 4 8 20M16 4l-2 16' },
    { id: 'settings', label: 'Réglages', icon: 'M4 7h16M4 17h16M9 4v6M15 14v6' },
  ];
</script>

<nav class="bottom">
  {#each tabs as t (t.id)}
    <button class:on={nav.tab === t.id} onclick={() => nav.switchTab(t.id)} aria-label={t.label}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={t.icon} /></svg>
      <span>{t.label}</span>
    </button>
  {/each}
</nav>

<style>
  .bottom {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 40;
    display: flex;
    height: calc(var(--nav-h) + var(--safe-bottom));
    padding-bottom: var(--safe-bottom);
    background: var(--surface);
    border-top: 1px solid var(--border);
  }

  button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--muted);
    font-size: 0.72rem;
    font-weight: 600;
  }

  button.on {
    color: var(--accent);
  }

  button.on svg {
    background: var(--accent-soft);
    border-radius: 12px;
    padding: 2px 12px;
    box-sizing: content-box;
  }
</style>
