<script>
  let { name, class: className = 'icon' } = $props();
</script>

<svg class={className} aria-hidden="true"><use href={`/icons.svg#${name}`} /></svg>
