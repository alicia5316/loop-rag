<script>
  import { onMount, tick } from 'svelte';
  import Icon from './Icon.svelte';
  import Answer from './Answer.svelte';
  import RecordDialog from './RecordDialog.svelte';
  import Photo from './Photo.svelte';
  import { ask, getDocuments, euro, normalize, recordId, recordTitle, downloadCSV } from './api.js';

  const pages = [
    { id: 'chat', title: 'Asistente', icon: 'i-chat' },
    { id: 'privacidad', title: 'Datos personales', icon: 'i-shield' },
    { id: 'registros', title: 'Documentos', icon: 'i-grid' },
    { id: 'ventas', title: 'Ventas', icon: 'i-chart' },
  ];
  const suggestions = [
    ['Talla 38 disponible', 'Prendas disponibles talla 38'],
    ['Ventas completadas', 'Calcular el importe de las ventas completadas, separando prendas y envío.'],
    ['Prendas por vendedor', 'Obtener las prendas de cada vendedor.'],
    ['Datos personales', 'Datos personales de los vendedores.'],
  ];
  let page = $state('chat');
  let collection = $state(null);
  let documentsLoading = $state(true);
  let documentsError = $state('');
  let query = $state('');
  let messages = $state([]);
  let pending = $state(false);
  let privacyAnswer = $state(null);
  let privacyError = $state('');
  let filter = $state('all');
  let search = $state('');
  let salesFilter = $state('all');
  let source = $state(null);
  let input = $state();
  let conversation = $state();
  const documents = $derived(collection?.documentos ?? []);
  const garments = $derived(documents.find(d => d.tipo === 'prendas')?.registros ?? []);
  const sales = $derived(documents.find(d => d.tipo === 'ventas')?.registros ?? []);
  const sellers = $derived(documents.find(d => d.tipo === 'vendedores')?.registros ?? []);
  const records = $derived(documents.flatMap(document => document.registros.map(row => ({ document, row, id: recordId(row) }))));
  const visibleRecords = $derived(records.filter(r => (filter === 'all' || r.document.tipo === filter) && normalize(JSON.stringify(r.row) + r.document.nombre + sellerAlias(r.row.vendedor_id)).includes(normalize(search))));
  const visibleSales = $derived(sales.filter(s => salesFilter === 'all' || s.estado === salesFilter));
  const completedSales = $derived(visibleSales.filter(s => s.estado === 'Completada'));
  const completedTotal = field => completedSales.reduce((sum, row) => sum + Math.round(row[field] * 100), 0) / 100;
  const sellerAlias = id => sellers.find(s => s.vendedor_id === id)?.alias ?? '';
  const garmentTitle = id => garments.find(g => g.prenda_id === id)?.titulo ?? id;
  const statusClass = status => status === 'Reservada' ? 'reserved' : status === 'Vendida' ? 'sold' : ['Retirada', 'Cancelada'].includes(status) ? 'off' : '';
  const openSource = value => source = value;
  const openRecord = record => openSource({ documento: record.document.nombre, registro_id: record.id, fragmento: JSON.stringify(record.row) });
  const openSale = sale => openRecord(records.find(r => r.id === sale.venta_id));

  onMount(() => {
    const updatePage = () => {
      const target = window.location.hash.slice(1);
      page = pages.some(p => p.id === target) ? target : 'chat';
      window.scrollTo(0, 0);
    };
    updatePage();
    window.addEventListener('hashchange', updatePage);
    loadDocuments();
    return () => window.removeEventListener('hashchange', updatePage);
  });

  async function loadDocuments() {
    documentsLoading = true; documentsError = '';
    try { collection = await getDocuments(); }
    catch (error) { documentsError = error.message; }
    finally { documentsLoading = false; }
  }

  async function scrollConversation(showAnswer = false) {
    await tick();
    if (!conversation) return;
    const lastAnswer = [...conversation.querySelectorAll('.answer, .load-error')].at(-1);
    const top = showAnswer && lastAnswer
      ? lastAnswer.getBoundingClientRect().top - conversation.getBoundingClientRect().top + conversation.scrollTop - 16
      : conversation.scrollHeight;
    conversation.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  async function send(text = query, privacy = false) {
    const question = text.trim();
    if (!question || pending) return;
    const history = messages.filter(m => m.role === 'user' || m.answer).map(m => ({ role: m.role, content: (m.answer?.respuesta ?? m.content).slice(0, 4000) })).slice(-30);
    messages = [...messages, { role: 'user', content: question }];
    query = ''; pending = true; privacyError = '';
    if (!privacy) scrollConversation();
    try {
      const answer = await ask(question, history);
      messages = [...messages, { role: 'assistant', answer }];
      if (privacy) privacyAnswer = answer;
    } catch (error) {
      messages = [...messages, { role: 'assistant', error: error.message, question }];
      if (privacy) privacyError = error.message;
    } finally {
      pending = false;
      if (!privacy) { scrollConversation(true); await tick(); input?.focus({ preventScroll: true }); }
    }
  }

  function reset() { messages = []; query = ''; privacyAnswer = null; privacyError = ''; }
</script>

<a class="skip" href="#contenido" onclick={event => { event.preventDefault(); document.getElementById('contenido').focus(); }}>Saltar al contenido</a>
<aside class="sidebar" aria-label="Navegación principal">
  <a class="brand" href="#chat" aria-label="Loop, inicio"><Icon name="i-loop" class="brand-mark" /><span class="brand-name">loop</span></a>
  <div class="brand-sub">Ropa de segunda mano</div><p class="nav-label">TU ESPACIO</p>
  <nav class="nav">{#each pages as item}<a class:active={page === item.id} aria-current={page === item.id ? 'page' : undefined} href={`#${item.id}`}><Icon name={item.icon} />{item.title}{#if item.id === 'registros' && collection}<span class="count">{collection.total_registros}</span>{/if}</a>{/each}</nav>
  <div class="side-note"><strong class="tiny"><span class="live-dot"></span>Colección de ejemplo</strong><p class="tiny">Una nueva vida para tu ropa.<br>Vuelve siempre a la fuente.</p></div>
  <div class="side-bottom"><div class="demo-label">DATOS FICTICIOS</div><p>Sin conexión a Vinted</p><div class="profile"><span class="avatar">TU</span><div><strong>Mi espacio</strong><div class="tiny muted">Colección de octubre</div></div></div></div>
</aside>
<header class="topbar"><div class="breadcrumb"><span class="muted">Mi espacio</span><span class="muted">/</span><strong>{pages.find(p => p.id === page)?.title}</strong></div><div class="top-right"><span class="muted">Colección · octubre 2026</span><span class="pill"><span class="live-dot"></span>Datos de demostración</span></div></header>
<main class="page" id="contenido" tabindex="-1">
  <div class="intro"><div><p class="eyebrow">MENOS BUSCAR. MÁS ENCONTRAR.</p><h1>{page === 'registros' ? 'Todo empieza en una fuente.' : page === 'ventas' ? 'Tus ventas, con claridad.' : page === 'privacidad' ? 'Saber también es reconocer los límites.' : 'Tu armario, con contexto.'}</h1><p>Consulta prendas, entiende tus ventas y vuelve siempre al origen.</p></div><svg class="intro-art" viewBox="0 0 150 80" aria-hidden="true"><path d="M12 68h124M30 67V17h90v50M30 17h90M64 17v7l-14 9h28l-14-9m35-7v7l-14 9h28l-14-9" stroke="currentColor" fill="none" stroke-width="1.5" /><path d="m52 33-10 8 5 8 5-3-2 18h29l-2-18 5 3 5-8-11-8-6 4h-12Z" fill="#d9dfce" /><path d="m88 33-3 30h29l-7-30Z" fill="#d8bea1" /></svg></div>
  {#if documentsError}<div class="load-error" role="alert"><p>{documentsError}</p><button class="btn" onclick={loadDocuments}>Reintentar cargar documentos</button></div>{/if}

  {#if page === 'chat'}
    <section class="section" aria-labelledby="chat-heading">
      <div class="section-heading"><h2 class="section-title" id="chat-heading"><span class="section-number">01</span>Asistente de tu colección</h2><span class="section-hint">Cada respuesta tiene un origen</span></div>
      <div class="panel"><div class="panel-head"><div class="assistant-id"><span class="spark"><Icon name="i-star" /></span><div><p class="panel-title">Hablemos de tu armario</p><p class="panel-sub">Respuestas a partir de tus registros · Colección de octubre</p></div></div><button class="btn" disabled={pending || !messages.length} onclick={reset}>Nueva conversación</button></div>
        <div class="chat-layout"><div class="chat-main"><div class="conversation" bind:this={conversation} aria-live="polite" aria-busy={pending}>
          <div class="date-divider">TU COLECCIÓN, EN UNA CONVERSACIÓN</div>
          {#if !messages.length}<div class="welcome"><span class="welcome-spark"><Icon name="i-star" /></span><h2>¿Qué encontramos hoy?</h2><p>Puedo buscar prendas, resumir tus ventas o agrupar tu colección por vendedor.</p><p class="tiny muted">Elige una sugerencia o escribe tu pregunta. Podrás comprobar las fuentes de cada respuesta.</p></div>{/if}
          {#each messages as message}
            {#if message.role === 'user'}<div class="question"><p>{message.content}</p><span class="avatar" aria-label="Tú">TU</span></div>
            {:else if message.answer}<Answer answer={message.answer} {openSource} />
            {:else if message.error}<div class="load-error" role="alert"><p>{message.error}</p><button class="btn" disabled={pending} onclick={() => send(message.question)}>Reintentar pregunta</button></div>{/if}
          {/each}
          {#if pending}<div class="pending" role="status"><span class="loading-dot"></span>Consultando tu colección…</div>{/if}
        </div>
        <div class="chat-input-area"><div class="suggestions" aria-label="Consultas de ejemplo">{#each suggestions as [label, question]}<button class="suggestion" disabled={pending} onclick={() => send(question)}>{label}</button>{/each}</div>
          <form class="composer" onsubmit={event => { event.preventDefault(); send(); }}><label class="sr-only" for="chat-query">Escribe tu consulta</label><input bind:this={input} bind:value={query} id="chat-query" placeholder="Pregunta sobre tu colección…" maxlength="2000" disabled={pending} required autocomplete="off" /><button type="submit" disabled={pending || !query.trim()} aria-label="Enviar consulta"><Icon name="i-send" /></button></form>
          <p class="input-caption">Datos ficticios · Respuestas respaldadas por tus registros</p>
        </div></div>
        <aside class="context" aria-label="Contexto de la conversación"><h3 class="context-title">En esta colección</h3>
          {#if documentsLoading}<p class="tiny" role="status">Cargando colección…</p>{:else if collection}<div class="context-data">Prendas<strong>{garments.length}</strong></div><div class="context-data">Disponibles<strong>{garments.filter(g => g.disponibilidad === 'Disponible').length}</strong></div><div class="context-data">Vendedores<strong>{sellers.length}</strong></div><div class="context-data">Ventas completadas<strong>{sales.filter(s => s.estado === 'Completada').length}</strong></div>{/if}
          <div class="context-line"></div><h3 class="context-title">Documentos de origen</h3>{#each documents as document}<a class="doc-mini" href="#registros" onclick={() => filter = document.tipo}><Icon name="i-doc" /><div>{document.nombre}<small>{document.numero_registros} registros · {document.descripcion}</small></div></a>{/each}
          <p><a class="link-button" href="#registros">Explorar todos los registros →</a></p><div class="context-box"><Icon name="i-link" /><strong>Cada respuesta tiene un origen.</strong>Abre cualquier fuente para consultar el registro completo.</div><div class="context-box"><span class="demo-label">DATOS DE EJEMPLO</span><br>Esta colección simula datos de Vinted. No hay una conexión real ni una importación en curso.</div>
        </aside></div>
      </div>
    </section>
  {:else if page === 'privacidad'}
    <section class="section" aria-labelledby="privacy-heading"><div class="section-heading"><h2 class="section-title" id="privacy-heading"><span class="section-number">02</span>Cuando la respuesta no está en los datos</h2></div><div class="panel"><div class="panel-head"><div class="assistant-id"><span class="spark"><Icon name="i-shield" /></span><div><p class="panel-title">Tus datos, con límites claros</p><p class="panel-sub">Comprueba qué información contiene tu colección.</p></div></div></div><div class="privacy-body"><div class="privacy-grid"><div>
      <div class="question"><p>Datos personales de los vendedores.</p><span class="avatar">TU</span></div>
      {#if privacyAnswer}<Answer answer={privacyAnswer} {openSource} />{:else}<p class="muted">Consulta los registros para saber qué datos personales constan y revisar las fuentes de la comprobación.</p>{/if}
      {#if privacyError}<p class="load-error" role="alert">{privacyError}</p>{/if}
      <button class="btn primary" disabled={pending} onclick={() => send('Datos personales de los vendedores.', true)}>{pending ? 'Comprobando registros…' : privacyAnswer ? 'Volver a comprobar' : 'Consultar datos personales'}</button>
    </div><aside class="privacy-aside"><div class="label">La información tiene un alcance</div><p>Un alias no acredita un nombre real. Consulta las fuentes para comprobar los campos que hay en los documentos.</p><p class="rule">Si la información no consta, el asistente lo indica. Puedes seguir preguntando en la misma conversación.</p><a class="link-button" href="#chat">Volver a la conversación →</a></aside></div></div></div></section>
  {:else if page === 'registros'}
    <section class="section" aria-labelledby="records-heading"><div class="section-heading"><h2 class="section-title" id="records-heading"><span class="section-number">03</span>Biblioteca de documentos y registros</h2><span class="section-hint">Explora la evidencia detrás de las respuestas</span></div><div class="panel"><div class="library-top"><div><h2>Los documentos de tu colección.</h2><p>{collection ? `${collection.total_documentos} documentos · ${collection.total_registros} registros ficticios` : 'Cargando documentos…'}</p></div><button class="btn" disabled={!visibleRecords.length} onclick={() => downloadCSV('loop-registros.csv', visibleRecords.map(r => ({ documento: r.document.nombre, ...r.row })))}><Icon name="i-download" />Exportar selección</button></div>
      <div class="document-grid">{#each documents as document}<button class="document-card" class:selected={filter === document.tipo} onclick={() => filter = document.tipo}><span class="document-icon"><Icon name="i-doc" /></span><span><strong>{document.nombre}</strong><small>{document.numero_registros} registros · {document.descripcion}</small></span><Icon name="i-arrow" /></button>{/each}</div>
      <div class="record-toolbar"><div class="tabs" role="group" aria-label="Filtrar por documento"><button class="tab" class:active={filter === 'all'} aria-pressed={filter === 'all'} onclick={() => filter = 'all'}>Todos <span>{collection?.total_registros ?? 0}</span></button>{#each documents as document}<button class="tab" class:active={filter === document.tipo} aria-pressed={filter === document.tipo} onclick={() => filter = document.tipo}>{document.tipo} <span>{document.numero_registros}</span></button>{/each}</div><label class="search"><Icon name="i-search" /><span class="sr-only">Buscar registros por ID, prenda, talla, estado o alias</span><input type="search" bind:value={search} placeholder="Buscar ID, prenda, talla, alias…" /></label></div>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (La tabla desplazable necesita foco para desplazarse con el teclado.) -->
      <div class="table-scroll" tabindex="0" role="region" aria-label="Tabla de registros"><table><thead><tr><th scope="col">Registro</th><th scope="col">Descripción</th><th scope="col">Documento</th><th scope="col">Estado / tipo</th><th scope="col" class="right">Detalle</th></tr></thead><tbody>
        {#each visibleRecords as record (record.id)}<tr><td><span class="record-id">{record.id}</span></td><td><div class="record-description">{#if record.document.tipo === 'prendas'}<Photo id={record.id} title={record.row.titulo} class="record-thumbnail" />{/if}<div><span class="record-main">{recordTitle(record.row)}</span><span class="record-sub">{record.row.talla ? `${record.row.marca} · Talla ${record.row.talla} · ${euro(record.row.precio_publicado_eur)} · @${sellerAlias(record.row.vendedor_id)}` : record.row.fecha_venta ?? 'Identificador y alias público'}</span></div></div></td><td><span class="record-sub">{record.document.nombre}</span></td><td><span class="status {statusClass(record.row.disponibilidad || record.row.estado)}">{record.row.disponibilidad || record.row.estado || 'Alias público'}</span></td><td class="right"><button class="row-detail" aria-label={`Abrir registro ${record.id}`} onclick={() => openRecord(record)}><Icon name="i-arrow" /></button></td></tr>
        {:else}<tr><td class="empty" colspan="5">{documentsLoading ? 'Cargando registros…' : documentsError ? 'No se han podido cargar los registros.' : 'No hay registros que coincidan. Prueba otro término o selecciona «Todos».'}</td></tr>{/each}
      </tbody></table></div><div class="table-foot"><span role="status">{visibleRecords.length} de {collection?.total_registros ?? 0} registros</span><span>Abre ↗ para consultar el registro completo.</span></div></div></section>
  {:else if page === 'ventas'}
    <section class="section" aria-labelledby="sales-heading"><div class="section-heading"><h2 class="section-title" id="sales-heading"><span class="section-number">04</span>Resumen de ventas</h2><span class="section-hint">Importes comprobables, sin duplicar el envío</span></div><div class="panel"><div class="panel-head"><div><p class="panel-title">Cada venta, con sus cuentas claras.</p><p class="panel-sub">Octubre de 2026 · Importes en euros · Datos ficticios</p></div><button class="btn" disabled={!visibleSales.length} onclick={() => downloadCSV('loop-ventas.csv', visibleSales)}><Icon name="i-download" />Exportar ventas</button></div><div class="sales-body">
      {#if documentsLoading}<p role="status">Cargando ventas…</p>{:else if collection}<div class="sales-metrics">{#each [['Prendas · ventas completadas', 'precio_acordado_eur', 'Suma de los precios acordados'], ['Envío · ventas completadas', 'envio_eur', 'Una vez por operación'], ['Total · ventas completadas', 'total_eur', `${completedSales.length} operaciones completadas`]] as [label, field, foot]}<div class="sales-metric" class:total={field === 'total_eur'}><span class="metric-label">{label}</span><strong class="metric-value">{euro(completedTotal(field))}</strong><span class="metric-foot">{foot}</span></div>{/each}</div>{/if}
      <div class="sales-toolbar"><h3>Detalle de operaciones <span class="muted tiny">({visibleSales.length})</span></h3><label><span class="sr-only">Filtrar operaciones por estado</span><select class="select" bind:value={salesFilter}><option value="all">Todos los estados</option><option value="Completada">Solo completadas</option><option value="Cancelada">Solo canceladas</option></select></label></div><div class="sales-table"><table><thead><tr><th scope="col">Venta / fecha</th><th scope="col">Prenda</th><th scope="col">Estado</th><th scope="col" class="right">Prendas</th><th scope="col" class="right">Envío</th><th scope="col" class="right">Total</th><th scope="col">Fuente</th></tr></thead><tbody>{#each visibleSales as sale}<tr><td><span class="record-main">{sale.venta_id}</span><span class="record-sub">{sale.fecha_venta.split('-').reverse().join('/')}</span></td><td>{garmentTitle(sale.prenda_id)}</td><td><span class="status {statusClass(sale.estado)}">{sale.estado}</span></td><td class="right">{euro(sale.precio_acordado_eur)}</td><td class="right">{euro(sale.envio_eur)}</td><td class="right"><strong>{euro(sale.total_eur)}</strong></td><td><button class="row-detail" aria-label={`Abrir registro ${sale.venta_id}`} onclick={() => openSale(sale)}><Icon name="i-arrow" /></button></td></tr>{:else}<tr><td colspan="7" class="empty">{documentsLoading ? 'Cargando operaciones…' : 'No hay operaciones disponibles.'}</td></tr>{/each}</tbody></table></div>
      <div class="sales-caption"><span>Los indicadores suman las ventas completadas de la selección. Las canceladas aportan 0 €.</span><a class="link-button" href="#registros" onclick={() => { filter = 'ventas'; search = ''; }}>Ver registros de origen →</a></div><p class="note">El total incluye prendas y envío registrados. No hay datos para calcular comisiones o un beneficio neto.</p>
    </div></div></section>
  {/if}
  <footer class="footer"><span><span class="brand-name">loop</span> Una nueva vida para cada prenda.</span><span>Datos ficticios de Vinted<br><a href="#chat">Volver al asistente ↑</a></span></footer>
</main>
<RecordDialog {source} onclose={() => source = null} />
