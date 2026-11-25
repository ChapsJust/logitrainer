<script lang="ts">
  import { nav, type Tab } from '../nav.svelte';
  import Icon, { type IconName } from './Icon.svelte';
  import { haptic } from '../haptics';

  const tabs: { id: Tab; label: string; icon: IconName }[] = [
    { id: 'home', label: 'Palais', icon: 'home' },
    { id: 'search', label: 'Recherche', icon: 'search' },
    { id: 'numbers', label: 'Nombres', icon: 'hash' },
    { id: 'lab', label: 'Labo', icon: 'flask' },
    { id: 'settings', label: 'Réglages', icon: 'settings' },
  ];
</script>

<nav>
  {#each tabs as t (t.id)}
    <button
      class:on={nav.tab === t.id}
      onclick={() => {
        haptic.tick();
        nav.switchTab(t.id);
      }}
      aria-label={t.label}
      aria-current={nav.tab === t.id ? 'page' : undefined}
    >
      <span class="pill"><Icon name={t.icon} /></span>
      <span class="label-m">{t.label}</span>
    </button>
  {/each}
</nav>

<style>
  nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 40;
    display: flex;
    height: calc(var(--nav-h) + var(--safe-bottom));
    padding: 12px 0 calc(16px + var(--safe-bottom));
    background: var(--surface-c);
  }

  button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    color: var(--onv);
  }

  .pill {
    width: 64px;
    height: 32px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s var(--ease);
  }

  button.on {
    color: var(--on);
  }

  button.on .label-m {
    font-weight: 700;
  }

  button.on .pill {
    background: var(--sc);
    color: var(--onsc);
  }
</style>
