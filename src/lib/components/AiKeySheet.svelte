<script lang="ts">
  import Sheet from './Sheet.svelte';
  import Icon from './Icon.svelte';
  import { aiState, saveAiKey } from '../ai-key.svelte';
  import { openExternal } from '../update';
  import { toast } from '../app.svelte';

  let { open = $bindable(), onsaved }: { open: boolean; onsaved?: () => void } = $props();
  let key = $state('');
  let show = $state(false);

  async function save() {
    if (!key.trim().startsWith('sk-ant-')) {
      toast('Une clé Anthropic commence par « sk-ant- ».');
      return;
    }
    await saveAiKey(key);
    key = '';
    open = false;
    toast('Suggestions activées');
    onsaved?.();
  }
</script>

<Sheet bind:open title="Suggestions d'images">
  <div class="intro">
    <div class="art"><Icon name="sparkle" size={28} /></div>
    <p class="body-m">
      Claude propose 3 images mentales qui font <b>interagir</b> l'élément avec ton locus. Tu choisis, tu modifies : c'est
      toujours toi qui décides.
    </p>
  </div>
  <ul class="facts body-m onv">
    <li><Icon name="key" size={18} />Fonctionne avec ta propre clé API Anthropic, environ 1 ¢ par demande.</li>
    <li><Icon name="shield" size={18} />Seuls l'élément, le locus et tes images de nombres concernées sont envoyés.</li>
    <li><Icon name="door" size={18} />La clé reste sur ce téléphone, jamais dans les sauvegardes.</li>
  </ul>

  {#if aiState.hasKey}
    <p class="body-m ok"><Icon name="check2" size={18} />Une clé est enregistrée.</p>
  {/if}

  <label class="tf">
    <span>{aiState.hasKey ? 'Remplacer la clé' : 'Clé API'}</span>
    <div class="row">
      <input
        class="grow"
        type={show ? 'text' : 'password'}
        bind:value={key}
        placeholder="sk-ant-…"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
      />
      <button type="button" class="icon-btn" style="width: 36px; height: 36px" onclick={() => (show = !show)} aria-label="Afficher">
        <Icon name={show ? 'eyeOff' : 'eye'} size={20} />
      </button>
    </div>
  </label>
  <button class="btn text has-icon" style="margin: -8px 0 0 -12px" onclick={() => openExternal('https://console.anthropic.com/settings/keys')}>
    <Icon name="forward" size={18} />Obtenir une clé
  </button>

  {#snippet footer()}
    {#if aiState.hasKey}
      <button
        class="btn text danger-text"
        onclick={async () => {
          await saveAiKey('');
          open = false;
          toast('Clé supprimée');
        }}>Supprimer la clé</button
      >
      <span class="grow"></span>
    {/if}
    <button class="btn text" onclick={() => (open = false)}>Fermer</button>
    <button class="btn filled" disabled={!key.trim()} onclick={save}>Enregistrer</button>
  {/snippet}
</Sheet>

<style>
  .intro {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }

  .art {
    width: 56px;
    height: 56px;
    border-radius: 18px;
    background: var(--pc);
    color: var(--onpc);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .facts {
    list-style: none;
    padding: 0;
    margin: 16px 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .facts li,
  .ok {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .ok {
    color: var(--p);
    margin-bottom: 12px;
  }
</style>
