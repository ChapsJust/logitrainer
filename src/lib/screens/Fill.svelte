<script lang="ts">
  /**
   * Remplir pas à pas : un locus à la fois, en plein écran.
   * Entrée = enregistrer et passer au suivant. Pensé pour aller vite, sans fenêtres.
   */
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';
  import ImageWorkshop from '../components/ImageWorkshop.svelte';
  import { addLocus, filledCount, getContent, getPalace, setItem } from '../store.svelte';
  import { nav } from '../nav.svelte';
  import { flatLoci } from '../util';
  import { haptic } from '../haptics';
  import { ensureMicPermission, listen, speechAvailable, type Listening } from '../speech';
  import { toast } from '../app.svelte';

  let { id, start }: { id: string; start?: number } = $props();

  const content = $derived(getContent(id));
  const palace = $derived(content ? getPalace(content.palaceId) : undefined);
  const flat = $derived(palace ? flatLoci(palace) : []);

  function firstEmpty(): number {
    const c = getContent(id);
    const p = c ? getPalace(c.palaceId) : undefined;
    if (!c || !p) return 0;
    const i = flatLoci(p).findIndex((f) => !c.items[f.locus.id]?.text);
    return i < 0 ? 0 : i;
  }

  // svelte-ignore state_referenced_locally
  let index = $state(start ?? firstEmpty());
  let text = $state('');
  let image = $state('');
  let dir = $state<1 | -1>(1);
  let input: HTMLTextAreaElement | undefined = $state();
  let extraName = $state('');

  const step = $derived(flat[index]);
  const done = $derived(index >= flat.length);
  const next = $derived(flat[index + 1]);

  function load(i: number) {
    const f = flat[i];
    text = (f && content?.items[f.locus.id]?.text) || '';
    image = (f && content?.items[f.locus.id]?.image) || '';
  }
  // svelte-ignore state_referenced_locally
  load(index);

  function save() {
    const f = flat[index];
    if (!f || !content) return;
    const prev = content.items[f.locus.id];
    if ((prev?.text ?? '') !== text.trim() || (prev?.image ?? '') !== image.trim()) {
      setItem(content, f.locus.id, { text, image });
    }
  }

  function go(i: number) {
    save();
    session?.stop();
    if (i < 0) return;
    dir = i > index ? 1 : -1;
    index = Math.min(i, flat.length);
    load(index);
    haptic.tick();
    if (!done) setTimeout(() => input?.focus(), 60);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      go(index + 1);
    }
  }

  /* ---------- Dicter ---------- */
  let canSpeak = $state(false);
  void speechAvailable().then((v) => (canSpeak = v));
  let listening = $state(false);
  let session: Listening | null = null;

  async function dictate() {
    if (listening) {
      session?.stop();
      return;
    }
    if (!(await ensureMicPermission())) {
      toast('Micro non autorisé');
      return;
    }
    listening = true;
    haptic.medium();
    const before = text;
    session = listen((t) => (text = before ? `${before} ${t}` : t));
    const alts = await session.done;
    session = null;
    listening = false;
    if (alts[0]) text = before ? `${before} ${alts[0]}` : alts[0];
  }

  /* ---------- Fin : ajouter un locus pour continuer ---------- */
  function addMore() {
    if (!palace || !extraName.trim()) return;
    const room = palace.rooms[palace.rooms.length - 1];
    if (!room) return;
    addLocus(palace, room, extraName);
    extraName = '';
    index = flat.length - 1;
    load(index);
    setTimeout(() => input?.focus(), 60);
  }

  $effect(() => {
    // Enregistre en quittant l'écran (retour, geste Android…).
    return () => {
      save();
      session?.stop();
    };
  });
</script>

