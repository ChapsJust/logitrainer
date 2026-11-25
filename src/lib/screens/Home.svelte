<script lang="ts">
  import Sheet from '../components/Sheet.svelte';
  import Icon from '../components/Icon.svelte';
  import Avatar from '../components/Avatar.svelte';
  import { createPalace, createSample, db, getPalace, snoozeReview } from '../store.svelte';
  import { nav, type Route } from '../nav.svelte';
  import { lociCount, plural } from '../util';
  import { app, toast } from '../app.svelte';
  import { contentDue, dueLabel, isDue, palaceDue } from '../review';
  import { haptic } from '../haptics';
  import { syncReminders } from '../reminders';
  import type { Content, Palace } from '../types';
  import { OCCUPANCY_LABEL, palaceUse } from '../interference';

  interface DueItem {
    key: string;
    title: string;
    where: string;
    due: number;
    target: Palace | Content;
    route: Route;
  }

  let creating = $state(false);
  let name = $state('');

  const palaces = $derived([...db.palaces].sort((a, b) => b.updatedAt - a.updatedAt));
  const totalLoci = $derived(db.palaces.reduce((s, p) => s + lociCount(p), 0));

  const schedule = $derived.by((): DueItem[] => {
    const out: DueItem[] = [];
    for (const c of db.contents) {
      const p = getPalace(c.palaceId);
      const due = contentDue(c, p);
      if (due !== null && p) {
        out.push({
          key: c.id,
          title: c.title,
          where: p.name,
          due,
          target: c,
          route: { name: 'quiz', kind: 'content', id: c.id, order: 'forward' },
        });
      }
    }
    for (const p of db.palaces) {
      const due = palaceDue(p);
      if (due !== null) {
        out.push({
          key: p.id,
          title: `Trajet · ${p.name}`,
          where: plural(lociCount(p), 'locus', 'loci'),
          due,
          target: p,
          route: { name: 'quiz', kind: 'trajet', id: p.id, order: 'forward' },
        });
      }
    }
    return out.sort((a, b) => a.due - b.due);
  });

  const dueNow = $derived(schedule.filter((d) => isDue(d.due)));
  const upcoming = $derived(schedule.find((d) => !isDue(d.due)));

  function later() {
    for (const d of dueNow) snoozeReview(d.target);
    haptic.tap();
    toast('Révisions repoussées à demain');
    void syncReminders();
  }

  function create() {
    const p = createPalace(name, '');
    creating = false;
    name = '';
    nav.go({ name: 'palace', id: p.id });
  }
</script>

