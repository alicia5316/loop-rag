<script>
  import Icon from './Icon.svelte';
  import Photo from './Photo.svelte';
  import { euro } from './api.js';
  let { answer, openSource } = $props();
</script>

<article class="answer" aria-label="Respuesta de Loop">
  <div class="answer-head"><Icon name="i-star" /> Loop
    {#if answer.estado === 'no_consta'}<span class="pill orange">Información no disponible</span>{/if}
  </div>
  {#if answer.estado === 'no_consta'}
    <div class="no-data" role="status"><strong>No consta en los datos disponibles.</strong><span>{answer.respuesta}</span></div>
  {:else}
    <p class="answer-text">{answer.respuesta}</p>
  {/if}
  {#if answer.datos?.prendas}
    <div class="products">
      {#each answer.datos.prendas as item (item.prenda_id)}
        <button class="product product-button" onclick={() => openSource({ documento: 'prendas.csv', registro_id: item.prenda_id, fragmento: JSON.stringify(item) })}>
          <div class="product-image product-photo"><span class="size">{item.talla}</span><Photo id={item.prenda_id} title={item.titulo} /></div>
          <div class="product-body"><h3 class="product-title">{item.titulo}</h3><p class="product-meta">{item.marca} · {item.conservacion}</p><p class="product-meta">@{item.alias}</p><div class="product-bottom"><span class="product-price">{euro(item.precio_publicado_eur)}</span><span class="pill green">{item.disponibilidad}</span></div></div>
        </button>
      {/each}
    </div>
    <p class="note">Fotos de ejemplo generadas con IA. Precios sin envío. La talla 38 de ropa y el calzado EU 38 se consultan por separado.</p>
  {/if}
  {#if answer.datos?.numero_ventas !== undefined}
    <div class="answer-metrics">
      <div class="mini-metric"><span class="metric-label">Prendas</span><strong class="metric-value">{euro(answer.datos.precio_acordado_eur)}</strong></div>
      <div class="mini-metric"><span class="metric-label">Envío</span><strong class="metric-value">{euro(answer.datos.envio_eur)}</strong></div>
      <div class="mini-metric highlight"><span class="metric-label">Total registrado</span><strong class="metric-value">{euro(answer.datos.total_eur)}</strong></div>
    </div>
    <p class="calc-note">{answer.datos.numero_ventas} ventas completadas. Se usa el precio acordado y el envío se cuenta una vez por operación.</p>
    <p class="note">Las canceladas se excluyen. El total no representa un beneficio neto.</p>
  {/if}
  {#if answer.datos?.vendedores}
    <div class="seller-rows">
      {#each answer.datos.vendedores as seller (seller.vendedor_id)}
        <div class="seller-row"><div class="seller-alias">@{seller.alias}<div class="tiny muted">{seller.vendedor_id} · {seller.prendas.length} prendas</div></div><div class="seller-list">{#each seller.prendas as item, index}<b>{item.titulo}</b> ({item.disponibilidad.toLowerCase()}){index < seller.prendas.length - 1 ? ' · ' : ''}{/each}</div></div>
      {/each}
    </div>
  {/if}
  {#if answer.fuentes.length}
    <div class="sources">
      <div class="sources-label"><Icon name="i-link" /> {answer.estado === 'no_consta' ? 'Fuentes y alcance de la comprobación' : 'Fuentes de esta respuesta'}</div>
      {#each answer.fuentes as source, index}
        <button class="source" onclick={() => openSource(source)}><span class="source-arrow">↗</span><strong>[{index + 1}] {source.documento} · {source.registro_id === 'cabecera' ? 'Cabecera completa' : source.registro_id}</strong><q>{source.fragmento}</q></button>
      {/each}
    </div>
  {/if}
</article>
