<script lang="ts">
  import BottomNav from './lib/components/BottomNav.svelte';
  import Home from './lib/screens/Home.svelte';
  import Palace from './lib/screens/Palace.svelte';
  import Content from './lib/screens/Content.svelte';
  import Quiz from './lib/screens/Quiz.svelte';
  import Numbers from './lib/screens/Numbers.svelte';
  import Search from './lib/screens/Search.svelte';
  import Settings from './lib/screens/Settings.svelte';
  import { nav } from './lib/nav.svelte';
  import { db, status } from './lib/store.svelte';
  import { app } from './lib/app.svelte';
  import { applyTheme, onSystemThemeChange } from './lib/theme';

  const route = $derived(nav.current);
  const showNav = $derived(nav.stack.length === 1);

  $effect(() => applyTheme(db.settings.theme));
  onSystemThemeChange(() => applyTheme(db.settings.theme));
</script>

{#if status.loaded}
  {#if status.saveError}
    <div class="error">{status.saveError}</div>
  {/if}

  {#key nav.stack.length + route.name}
    <main>
      {#if route.name === 'home'}
        <Home />
      {:else if route.name === 'search'}
        <Search />
      {:else if route.name === 'numbers'}
        <Numbers />
      {:else if route.name === 'settings'}
        <Settings />
      {:else if route.name === 'palace'}
        <Palace id={route.id} tab={route.tab} />
      {:else if route.name === 'content'}
        <Content id={route.id} />
      {:else if route.name === 'quiz'}
        <Quiz kind={route.kind} id={route.id} order={route.order} />
      {/if}
    </main>
  {/key}

  {#if showNav}<BottomNav />{/if}

  {#if app.toast}
    <div class="toast" class:raised={showNav}>{app.toast}</div>
  {/if}
{/if}

<style>
  main {
    animation: enter 0.18s ease-out;
  }

  @keyframes enter {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }

  .error {
    position: fixed;
    top: calc(var(--safe-top) + 8px);
    left: 12px;
    right: 12px;
    z-index: 60;
    padding: 10px 14px;
    border-radius: 12px;
    background: var(--bad-soft);
    color: var(--bad);
    font-weight: 600;
  }

  .toast {
    position: fixed;
    left: 50%;
    bottom: calc(var(--safe-bottom) + 24px);
    transform: translateX(-50%);
    z-index: 70;
    padding: 12px 18px;
    border-radius: 14px;
    background: var(--text);
    color: var(--bg);
    font-weight: 600;
    max-width: calc(100vw - 32px);
    box-shadow: var(--shadow);
    animation: enter 0.18s ease-out;
  }

  .toast.raised {
    bottom: calc(var(--nav-h) + var(--safe-bottom) + 90px);
  }
</style>