<div class="page">
  <div class="top">
    <button class="searchbar st" onclick={() => nav.switchTab('search')}>
      <Icon name="search" />
      <span class="body-l">Rechercher dans Logidex</span>
    </button>
  </div>

  <h1 class="headline-m page-title">Mes palais</h1>
  <p class="body-m page-sub">
    {plural(db.palaces.length, 'palais', 'palais')} · {plural(totalLoci, 'locus', 'loci')} · {plural(db.contents.length, 'contenu', 'contenus')}
  </p>

  {#if app.update}
    <button class="banner card-outlined" onclick={() => nav.switchTab('settings')}>
      <Icon name="download" class="primary" />
      <span class="grow">
        <span class="title-m">Version {app.update.version} disponible</span>
        <span class="body-m onv">Touche pour l'installer</span>
      </span>
    </button>
  {/if}

  {#if db.settings.autoBackupError}
    <button class="banner card-outlined" onclick={() => nav.switchTab('settings')}>
      <Icon name="shield" style="color: var(--error)" />
      <span class="grow">
        <span class="title-m">Sauvegarde automatique en échec</span>
        <span class="body-m onv">Fais un export manuel dans Réglages</span>
      </span>
    </button>
  {/if}

  {#if dueNow.length > 0}
    <section class="card-tonal due">
      <p class="label-m caps">À revoir aujourd'hui</p>
      {#each dueNow.slice(0, 4) as d (d.key)}
        <button class="due-row" onclick={() => nav.go(d.route)}>
          <span class="grow">
            <span class="title-m ellipsis">{d.title}</span>
            <span class="body-m dim ellipsis">{d.where} · {dueLabel(d.due)}</span>
          </span>
          <span class="play"><Icon name="play" size={18} /></span>
        </button>
      {/each}
      {#if dueNow.length > 4}
        <p class="body-m dim">et {dueNow.length - 4} autre(s)…</p>
      {/if}
      <div class="row actions">
        <button class="btn filled has-icon" onclick={() => dueNow[0] && nav.go(dueNow[0].route)}>
          <Icon name="play" size={18} />Réviser
        </button>
        <button class="btn text" onclick={later}>Plus tard</button>
      </div>
    </section>
  {:else if upcoming}
    <p class="body-m onv next"><Icon name="calendar" size={18} />Prochaine révision : <b>{upcoming.title}</b>, {dueLabel(upcoming.due)}</p>
  {/if}

  {#if palaces.length === 0}
    <div class="empty">
      <div class="art"><Icon name="door" size={32} /></div>
      <p class="title-m" style="color: var(--on)">Aucun palais pour l'instant</p>
      <p class="body-m" style="margin: 6px 0 20px">Crée ton premier trajet, ou ouvre un exemple pour voir comment ça marche.</p>
      <div class="row" style="justify-content: center">
        <button class="btn filled" onclick={() => (creating = true)}>Créer un palais</button>
        <button class="btn outlined" onclick={() => nav.go({ name: 'palace', id: createSample().id })}>Voir un exemple</button>
      </div>
    </div>
  {:else}
    <h2 class="subheader">Tous les palais</h2>
    {#each palaces as p (p.id)}
      {@const use = palaceUse(p)}
      {@const nr = p.rooms.filter((r) => r.name).length}
      <button class="list-item two" onclick={() => nav.go({ name: 'palace', id: p.id })}>
        <Avatar id={p.id} name={p.name} />
        <span class="li-text">
          <span class="li-head ellipsis">{p.name}</span>
          <span class="li-sup ellipsis">
            {plural(lociCount(p), 'locus', 'loci')}{nr ? ' · ' + plural(nr, 'pièce', 'pièces') : ''}{use.active.length
              ? ' · ' + plural(use.active.length, 'contenu actif', 'contenus actifs')
              : ''}
          </span>
        </span>
        <span class="spill {use.state}">
          {#if use.state === 'mixed'}<Icon name="alert" size={14} stroke={2.2} />{/if}{OCCUPANCY_LABEL[use.state]}
        </span>
      </button>
    {/each}
  {/if}
</div>

<button class="fab" onclick={() => (creating = true)}>
  <Icon name="plus" />Nouveau palais
</button>

<Sheet bind:open={creating} title="Nouveau palais">
  <form
    onsubmit={(e) => {
      e.preventDefault();
      create();
    }}
  >
    <label class="tf">
      <span>Nom du lieu</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={name} placeholder="Ex. Maison de mes parents" autofocus enterkeyhint="done" />
    </label>
    <p class="helper">Un lieu que tu connais par cœur : maison, école, trajet quotidien…</p>
    <div class="row" style="justify-content: flex-end">
      <button class="btn text" type="button" onclick={() => (creating = false)}>Annuler</button>
      <button class="btn filled" type="submit">Créer</button>
    </div>
  </form>
</Sheet>

<style>
  .top {
    padding: calc(var(--safe-top) + 8px) 16px 8px;
    position: sticky;
    top: 0;
    z-index: 30;
    background: var(--surface);
  }

  .searchbar {
    width: 100%;
    height: 56px;
    border-radius: 28px;
    background: var(--surface-high);
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 20px;
    color: var(--onv);
  }

  .page-title {
    padding-top: 16px;
  }

  .banner {
    display: flex;
    align-items: center;
    gap: 16px;
    margin: 16px 16px 0;
    width: calc(100% - 32px);
    text-align: left;
  }

  .banner .grow {
    display: flex;
    flex-direction: column;
  }

  .due {
    margin: 16px 16px 0;
  }

  .caps {
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.8;
    margin-bottom: 4px;
  }

  .due-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px 0;
    text-align: left;
  }

  .due-row .grow {
    display: flex;
    flex-direction: column;
  }

  .dim {
    opacity: 0.8;
  }

  .play {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--surface-low);
    color: var(--p);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .actions {
    margin-top: 10px;
    gap: 4px;
  }

  .next {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 16px 0;
  }

  .next b {
    font-weight: 500;
    color: var(--on);
  }
</style>
