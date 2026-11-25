<script lang="ts">
  import Icon, { type IconName } from '../components/Icon.svelte';
  import { db, getPalace } from '../store.svelte';
  import { nav, type Route } from '../nav.svelte';
  import { flatLoci, normalize } from '../util';

  interface Hit {
    key: string;
    icon: IconName;
    title: string;
    detail: string;
    route: Route;
  }

  let query = $state('');
  let input: HTMLInputElement | undefined = $state();

  $effect(() => {
    // Ouvre le clavier directement.
    setTimeout(() => input?.focus(), 250);
  });

  const hits = $derived.by((): Hit[] => {
    const q = normalize(query);
    if (q.length < 2) return [];
    const match = (...s: (string | undefined)[]) => s.some((x) => x && normalize(x).includes(q));
    const out: Hit[] = [];

    for (const l of db.places) {
      if (match(l.name)) out.push({ key: l.id, icon: 'building', title: l.name, detail: 'Lieu', route: { name: 'place', id: l.id } });
    }

    for (const p of db.palaces) {
      if (match(p.name, p.description, p.subject)) {
        out.push({
          key: p.id,
          icon: 'home',
          title: p.name,
          detail: p.subject ? `Palais · ${p.subject}` : 'Palais',
          route: { name: 'palace', id: p.id },
        });
      }
      for (const f of flatLoci(p)) {
        if (match(f.locus.name, f.locus.description, f.room.name)) {
          out.push({
            key: f.locus.id,
            icon: 'door',
            title: `${f.n}. ${f.locus.name}`,
            detail: `${p.name}${f.room.name ? ' · ' + f.room.name : ''}`,
            route: { name: 'palace', id: p.id, tab: 'trajet', focus: f.locus.id },
          });
        }
      }
    }

    for (const c of db.contents) {
      const p = getPalace(c.palaceId);
      if (!p) continue;
      if (match(c.title, c.notes)) {
        out.push({ key: c.id, icon: 'book', title: c.title, detail: `Contenu · ${p.name}`, route: { name: 'content', id: c.id } });
      }
      for (const f of flatLoci(p)) {
        const item = c.items[f.locus.id];
        if (item && match(item.text, item.image)) {
          out.push({
            key: c.id + f.locus.id,
            icon: 'sparkle',
            title: item.text,
            detail: `${c.title} · ${f.n}. ${f.locus.name}`,
            route: { name: 'content', id: c.id, focus: f.locus.id },
          });
        }
      }
    }

    for (const [k, v] of Object.entries(db.numbers)) {
      if (match(v) || k === query.trim()) {
        out.push({ key: 'n' + k, icon: 'hash', title: `${k} · ${v}`, detail: 'Système de nombres', route: { name: 'numbers' } });
      }
    }
    return out.slice(0, 200);
  });

  function open(route: Route) {
    if (route.name === 'numbers') nav.switchTab('numbers');
    else nav.go(route);
  }
</script>

<div class="page">
  <div class="top">
    <label class="searchbar">
      <Icon name="search" />
      <input
        bind:this={input}
        class="body-l grow"
        type="search"
        bind:value={query}
        placeholder="Lieu, palais, locus, info…"
        enterkeyhint="search"
      />
      {#if query}
        <button class="icon-btn" onclick={() => ((query = ''), input?.focus())} aria-label="Effacer"><Icon name="x" /></button>
      {/if}
    </label>
  </div>

  {#if query.trim().length >= 2}
    <p class="label-l onv px count">{hits.length} résultat{hits.length > 1 ? 's' : ''}</p>
    {#each hits as h (h.key)}
      <button class="list-item two" onclick={() => open(h.route)}>
        <span class="num"><Icon name={h.icon} size={20} /></span>
        <span class="li-text">
          <span class="li-head ellipsis">{h.title}</span>
          <span class="li-sup ellipsis">{h.detail}</span>
        </span>
      </button>
    {:else}
      <div class="empty">
        <div class="art"><Icon name="search" size={32} /></div>
        <p class="body-m">Aucun résultat pour « {query} »</p>
      </div>
    {/each}
  {:else}
    <div class="empty">
      <div class="art"><Icon name="search" size={32} /></div>
      <p class="title-m" style="color: var(--on)">Retrouve n'importe quoi</p>
      <p class="body-m" style="margin-top: 6px">La recherche fouille tous tes palais, loci, contenus et nombres.</p>
    </div>
  {/if}
</div>

<style>
  .top {
    padding: calc(var(--safe-top) + 8px) 16px 8px;
    position: sticky;
    top: 0;
    z-index: 30;
    background: var(--surface);
  }

  .searchbar {
    height: 56px;
    border-radius: 28px;
    background: var(--surface-high);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 4px 0 20px;
    color: var(--onv);
  }

  .searchbar input {
    border: none;
    outline: none;
    background: transparent;
    height: 48px;
    color: var(--on);
    min-width: 0;
  }

  .searchbar input::-webkit-search-cancel-button {
    display: none;
  }

  .count {
    padding-top: 8px;
    padding-bottom: 4px;
  }
</style>
