<script lang="ts">
  /**
   * Rappel libre : réciter (ou écrire) tout le palais dans l'ordre, sans voir les loci.
   * C'est le test le plus exigeant — et le plus proche d'un examen.
   */
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';
  import { getContent, getPalace, itemParts, recordQuiz } from '../store.svelte';
  import { nav } from '../nav.svelte';
  import { flatLoci } from '../util';
  import { freeRecall, type RecallStatus } from '../match';
  import { ensureMicPermission, listenLong, speechAvailable, type Listening } from '../speech';
  import { haptic } from '../haptics';
  import { dueLabel } from '../review';
  import { syncReminders } from '../reminders';
  import { toast } from '../app.svelte';

  let { kind, id }: { kind: 'trajet' | 'content'; id: string } = $props();

  interface Entry {
    locusId: string;
    n: number;
    locus: string;
    text: string;
  }

  function build(): { title: string; entries: Entry[] } {
    if (kind === 'content') {
      const c = getContent(id);
      const p = c ? getPalace(c.palaceId) : undefined;
      if (!c || !p) return { title: '', entries: [] };
      const entries = flatLoci(p).flatMap((f) =>
        itemParts(c.items[f.locus.id]).map((t) => ({ locusId: f.locus.id, n: f.n, locus: f.locus.name, text: t })),
      );
      return { title: c.title, entries };
    }
    const p = getPalace(id);
    if (!p) return { title: '', entries: [] };
    return { title: p.name, entries: flatLoci(p).map((f) => ({ locusId: f.locus.id, n: f.n, locus: '', text: f.locus.name })) };
  }

  // svelte-ignore state_referenced_locally
  const { title, entries } = build();

  let text = $state('');
  let listening = $state(false);
  let canSpeak = $state(false);
  void speechAvailable().then((v) => (canSpeak = v));
  let session: Listening | null = null;
  let statuses = $state<RecallStatus[] | null>(null);
  let nextDue = $state<number | null>(null);

  async function dictate() {
    if (listening) {
      session?.stop();
      return;
    }
    if (!(await ensureMicPermission())) {
      toast('Micro non autorisé : écris ta récitation.');
      return;
    }
    listening = true;
    haptic.medium();
    const before = text;
    session = listenLong((t) => (text = before ? `${before} ${t}` : t), 600_000);
    const alts = await session.done;
    session = null;
    listening = false;
    if (alts[0]) text = before ? `${before} ${alts[0]}` : alts[0];
  }

  function check() {
    session?.stop();
    statuses = freeRecall(
      entries.map((e) => e.text),
      text.replace(/\n/g, ' '),
    );
    haptic.success();
    // Note par locus : tout à sa place = su ; trouvé mais pas dans l'ordre = à moitié.
    const byLocus = new Map<string, RecallStatus[]>();
    entries.forEach((e, i) => byLocus.set(e.locusId, [...(byLocus.get(e.locusId) ?? []), statuses![i]!]));
    const cards = [...byLocus].map(([key, st]) => ({
      key,
      grade: st.every((s) => s === 'ok') ? ('known' as const) : st.some((s) => s !== 'missing') ? ('partial' as const) : ('missed' as const),
    }));
    const target = kind === 'content' ? getContent(id) : getPalace(id);
    if (target) {
      const score = statuses.reduce((s, x) => s + (x === 'ok' ? 1 : x === 'order' ? 0.5 : 0), 0);
      recordQuiz(target, { at: Date.now(), score, total: entries.length, mode: 'recall' }, cards);
      nextDue = target.review?.due ?? null;
      void syncReminders();
    }
  }

  const ok = $derived(statuses?.filter((s) => s === 'ok').length ?? 0);
  const order = $derived(statuses?.filter((s) => s === 'order').length ?? 0);
  const fmt = (n: number) => String(n).replace('.', ',');

  $effect(() => () => session?.stop());
</script>

<TopBar back navIcon="x" title="Rappel libre" />

