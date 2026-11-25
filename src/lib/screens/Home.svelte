<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import PalaceRow from '../components/PalaceRow.svelte';
  import PlaceIconView from '../components/PlaceIconView.svelte';
  import NewPalaceSheet from '../components/NewPalaceSheet.svelte';
  import { createSample, db, getPalace, palacesOf, snoozeReview, splitCandidates } from '../store.svelte';
  import { nav, sessionRoute, type Route } from '../nav.svelte';
  import { lociCount, plural } from '../util';
  import { app, toast } from '../app.svelte';
  import { contentDue, dueLabel, isDue, palaceDue } from '../review';
  import { haptic } from '../haptics';
  import { syncReminders } from '../reminders';
  import type { Content, Palace } from '../types';

  interface DueItem {
    key: string;
    title: string;
    where: string;
    due: number;
    target: Palace | Content;
    route: Route;
    /** Clé de session (« c:<id> » / « p:<id> ») et nombre de cartes, pour estimer la durée. */
    skey: string;
    cards: number;
  }

  let creating = $state(false);

  const palaces = $derived([...db.palaces].sort((a, b) => b.updatedAt - a.updatedAt));
  const loose = $derived(palacesOf(undefined));
  const toSplit = $derived(splitCandidates());
  const collapsed = $derived(new Set(db.settings.collapsedPlaces ?? []));

  function toggle(id: string) {
    const set = new Set(db.settings.collapsedPlaces ?? []);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    db.settings.collapsedPlaces = [...set];
    haptic.tick();
  }
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
          skey: `c:${c.id}`,
          cards: Object.values(c.items).filter((i) => i.text).length,
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
          skey: `p:${p.id}`,
          cards: lociCount(p),
        });
      }
    }
    return out.sort((a, b) => a.due - b.due);
  });

  const dueNow = $derived(schedule.filter((d) => isDue(d.due)));
  const upcoming = $derived(schedule.find((d) => !isDue(d.due)));

  /**
   * Session du jour : on enchaîne les révisions dues, les plus en retard d'abord,
   * dans la limite d'environ 10 minutes (≈ 12 s par carte). Le reste attend demain.
   */
  const SECONDS_PER_CARD = 12;
  const session = $derived.by(() => {
    const out: DueItem[] = [];
    let secs = 0;
    for (const d of dueNow) {
      const cost = Math.max(1, d.cards) * SECONDS_PER_CARD;
      if (out.length && secs + cost > 600) break;
      out.push(d);
      secs += cost;
    }
    return { items: out, minutes: Math.max(1, Math.round(secs / 60)) };
  });

  function startSession() {
    const [first, ...rest] = session.items;
    if (first) nav.go(sessionRoute(first.skey, rest.map((r) => r.skey)));
  }

  function later() {
    for (const d of dueNow) snoozeReview(d.target);
    haptic.tap();
    toast('Révisions repoussées à demain');
    void syncReminders();
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
    {db.places.length ? plural(db.places.length, 'lieu', 'lieux') + ' · ' : ''}{plural(db.palaces.length, 'palais', 'palais')} · {plural(totalLoci, 'locus', 'loci')} · {plural(db.contents.length, 'contenu', 'contenus')}
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

  {#if toSplit.length && toSplit[0]}
    {@const c = toSplit[0]}
    <button class="banner card-outlined" onclick={() => nav.go({ name: 'palace', id: c.id })}>
      <Icon name="building" class="primary" />
      <span class="grow">
        <span class="title-m">« {c.name} » a {c.rooms.filter((r) => r.name).length} zones</span>
        <span class="body-m onv">
          En faire un lieu avec un palais par zone ?{toSplit.length > 1 ? ` (et ${toSplit.length - 1} autre${toSplit.length > 2 ? 's' : ''})` : ''}
        </span>
      </span>
      <Icon name="next" size={20} class="onv" />
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
      <p class="body-m dim session-info">
        Session du jour : {plural(session.items.length, 'révision', 'révisions')} · environ {session.minutes} min{dueNow.length >
        session.items.length
          ? ` · ${dueNow.length - session.items.length} pour demain`
          : ''}
      </p>
      <div class="row actions">
        <button class="btn filled has-icon" onclick={startSession}>
          <Icon name="play" size={18} />{session.items.length > 1 ? 'Tout réviser' : 'Réviser'}
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
    {#each db.places as l (l.id)}
      {@const list = palacesOf(l.id)}
      {@const isOpen = !collapsed.has(l.id)}
      <section class="place">
        <div class="ph">
          <button class="ph-main" onclick={() => nav.go({ name: 'place', id: l.id })}>
            <PlaceIconView icon={l.icon} />
            <span class="grow">
              <span class="title-m ellipsis" style="display: block">{l.name}</span>
              <span class="body-m onv">{plural(list.length, 'palais', 'palais')}</span>
            </span>
          </button>
          <button class="icon-btn" onclick={() => toggle(l.id)} aria-label={isOpen ? 'Replier' : 'Déplier'} aria-expanded={isOpen}>
            <Icon name={isOpen ? 'chevronUp' : 'chevronDown'} />
          </button>
        </div>
        {#if isOpen}
          {#each list as p (p.id)}
            <div class="sep"></div>
            <PalaceRow palace={p} nested />
          {:else}
            <div class="sep"></div>
            <button class="list-item add-in" onclick={() => nav.go({ name: 'place', id: l.id })}>
              <span class="body-m primary">+ Ajouter un palais dans ce lieu</span>
            </button>
          {/each}
        {/if}
      </section>
    {/each}

    {#if loose.length}
      <h2 class="subheader">{db.places.length ? 'Sans lieu' : 'Tous les palais'}</h2>
      {#each loose as p (p.id)}
        <PalaceRow palace={p} />
      {/each}
    {/if}
  {/if}
</div>

<button class="fab" onclick={() => (creating = true)}>
  <Icon name="plus" />Nouveau palais
</button>

<NewPalaceSheet bind:open={creating} />

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

  .place {
    margin: 12px 16px 0;
    background: var(--surface-low);
    border-radius: 20px;
    overflow: hidden;
  }

  .ph {
    display: flex;
    align-items: center;
    padding: 4px 4px 4px 0;
  }

  .ph-main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 0 10px 16px;
    text-align: left;
  }

  .sep {
    height: 1px;
    background: var(--divider);
    margin-left: 24px;
  }

  .add-in {
    padding-left: 24px;
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

  .session-info {
    margin-top: 6px;
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
