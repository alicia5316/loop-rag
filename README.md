# Loop: servidor RAG

Desde esta carpeta:

```powershell
uv run servidor.py
```

Escucha en `http://127.0.0.1:8000`. El contrato interactivo está en
`http://127.0.0.1:8000/docs`. `uv` instala las dependencias de `pyproject.toml`.
La especificación visual sigue en `maquetas.html`. La aplicación Svelte de
`web/` reproduce sus cuatro vistas y consulta la API real.

## Interfaz Svelte

Necesitas Node.js 22.12+ o 24 LTS. Abre dos terminales desde esta carpeta.

Terminal 1, servidor:

```powershell
uv run servidor.py
```

Terminal 2, interfaz:

```powershell
cd web
npm install
npm run dev
```

Abre **http://127.0.0.1:5173/**. La navegación permite entrar en el asistente,
datos personales, documentos y ventas. Los enlaces `#chat`, `#privacidad`,
`#registros` y `#ventas` permiten abrir cada vista directamente.

En este equipo se ha preparado Node portátil en `.tools/` porque no estaba
instalado. Para habilitarlo en una terminal nueva, desde la raíz del proyecto:

```powershell
$env:Path = (Resolve-Path '.tools/node-v24.22.0-win-x64').Path + ';' + $env:Path
cd web
npm.cmd run dev
```

El chat comienza vacío y las sugerencias ejecutan preguntas reales. Cada
respuesta muestra debajo las fuentes devueltas por el servidor; se abren en
un diálogo con su registro completo. El historial acompaña las preguntas y
se borra con «Nueva conversación». El estado `no_consta` tiene un aviso visible.
La biblioteca permite filtrar, buscar, abrir registros y exportar CSV.
Ventas reutiliza el listado de documentos de la API y excluye canceladas al
sumar los indicadores; el filtro conserva el detalle de todas las operaciones.

Vite redirige exclusivamente `/api` a `http://127.0.0.1:8000`. El navegador
no contacta con OpenAI y no recibe ninguna clave. Vite no carga archivos `.env`
y solo sirve archivos dentro de `web/`; el `.env` del servidor está fuera de
esa carpeta y excluido de Git. No pongas la clave en variables `VITE_*`.

Comprobaciones desde `web/`:

```powershell
npm run check
npm run build
npm test
```

Las pruebas Playwright necesitan ambos servidores activos y Google Chrome
instalado. Verifican las tres preguntas con la API real (consumen API),
fuentes, historial, ausencia de datos, filtros, exportación, reintentos y móvil.
Las capturas y trazas se guardan en `web/test-results/`, excluido de Git.
El contenido de `web/dist/` es el resultado estático; para desplegarlo,
el servidor web de producción debe redirigir `/api` al servidor Python.

Lee `OPENAI_API_KEY` y la configuración del proxy de `.env` sin imprimirlos.
La clave debe ser válida. Opciones: `OPENAI_MODEL` (por defecto `gpt-4.1-mini`),
`OPENAI_EMBEDDING_MODEL` (`text-embedding-3-small`) y `RAG_MIN_SIMILARITY` (`0.38`).

## Base de datos e índice RAG

La fuente de datos de la aplicación es **`datos/loop.sqlite3`**. Se crea
automáticamente con SQLite, incluido en Python; no necesitas instalar ni
arrancar otro servidor de base de datos.

Contiene las tablas relacionales `prendas`, `ventas` y `vendedores`, con claves
primarias, relaciones y claves foráneas. La tabla `rag_fragmentos` guarda el
texto de cada fragmento, sus fuentes, el modelo de embeddings, la huella del
contenido y el vector. `metadatos` registra la inicialización y versión del esquema.
Los importes se guardan como texto decimal y se suman con `Decimal` para no
introducir errores de redondeo.

