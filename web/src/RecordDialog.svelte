<script>
  import Icon from './Icon.svelte';
  import Photo from './Photo.svelte';
  import { euro } from './api.js';
  let { source, onclose } = $props();
  let dialog = $state();
  let entries = $derived.by(() => {
    if (!source) return [];
    try { return Object.entries(JSON.parse(source.fragmento)); } catch { return []; }
  });
  $effect(() => { if (source && dialog && !dialog.open) dialog.showModal(); });
</script>

<dialog bind:this={dialog} onclose={onclose} aria-labelledby="dialog-title">
  <div class="dialog-header"><h2 id="dialog-title">{source?.registro_id} · Registro de origen</h2><button class="btn" aria-label="Cerrar detalle" onclick={() => dialog.close()}><Icon name="i-close" /></button></div>
  {#if source}
    <div class="dialog-content"><div class="dialog-origin">{source.documento} · Datos ficticios</div>
      {#if source.documento === 'prendas.csv' && source.registro_id.startsWith('PRE')}
        <figure class="record-photo"><Photo id={source.registro_id} title={entries.find(([key]) => key === 'titulo')?.[1] ?? source.registro_id} /><figcaption>Foto de ejemplo generada con IA.</figcaption></figure>
      {/if}
      {#if entries.length}
        <dl class="detail-list">{#each entries as [key, value]}<div class="detail-pair"><dt>{key.replaceAll('_', ' ')}</dt><dd>{key.endsWith('_eur') ? euro(value) : value}</dd></div>{/each}</dl>
      {:else}<p class="schema-text">{source.fragmento}</p>{/if}
      <p class="dialog-note">Fuente de la colección. Los alias no acreditan la identidad de los vendedores.</p>
    </div>
  {/if}
</dialog>
