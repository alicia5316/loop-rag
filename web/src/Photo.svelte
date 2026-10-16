<script>
  let { id, title, class: className = '' } = $props();
</script>

<img class={`garment-photo ${className}`} src={`/prendas/${id}.png`} alt={`Foto de ejemplo: ${title}`} width="600" height="600" loading="lazy" decoding="async" />