Los CSV de `datos/` reproducen los 12 artículos, 4 ventas y 5 vendedores ficticios
de la maqueta. Se importan **una sola vez**, en una transacción, al crear la base.
Después no se vuelven a leer ni sobrescriben los datos de SQLite. Borrar filas
de la base, incluso todas, no restaura automáticamente los registros ficticios.
Los nombres `prendas.csv`, `ventas.csv` y `vendedores.csv` se conservan en las
fuentes y en la API como nombres de los documentos originales.

Al migrar desde la versión anterior, se importa `datos/indice.json` si su huella
coincide con los datos y el modelo actuales: no se recalculan esos embeddings.
El archivo antiguo se conserva, pero el índice activo se almacena en SQLite.
En cada consulta RAG se comprueban las huellas de los fragmentos; se reutilizan
los vectores válidos y solo se calculan los nuevos, modificados o dañados.
También se actualizan las vistas completas afectadas y se retiran los fragmentos
eliminados. Un cambio de modelo mantiene un índice separado para cada modelo.
Las actualizaciones del índice se guardan en una transacción; si falla el servicio
de embeddings, no se publica un índice parcial ni se genera una respuesta con
evidencia antigua.

La recuperación se ejecuta mediante una consulta SQL a `rag_fragmentos`, con
similitud coseno, umbral y límite de resultados. La función de similitud está
registrada en SQLite desde Python; esta implementación realiza una búsqueda
exacta sobre los vectores, apropiada para esta colección pequeña, sin requerir
extensiones vectoriales. Cada operación utiliza su propia conexión y se activan
claves foráneas y WAL. Las preguntas nuevas necesitan un embedding de consulta.
No se guardan conversaciones ni la clave de OpenAI en la base.

Para crear o inspeccionar el resumen de la base:

```powershell
uv run base_datos.py
```

Puedes editar la colección con un cliente SQLite. Por ejemplo, este SQL cambia
el precio publicado de una prenda:

```sql
PRAGMA foreign_keys = ON;
UPDATE prendas SET precio_publicado_eur = '20.00' WHERE prenda_id = 'PRE002';
```

No hace falta reiniciar: la siguiente petición a `/api/documentos` lee el cambio
y la siguiente consulta RAG actualiza los embeddings afectados antes de buscar.
Recarga la interfaz para actualizar el listado que ya está abierto.
Para sincronizar el índice manualmente:

```powershell
uv run python -c "from servidor import RAG; RAG().load_index()"
```

La base y los archivos WAL/SHM son datos locales excluidos de Git. Para copiar
una base en uso utiliza la operación de copia de seguridad de SQLite, que
incluye los cambios pendientes en WAL; conserva los CSV para crear una demo
nueva, no para actualizar una base existente.

Si falta una clave válida o falla la conexión, el servidor mantiene disponible
el listado de documentos y la comprobación de datos personales ausentes.
Las consultas que necesitan un índice devuelven HTTP 503 hasta poder crearlo;
la petición siguiente vuelve a intentarlo. Nunca se genera un índice ficticio.