<div class="page no-nav">
  {#if entries.length === 0}
    <div class="empty"><p class="body-m">Rien à réciter pour l'instant.</p></div>
  {:else if !statuses}
    <div class="card-tonal intro">
      <p class="title-m">{title}</p>
      <p class="body-m" style="margin-top: 4px">
        Fais le trajet dans ta tête et récite les {entries.length} éléments <b>dans l'ordre</b>, sans regarder. Prends ton temps :
        les pauses ne coupent pas l'écoute.
      </p>
    </div>

    {#if listening}
      <div class="listening">
        <span class="mic-pulse"><Icon name="mic" size={28} /></span>
        <p class="label-l onv">Je t'écoute… touche « J'ai fini » quand tu as tout dit</p>
      </div>
    {/if}

    <label class="tf box">
      <span>{text ? 'Ta récitation (tu peux corriger)' : 'Écris ou dicte ta récitation'}</span>
      <textarea bind:value={text} rows="7" placeholder="Ex. hydrogène, hélium, lithium…"></textarea>
    </label>

    <div class="actions px">
      {#if canSpeak}
        <button class="btn lg has-icon" class:filled={!listening && !text} class:tonal={listening || !!text} onclick={dictate}>
          <Icon name="mic" size={20} />{listening ? "J'ai fini" : text ? 'Continuer' : 'Réciter'}
        </button>
      {/if}
      <button class="btn filled lg grow" disabled={!text.trim() || listening} onclick={check}>Comparer</button>
    </div>
  {:else}
    <div class="result">
      <p class="headline-l">{fmt(ok + order / 2)} / {entries.length}</p>
      <p class="body-l onv">
        {ok} à leur place{order ? `, ${order} pas dans l'ordre` : ''}, {entries.length - ok - order} oublié{entries.length - ok - order > 1 ? 's' : ''}
      </p>
      {#if nextDue !== null}<p class="chip plain next"><Icon name="calendar" size={18} />Prochaine révision {dueLabel(nextDue)}</p>{/if}
    </div>
    <div style="height: 8px"></div>
    {#each entries as e, i (i)}
      {@const st = statuses[i]}
      <div class="list-item two">
        <span class="num st {st}">{st === 'ok' ? '✓' : st === 'order' ? '↕' : '✗'}</span>
        <span class="li-text">
          <span class="li-over">{e.n}{e.locus ? ` · ${e.locus}` : ''}</span>
          <span class="li-head">{e.text}</span>
          {#if st !== 'ok'}<span class="li-sup">{st === 'order' ? "Dit, mais pas à sa place dans l'ordre" : 'Oublié'}</span>{/if}
        </span>
      </div>
    {/each}
    <div class="stack px" style="margin-top: 20px">
      <button class="btn outlined lg block" onclick={() => ((statuses = null), (text = ''))}>Recommencer</button>
      <button class="btn text lg block" onclick={() => nav.back()}>Fermer</button>
    </div>
  {/if}
</div>

<style>
  .intro {
    margin: 8px 16px 0;
  }

  .box {
    margin: 16px 16px 0;
  }

  .actions {
    display: flex;
    gap: 10px;
    margin-top: 16px;
  }

  .listening {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    margin-top: 20px;
    text-align: center;
  }

  .mic-pulse {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--p);
    color: var(--onp);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pulse 1.4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--p) 45%, transparent);
    }
    50% {
      box-shadow: 0 0 0 16px color-mix(in srgb, var(--p) 0%, transparent);
    }
  }

  .result {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 28px 24px 0;
    text-align: center;
  }

  .next {
    margin-top: 6px;
    padding-left: 12px;
  }

  .st {
    font-weight: 700;
  }

  .st.ok {
    background: var(--pc);
    color: var(--onpc);
  }

  .st.order {
    background: var(--warn-c);
    color: var(--onwarn-c);
  }

  .st.missing {
    background: var(--ec);
    color: var(--onec);
  }
</style>
