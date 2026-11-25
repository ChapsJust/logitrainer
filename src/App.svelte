<script lang="ts">
  import BottomNav from './lib/components/BottomNav.svelte';
  import Home from './lib/screens/Home.svelte';
  import Palace from './lib/screens/Palace.svelte';
  import Content from './lib/screens/Content.svelte';
  import Quiz from './lib/screens/Quiz.svelte';
  import Walk from './lib/screens/Walk.svelte';
  import Numbers from './lib/screens/Numbers.svelte';
  import Search from './lib/screens/Search.svelte';
  import Settings from './lib/screens/Settings.svelte';
  import Onboarding from './lib/screens/Onboarding.svelte';
  import { nav } from './lib/nav.svelte';
  import { db, status } from './lib/store.svelte';
  import { app, dismissSnack } from './lib/app.svelte';
  import { applyTheme, onSystemThemeChange } from './lib/theme';

  const route = $derived(nav.current);
  const showNav = $derived(nav.stack.length === 1);
  const onboarding = $derived(db.palaces.length === 0 && !db.settings.onboarded);

  $effect(() => applyTheme(db.settings.theme));
  onSystemThemeChange(() => applyTheme(db.settings.theme));
</script>

{#if status.loaded}
  {#if status.saveError}
    <div class="error body-m">{status.saveError}</div>
  {/if}

  {#if onboarding}
    <Onboarding />
  {:else}
    {#key nav.version}
      <main class="screen {nav.dir}">
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
        {:else if route.name === 'walk'}
          <Walk palaceId={route.palaceId} contentId={route.contentId} />
        {/if}
      </main>
    {/key}

    {#if showNav}<BottomNav />{/if}
  {/if}

  {#if app.snack}
    {#key app.snack.id}
      <div class="snack" class:raised={showNav && !onboarding} role="status">
        <span class="body-m grow">{app.snack.message}</span>
        {#if app.snack.action}
          {@const action = app.snack.action}
          <button
            class="btn text"
            onclick={() => {
              action.run();
              dismissSnack();
            }}>{action.label}</button
          >
        {/if}
      </div>
    {/key}
  {/if}
{/if}

<style>
  .screen {
    min-height: 100dvh;
  }

  .screen.forward {
    animation: in-fwd 0.3s var(--ease);
  }

  .screen.back {
    animation: in-back 0.3s var(--ease);
  }

  .screen.tab {
    animation: in-tab 0.25s var(--ease);
  }

  @keyframes in-fwd {
    from {
      opacity: 0;
      transform: translateX(32px);
    }
  }

  @keyframes in-back {
    from {
      opacity: 0;
      transform: translateX(-32px);
    }
  }

  @keyframes in-tab {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }

  .error {
    position: fixed;
    top: calc(var(--safe-top) + 8px);
    left: 12px;
    right: 12px;
    z-index: 70;
    padding: 12px 16px;
    border-radius: 12px;
    background: var(--ec);
    color: var(--onec);
  }

  .snack {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: calc(var(--safe-bottom) + 16px);
    z-index: 70;
    min-height: 48px;
    padding: 4px 8px 4px 16px;
    border-radius: 4px;
    background: var(--inv);
    color: var(--inv-on);
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: var(--elev3);
    animation: snack 0.3s var(--ease);
    max-width: 560px;
    margin: 0 auto;
  }

  .snack .btn {
    color: var(--inv-p);
  }

  .snack.raised {
    bottom: calc(var(--nav-h) + var(--safe-bottom) + 12px);
  }

  @keyframes snack {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
  }
</style>