`../iagen-api-casos/rag.py` no estaba disponible en este equipo; la implementación
se ha preparado a partir de los datos y reglas de la maqueta. La salida del
modelo utiliza Pydantic y Structured Outputs siguiendo la
[documentación oficial](https://developers.openai.com/api/docs/guides/structured-outputs).

## API

`POST /api/preguntar` recibe:

```json
{"pregunta":"Prendas disponibles talla 38","historial":[{"role":"user","content":"Hola"},{"role":"assistant","content":"¿Qué quieres consultar?"}]}
```

El historial es opcional; admite hasta 30 mensajes `user`/`assistant`. No se
aceptan mensajes `system`. Los seguimientos elípticos usan la última pregunta
del usuario como contexto para recuperar evidencia. El historial no es una fuente.

Devuelve `estado` (`ok` o `no_consta`), `respuesta`, `fuentes` y `datos`.
Cada fuente contiene `documento`, `registro_id` y `fragmento` con el registro
original. `datos` incluye las prendas, las sumas o las agrupaciones calculadas
en Python para las consultas de ejemplo. El modelo redacta la respuesta con
un esquema estricto; sus IDs de fuente se contrastan con los recuperados.

La búsqueda usa similitud coseno con un umbral configurable. Por debajo de ese
umbral se devuelve `no_consta`, sin llamar al modelo generativo. Los campos
personales ausentes se comprueban antes incluso de consultar embeddings y
se citan las cabeceras revisadas. El umbral es una heurística: conviene calibrarlo
con ejemplos propios si se amplían los documentos.

Las vistas completas evitan sumar únicamente el top-k: se excluye VEN004
cancelada y se usan precios acordados; talla 38 de ropa excluye EU 38 de calzado;
la agrupación por vendedor conserva todos los estados. Los importes se suman
con `Decimal`.

`GET /api/documentos` devuelve `documentos` (nombre, tipo, descripción, campos,
número de registros y registros completos), `total_documentos`, `total_registros`,
`datos_ficticios` y `fecha_corte`. Incluye la información necesaria para las
tarjetas, filtros, tabla y diálogos de la biblioteca de la maqueta.

## Pruebas con curl

En otra terminal, desde esta carpeta (los archivos JSON evitan problemas de
comillas y codificación en Windows):

```powershell
curl.exe --noproxy "*" http://localhost:8000/api/preguntar -H "Content-Type: application/json" --data-binary "@consultas/talla38.json"
curl.exe --noproxy "*" http://localhost:8000/api/preguntar -H "Content-Type: application/json" --data-binary "@consultas/ventas.json"
curl.exe --noproxy "*" http://localhost:8000/api/preguntar -H "Content-Type: application/json" --data-binary "@consultas/vendedores.json"
curl.exe --noproxy "*" http://localhost:8000/api/preguntar -H "Content-Type: application/json" --data-binary "@consultas/no_consta.json"
curl.exe --noproxy "*" http://localhost:8000/api/documentos
```

Resultados esperados: PRE002/PRE007/PRE011; 49 € de prendas + 7 € de envío =
56 € en 3 ventas; 12 prendas en 5 vendedores; `no_consta` para datos personales
sin ninguna llamada a OpenAI. Documentos: 3 archivos y 21 registros.

Pruebas automatizadas sin red ni consumo de API:

```powershell
uv run python -m pytest -q
```

## Entregable A4

`entregable.html` es un informe autónomo con CSS incluido y cinco imágenes por
ruta relativa en `capturas/`. `entregable.pdf` contiene **9 páginas A4**: portada,
cinco páginas con capturas completas, dos de comprobación y una de implementación.
Las páginas 7 y 8 indican los registros concretos que se deben abrir para
comprobar los resultados. Al compartir el HTML, conserva la carpeta `capturas/`
junto a él; el PDF incluye las imágenes y puede compartirse por separado.

Para repetir la generación, con la API y la interfaz ya arrancadas, desde `web/`:

```powershell
npm install -D playwright-core
node capturas.mjs
node entregable.mjs
```

Ambos scripts utilizan el Microsoft Edge instalado con `channel: "msedge"`.
No se descargan navegadores. `capturas.mjs` utiliza una ventana de 1366 × 900,
envía las cuatro preguntas de la maqueta desde el formulario real y espera las
respuestas de la API y sus fuentes. Cada consulta se captura en una conversación
independiente. Para conservar todo el contenido se expanden las zonas con
desplazamiento y se obtiene una imagen completa, de altura mayor que la ventana.
También se captura el listado con los 21 registros.

`capturas/evidencias.json` conserva las respuestas exactas, las fuentes,
la configuración no secreta de modelos y las comprobaciones contra la API.
`entregable.mjs` comprueba las huellas de las imágenes, crea el HTML sin recursos
remotos y lo imprime con `page.pdf` en A4. Valida que ningún bloque desborde una
página y que el PDF tenga nueve páginas. El resultado de la comprobación está
en `capturas/resumen-entregable.json`.