{#if content && palace}
  <TopBar back navIcon="x" title={content.title}>
    {#snippet actions()}
      {#if !done}<span class="label-l onv count">{index + 1} / {flat.length}</span>{/if}
    {/snippet}
  </TopBar>

  <div class="page no-nav">
    <div class="px"><div class="progress"><span style:width="{(filledCount(content, palace) / Math.max(flat.length, 1)) * 100}%"></span></div></div>

    {#if done}
      <div class="end">
        <div class="medal"><Icon name="check" size={36} /></div>
        <p class="headline-s">{filledCount(content, palace)} / {flat.length} placés</p>
        <p class="body-l onv">Tu es arrivé au bout du palais.</p>
      </div>
      <form
        class="more px"
        onsubmit={(e) => {
          e.preventDefault();
          addMore();
        }}
      >
        <label class="tf" style="margin: 0">
          <span>Il t'en faut plus ? Ajoute un locus au trajet</span>
          <input bind:value={extraName} placeholder="Ex. la fenêtre du salon" enterkeyhint="go" />
        </label>
      </form>
      <div class="stack px" style="margin-top: 16px">
        {#if extraName.trim()}
          <button class="btn tonal lg block" onclick={addMore}>Ajouter et continuer</button>
        {/if}
        <button class="btn filled lg block" onclick={() => nav.replace({ name: 'quiz', kind: 'content', id: content.id, order: 'forward' })}>
          Tester maintenant
        </button>
        <button class="btn text lg block" onclick={() => nav.back()}>Terminé</button>
      </div>
    {:else if step}
      {#key index}
        <div class="card" class:from-left={dir === -1}>
          <div class="row">
            <span class="chip plain selected">Locus {step.n}</span>
            {#if step.room.name}<span class="chip plain">{step.room.name}</span>{/if}
          </div>
          <p class="place">{step.locus.name || 'Sans nom'}</p>
          {#if step.locus.description}<p class="body-l onv">{step.locus.description}</p>{/if}

          <label class="tf big" style="margin: 16px 0 12px">
            <span>Qu'est-ce que tu ranges ici ?</span>
            <!-- svelte-ignore a11y_autofocus -->
            <textarea bind:this={input} bind:value={text} rows="1" onkeydown={onKey} enterkeyhint="next" autofocus
              placeholder={listening ? 'Je t’écoute…' : ''}></textarea>
          </label>
          <label class="tf">
            <span>Image mentale (facultatif)</span>
            <textarea bind:value={image} rows="2" placeholder="Fais interagir l'élément avec le lieu"></textarea>
          </label>
          <div class="tools">
            {#if canSpeak}
              <button class="chip" class:selected={listening} onclick={dictate}>
                <Icon name="mic" />{listening ? 'Terminer' : 'Dicter'}
              </button>
            {/if}
          </div>
          <ImageWorkshop
            element={text}
            bind:image
            locusId={step.locus.id}
            locus={step.locus.name}
            locusDescription={step.locus.description}
            room={step.room.name}
            contentTitle={content.title}
          />
        </div>
      {/key}

      {#if next}
        <button class="next body-m" onclick={() => go(index + 1)}>
          <Icon name="next" size={18} />Ensuite : <b>{next.n}. {next.locus.name}</b><span class="onv">· Entrée pour continuer</span>
        </button>
      {/if}

      <div class="actions px">
        <button class="btn tonal lg" disabled={index === 0} onclick={() => go(index - 1)} aria-label="Précédent">
          <Icon name="back" size={20} />
        </button>
        <button class="btn filled lg grow" onclick={() => go(index + 1)}>
          {index === flat.length - 1 ? 'Terminer' : text.trim() ? 'Suivant' : 'Passer'}
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .count {
    padding-right: 16px;
  }

  .card {
    margin: 12px 16px 0;
    background: var(--surface-low);
    border-radius: 28px;
    padding: 20px 20px 12px;
    animation: in-right 0.25s var(--ease);
  }

  .card.from-left {
    animation-name: in-left;
  }

  @keyframes in-right {
    from {
      opacity: 0;
      transform: translateX(32px);
    }
  }

  @keyframes in-left {
    from {
      opacity: 0;
      transform: translateX(-32px);
    }
  }

  .place {
    font-size: 34px;
    line-height: 42px;
    margin-top: 14px;
    overflow-wrap: anywhere;
  }

  .tf.big textarea {
    font-size: 20px;
    line-height: 28px;
  }

  .tools {
    display: flex;
    gap: 8px;
    margin: -4px 0 12px;
  }

  .next {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 12px 16px 0;
    padding: 12px 14px;
    border: 1px dashed var(--outline);
    border-radius: 16px;
    width: calc(100% - 32px);
    text-align: left;
    color: var(--onv);
    flex-wrap: wrap;
  }

  .next b {
    color: var(--on);
    font-weight: 500;
  }

  .actions {
    display: flex;
    gap: 12px;
    margin-top: 16px;
  }

  .actions .btn:first-child {
    width: 72px;
    padding: 0;
  }

  .end {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
    padding: 32px 24px 24px;
  }

  .medal {
    width: 80px;
    height: 80px;
    border-radius: 28px;
    background: var(--pc);
    color: var(--onpc);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }
</style>
