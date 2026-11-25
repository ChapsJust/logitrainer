<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import { db, getPalace } from '../store.svelte';
  import { nav, type Route } from '../nav.svelte';
  import { flatLoci, normalize } from '../util';

  interface Hit {
    key: string;
    icon: string;
    title: string;
    detail: string;
    route: Route;
  }

  let query = $state('');

  const hits = $derived.by((): Hit[] => {
    const q = normalize(query);
    if (q.length < 2) return [];
    const match = (...s: (string | undefined)[]) => s.some((x) => x && normalize(x).includes(q));
    const out: Hit[] = [];

    for (const p of db.palaces) {
      if (match(p.name, p.description)) {
        out.push({ key: p.id, icon: p.emoji, title: p.name, detail: 'Palais', route: { name: 'palace', id: p.id } });
      }
      for (const f of flatLoci(p)) {
        if (match(f.locus.name, f.locus.description, f.room.name)) {
          out.push({
            key: f.locus.id,
            icon: '📍',
            title: `${f.n}. ${f.locus.name}`,
            detail: `${p.emoji} ${p.name}${f.room.name ? ' · ' + f.room.name : ''}`,
            route: { name: 'palace', id: p.id, tab: 'trajet' },
          });
        }
      }
    }

    for (const c of db.contents) {
      const p = getPalace(c.palaceId);
      if (!p) continue;
      if (match(c.title, c.notes)) {
        out.push({ key: c.id, icon: '📦', title: c.title, detail: `Contenu · ${p.emoji} ${p.name}`, route: { name: 'content', id: c.id } });
      }
      for (const f of flatLoci(p)) {
        const item = c.items[f.locus.id];
        if (item && match(item.text, item.image)) {
          out.push({
            key: c.id + f.locus.id,
            icon: '💡',
            title: item.text,
            detail: `${c.title} · n° ${f.n} ${f.locus.name}`,
            route: { name: 'content', id: c.id },
          });
        }
      }
    }

    for (const [k, v] of Object.entries(db.numbers)) {
      if (match(v) || k === query.trim()) {
        out.push({ key: 'n' + k, icon: '🔢', title: `${k} → ${v}`, detail: 'Système de nombres', route: { name: 'numbers' } });
      }
    }
    return out.slice(0, 200);
  });

  function open(route: Route) {
    if (route.name === 'numbers') nav.switchTab('numbers');
    else nav.go(route);
  }
</script>

<TopBar title="Recherche" />

<div class="page">
  <!-- svelte-ignore a11y_autofocus -->
  <input
    class="input search"
    type="search"
    bind:value={query}
    placeholder="Chercher un palais, un locus, une info…"
    autofocus
    enterkeyhint="search"
  />

  {#if query.trim().length >= 2}
    <p class="muted small count">{hits.length} résultat(s)</p>
    <div class="card list">
      {#each hits as h (h.key)}
        <button class="hit" onclick={() => open(h.route)}>
          <span class="icon">{h.icon}</span>
          <span class="grow text">
            <span class="ellipsis title">{h.title}</span>
            <span class="muted small ellipsis">{h.detail}</span>
          </span>
        </button>
      {:else}
        <p class="muted empty">Aucun résultat.</p>
      {/each}
    </div>
  {:else}
    <p class="muted small hint">
      Tu cherches où tu as rangé quelque chose ? Tape un mot : la recherche fouille tous tes palais, loci, contenus et
      nombres.
    </p>
  {/if}
</div>

<style>
  .search {
    margin-bottom: 12px;
  }

  .count,
  .hint {
    margin: 0 4px 8px;
  }

  .list {
    overflow: hidden;
  }

  .hit {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }

  .hit:active {
    background: var(--surface-2);
  }

  .icon {
    font-size: 1.4rem;
  }

  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .title {
    font-weight: 600;
  }
</style>
