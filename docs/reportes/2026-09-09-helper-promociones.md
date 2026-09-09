# Reporte — Migración v2 → v3: helper de promociones y temas `fecdc62..a2e80bb`

**Fecha:** 2026-09-09
**Proyecto:** `garza` (frontend v3, Next 16 App Router)
**Referencia:** [`docs/commits-nuevos/`](../commits-nuevos/) (temas 00–05)
**Origen del código:** repo GitLab `taquillavipfrontend-v2`, rama `main_v2` (rango `fecdc62..a2e80bb`)
**Base:** `main` de GitLab (`8e682ca`), con el trabajo de SEO/legales/cache/security ya integrado.

**Estado del build:**
- `npx tsc --noEmit` → ✅ limpio
- `npm run build` → ✅ 39 rutas; `/eventos` sigue `○ (Static)`, ahora con `revalidate` de 5 min (el del `fetch` de la lista, antes heredaba 1 h del layout)
- `npx vitest run --pool=threads` → ✅ **135/135** en 18 archivos (tras ajustar `next.config.test.ts` por la nueva regla de `headers()`)
- `npm run audit:images` → los 4 `<img>` de la home migrados; quedan 47 en el resto del repo (doc 06, fuera de alcance)

**Nada commiteado todavía.** Todo está en el working tree.

---

## 1. Resumen ejecutivo

Se portó de v2 a v3 **todo el rango `fecdc62..a2e80bb`** documentado en `docs/commits-nuevos/`
(6 documentos, 5 con código + 1 plan), más una mejora de resiliencia de red que venía en el
espejo de GitHub. Del plan de LCP (doc 05) se hicieron **las acciones de bajo riesgo**; el SSR de
los datos de la home queda anotado como pendiente (§ 2.9).

| Tema | Descripción | Estado |
|------|-------------|--------|
| **01** helper de promociones | Fuente única de verdad (código puro) + tests | ✅ |
| **01** cableado *por boletos* | `formConferenciaPage.tsx`, `EventoDetalleView.tsx` | ✅ |
| **01** cableado *por asientos* | `eventos/[slug]/[seccionId]/[seccion]/page.tsx`, `abonos/[slug]/[seccionId]/[seccion]/page.tsx` — con recálculo del UDS | ✅ (falta QA en navegador) |
| **00** leyenda mapa + info multifecha | `leyendaMapa`, orden DAYPASS, redirección multifecha, UI de fechas/abonos | ✅ |
| **02** mostrar promoción aplicada | `BoletoCard.tsx`, `DetallesPedidoTab.tsx` | ✅ |
| **03** saltar selección de abonos sin abonos | `app/(site)/eventos/page.tsx` | ✅ |
| **04** Google Maps por lat/lon | `mapsHelpers.ts`, `DireccionMapsLink.tsx` + call sites | ✅ |
| **05** rendimiento/LCP — bajo riesgo | Cáscara de servidor mínima en `/eventos` (`generateMetadata` + `ItemList` JSON-LD), `next/image` en hero + cards, `Cache-Control` inmutable en `next.config.ts` | ✅ (falta QA en navegador) |
| **05** rendimiento/LCP — grueso | SSR de la lista para el LCP (servidor alimenta la isla de cliente), `preload` de la imagen concreta, headers de caché de datos | ⏳ pendiente (decisión: fuera de alcance de esta tanda) |
| **extra** resiliencia de red + logo | Espejo GitHub `4f62df8`: timeout 20s, mensajes claros, fallback `/logo.png`, logo en OG | ✅ |

---

## 2. Qué se hizo

### 2.1 Helper y tests (tema 01)

- **`utils/promociones.ts`** — copia **verbatim** de `main_v2:src/utils/promociones.ts`
  (`diff` = idéntico byte a byte). TypeScript puro: sin React, sin HTTP, sin `toast`/`Swal`.
  Sirve igual en Server y Client Components. Expone:
  - Tipos: `TipoPromocion` (`PORCENTAJE` | `CANTIDAD` | `RESTA`), `Promocion`, `PromoCategoria`,
    `Asiento`, `MejorPromoPorBoletos`, `MejorPromoPorAsientos`, `CategoriaAccessor`.
  - Accesores: `CATEGORIA_GENERAL_ACCESSOR` (generales/conferencias),
    `CATEGORIA_NUMERADA_ACCESSOR` (numerados), `categoriasValidasDePromo`.
  - Cálculo **por boletos**: `calcularDescuentoPorcentajePorBoletos`,
    `calcularDescuentoCantidadPorBoletos`, `calcularDescuentoRestaPorBoletos`.
  - Cálculo **por asientos**: `asientosPorCategoriaPrecio`,
    `calcularDescuentoPorcentajePorCategoria`, `calcularDescuentoCantidadPorAsientos`,
    `calcularDescuentoRestaPorAsientos`, `calcularDescuentoPorCategoriaDeAsientos`
    (descuento desglosado por categoría, para recalcular el UDS), `calcularTotalNuevo`.
  - Filtrado: `filtrarPromocionesAplicablesPorCategoria` (string),
    `filtrarPromocionesAplicablesPorCategorias` (array).
  - Selección: `obtenerMejorPromocionPorBoletos` (con `precioFinal`),
    `obtenerMejorPromocionPorAsientos` (sin `precioFinal`).
  - Normalización: `normalizarPromocionesAplicaDirecto(promociones, conPorcentajeOriginal?)`.
- **`utils/promociones.test.ts`** — copia verbatim, 75 tests property-based con `fast-check`.
  Corren dentro de la config de Vitest existente sin cambios.
- **`fast-check@4.9.0`** — nuevo `devDependency` (v2 usa `^4.9.0`).

### 2.2 Cableado "por boletos" — `formConferenciaPage.tsx`, `EventoDetalleView.tsx`

1. Import del helper (`filtrarPromocionesAplicablesPorCategoria`,
   `obtenerMejorPromocionPorBoletos`, `calcularDescuentoCantidadPorBoletos`,
   `normalizarPromocionesAplicaDirecto`, `type Promocion`).
2. Se eliminó el `interface promocion` local → `Promocion`.
3. Se eliminaron `filtrarPromocionesAplicables` / `obtenerMejorPromocion` locales
   (eran copias del helper solo con `PORCENTAJE`/`CANTIDAD`, sin `RESTA`).
4. Llamadas:
   - `filtrarPromocionesAplicables(...)` → `filtrarPromocionesAplicablesPorCategoria(...)`
   - `obtenerMejorPromocion(...)` → `obtenerMejorPromocionPorBoletos(...)`
   - `setDiscountPorcent(mejorPromocion.porcentaje)` → `setDiscountPorcent(Number(...))`
   - cálculo inline de `CANTIDAD` en el flujo de código manual → `calcularDescuentoCantidadPorBoletos(...)`
5. `setPromocionesAplicanDirecto(normalizarPromocionesAplicaDirecto(res.data.promocionesAplicaDirecto))`.

**Beneficio colateral:** ambas páginas soportan ahora promociones tipo `RESTA`.

### 2.3 Cableado "por asientos" — numerados + abonos

`app/(site)/eventos/[slug]/[seccionId]/[seccion]/page.tsx` y
`app/(site)/abonos/[slug]/[seccionId]/[seccion]/page.tsx` (estructura casi idéntica; el de
abonos tenía una copia inline más). En cada uno:

1. Import del helper (`filtrarPromocionesAplicablesPorCategorias`,
   `obtenerMejorPromocionPorAsientos`, `asientosPorCategoriaPrecio` como
   `agruparAsientosPorCategoriaPrecio`, `calcularDescuentoPorcentajePorCategoria`,
   `calcularDescuentoCantidadPorAsientos`, `calcularDescuentoPorCategoriaDeAsientos`,
   `normalizarPromocionesAplicaDirecto`, `type Asiento as AsientoPromo`).
2. Se eliminó `interface MejorPromo` y las funciones locales
   `filtrarPromocionesAplicables` / `obtenerMejorPromocion` (~130 líneas cada archivo).
3. `habilitarpromocion`: el bucle manual de `porcentaje_original` →
   `normalizarPromocionesAplicaDirecto(res.data.promocionesAplicaDirecto, true)` (los flujos
   pareja/familia necesitan `porcentaje_original`).
4. Los `reduce` inline de agrupación asiento→categoría→precio →
   `agruparAsientosPorCategoriaPrecio(...)`.
5. Ramas `CANTIDAD` inline → `calcularDescuentoCantidadPorAsientos(...)`.
6. Ramas `PORCENTAJE` inline (que sumaban `descuento` + `nuevoSubtotal` por categoría) →
   `calcularDescuentoPorcentajePorCategoria(...)` + `Math.max(0, totalBoletos - descuento)`.
7. `useEffect` de auto-aplicación (`discountCode == ""`):
   - `filtrarPromocionesAplicables` → `filtrarPromocionesAplicablesPorCategorias`
   - `obtenerMejorPromocion(promos, asientos)` →
     `obtenerMejorPromocionPorAsientos(promos, asientos, subtotalesPorCategoria)`
   - `parseFloat(mejorPromocion.porcentaje)` → `parseFloat(String(...))`
   - **nueva rama `RESTA`** (antes se ignoraba)
   - **nuevo: recálculo del UDS sobre subtotales YA descontados por categoría** con
     `calcularDescuentoPorCategoriaDeAsientos`, y **restauración del UDS** con los subtotales
     completos cuando no hay promo. Solo aplica si `evento.udsPorCategoria`.
   - deps ampliadas: `[subtotalesPorCategoria]` → `[subtotalesPorCategoria, asientosSeleccionados, totalBoletos]`
8. `useEffect` que re-aplica la promo ya elegida (`promocion_id != 0`): reset en silencio
   cuando `asientosSeleccionados.length === 0` (evita el falso positivo del toast al
   deseleccionar todo) + helpers en `PORCENTAJE`/`CANTIDAD`.

**Corrección de fondo:** antes el UDS se recalculaba siempre sobre el subtotal **sin
descontar** (`handleAsientoClick`), así que con promo automática el cliente **pagaba de más en
el cargo por servicio**. Ahora el `useEffect` lo recalcula sobre el subtotal descontado por
categoría y lo restaura al quitar la promo.

### 2.4 Tema 00 — leyenda de mapa + página de información multifecha

`EventoDetalleView.tsx` (era `detalleEventoPage.tsx` en v2):
- **Leyenda configurable**: el texto fijo `*Los precios son ... en pesos mexicanos.*` (con
  parche por `evento.id === 59`) → `{evento.leyendaMapa ? `*${evento.leyendaMapa}*` : ""}`.
  Se agregó `leyendaMapa?: string` y `esMultiFuncion?: boolean` al `interface Evento`.
- **Orden de categorías**: antes por precio desc y "izquierda" primero → ahora por nombre ASC
  con los **DAYPASS al final** (ignorando espacios: cubre "day pass" y "daypass").
- **Redirección multifecha**: si el evento es `esMultiFuncion` y tiene **más de un día
  distinto** y no hay función en la URL, `router.replace(`/eventos/informacion/${slug}`)`
  (antes fallaba y mandaba al inicio). Nota: la guía sugiere hacerlo server-side; aquí se hizo
  en el cliente porque el detalle se resuelve client-side — queda como mejora futura.
- Botón de sección agotada: `invisible` (con `TODO` para regresar el estado "Agotados").

`InfoEventoView.tsx` (era `infoEventoPage.tsx`):
- `interface Evento` gana `esMultiFuncion?`, `funciones?`. Estado nuevo: `abonosEvento`,
  `cargandoAbonosEvento`.
- Detección `esMultiFecha` (mismo criterio: `esMultiFuncion && díasDistintos > 1`).
- `textoFechaEncabezado()`: en multifecha muestra un **rango** ("12 al 15 de octubre de 2025"
  o "12 de octubre al 3 de noviembre de 2025"); reemplaza dos bloques inline de
  `toLocaleDateString`/`toLocaleTimeString`.
- `useEffect` que pide `GET /abonos/evento/{id}` una vez, solo si es multifecha.
- UI de compra en multifecha: sección **Abonos de temporada** (cards con nombre, primeras 4
  fechas + "+N más", link a `?isAbono=true&abonoId=`) y **Elige una fecha** (grid de cards por
  función con día/mes, día de semana, rango de hora con `formatRangoHora`, apertura de puertas
  y recinto). Sin multifecha se conserva la flecha animada + "Comprar boletos".
- `<Link to>` de react-router → `<Link href>` de `next/link`; `navigate` → `router.replace`;
  íconos nuevos (`HiOutlineTicket`, `LuCalendarClock`, `GoChevronRight`, `FaLocationArrow`).

### 2.5 Tema 02 — mostrar promoción aplicada

- `BoletoCard.tsx`: `BoletoCardData` gana `precioOriginal?` y `promocion?`. El precio pasa a
  `boleto.precio ?? boleto.eventoSeccion?.precioEspecial` (antes al revés para paseGeneral).
  En el footer: etiqueta `PROMO: <nombre>` y `precioOriginal` tachado cuando difiere.
- `DetallesPedidoTab.tsx`: mismo par de campos en `BoletoLike`; misma inversión de precedencia
  en `total` y en el ítem; chip `· <promo>` junto a cada línea.

### 2.6 Tema 03 — saltar selección de abonos cuando no hay abonos

`app/(site)/eventos/page.tsx`, `handleVerClick`: se piden los abonos y **luego** se decide la
vista — `setModalView(abonos.length > 0 ? 'seleccionar_opcion' : 'fechas')` — en vez de abrir
siempre `seleccionar_opcion`. El botón "← Regresar a opciones" solo se muestra si
`abonosDisponibles.length > 0`.

### 2.7 Tema 04 — Google Maps por lat/lon del recinto

- `mapsHelpers.ts`: nueva `coordenadasMapsUrl(lat, lng, etiqueta?)` → `maps?q=lat,lng(Nombre)`
  o `null` si las coordenadas no son válidas.
- `DireccionMapsLink.tsx`: props `latitud`, `longitud`, `etiqueta`. Prioriza coordenadas;
  si no hay, cae a `mapsUrl(consulta)`; si no hay ninguna, texto plano.
- Call sites con `latitud`/`longitud`/`etiqueta`: `InfoEventoView.tsx` y `app/(site)/eventos/page.tsx`
  (ambos agregan los campos al `interface Recinto`).

### 2.8 Extra — resiliencia de red + logo (espejo GitHub `4f62df8`)

Cherry-pick de `luxyMedina1/proyectoggl@4f62df8` (no estaba en la rama de GitLab). Un solo
conflicto trivial en `app/(site)/layout.tsx` (formato del `<img>` del logo), resuelto a favor
de HEAD + el fallback.

- `api/apiApplication.ts`: `timeout: 20000` en la instancia axios; cuando no hay respuesta
  (`!error.response`), se normaliza `error.message` a un texto claro ("El servidor tardó
  demasiado…" / "No se pudo conectar…") en vez de `Network Error` / `timeout of 20000ms`.
- `app/(site)/layout.tsx`, `app/auth/(auth-layout)/layout.tsx`, `app/auth/completar_perfil/page.tsx`:
  `src={config?.logoMarca || "/logo.png"}` (antes quedaba `<img>` sin `src` si la config no cargaba).
- `app/opengraph-image.tsx`: dibuja el logo de marca sobre el degradado, con respaldo a texto.
- `scripts/reset-postgres.ps1`: utilidad para resetear el Postgres del backend v2 local
  (traída de `proyectoggl@1d276b0`).

### 2.9 Tema 05 — rendimiento/LCP (solo la parte de bajo riesgo)

El doc 05 es un plan, no un commit. De sus acciones se hicieron **las de bajo riesgo**; el grueso
(SSR de la lista para atacar el LCP de 23.4 s) queda **explícitamente fuera de esta tanda** para no
tocar el flujo de datos de la home.

**`app/(site)/eventos/page.tsx` → cáscara de servidor mínima.** Era `"use client"` (830 líneas). El
cuerpo cliente se movió **verbatim** a `app/(site)/eventos/EventosView.tsx` (solo cambia el nombre del
export y se añade `next/image`). El nuevo `page.tsx` es un Server Component que:
- Exporta `generateMetadata`: `title` "Eventos", `description` propia, `alternates.canonical`,
  `openGraph`/`twitter`. Antes la home heredaba solo las `<meta>` globales del layout.
  - **Imagen OG propia**: `openGraph.images`/`twitter.images` = **banner del primer evento del
    listado** (`imagenBanner || imagenPromocion`, ya es URL absoluta de S3). Si el listado viene
    vacío o sin imagen válida, se omite `images` y la ruta hereda `app/opengraph-image.tsx` (que ya
    dibuja el logo de marca — §2.8). La lista se comparte con `Page` vía `cache()` de React y el
    helper **nunca lanza** (cae a `[]`): un back caído no rompe la página ni el build.
- Lee la lista en el servidor con `getListaEventos()` de `utils/ogEvento.ts` (mismo endpoint, cache y
  tag `eventos:lista` que el sitemap) **solo** para emitir un `<script type="application/ld+json">`
  con un `ItemList` de schema.org. Si el back no responde, se omite el bloque y la página renderiza
  igual.
- Renderiza `<EventosView />`. **No le pasa datos**: la vista sigue pidiendo su propia copia en
  cliente. El render y el flujo de datos no cambian; el SSR de la lista para el LCP sigue pendiente.

**`utils/jsonLdEvento.ts`** — nueva función pura `construirItemListEventosJsonLd(eventos, siteUrl)`:
un `ListItem` por evento con `position` 1-indexada, `url` absoluta (mismo `rutaEvento` del resto del
sitio) y `name`. Tests en `utils/jsonLdEvento.itemList.test.ts` (4 casos: forma, orden/posición,
lista vacía/nula, serialización con `JSON.stringify`).

**`next/image` en `EventosView.tsx`** — los 4 `<img>` crudos del archivo pasan a `<Image>`:
- Hero (Swiper): `<Image fill>` con `sizes` móvil/escritorio, `object-cover`, y `preload` en el
  **primer slide** (elemento LCP; en Next 16 `priority` está deprecado a favor de `preload`). El slide
  ya tiene alto fijo (`h-48 lg:h-80`), así que `fill` reserva la caja → 0 CLS. Guard: si el evento no
  trae `imagenBanner`/`imagenPromocion`, cae a `/event_default.webp` (con `<img>` un `src=""` era
  tolerado; `<Image>` lanza).
- Card: `<Image fill>` dentro del `<a>` marcado `relative custom-pic` (el `aspect-ratio: 16/9` de
  `custom-pic` reserva la caja; el `<a>` es el ancestro posicionado que pide `fill`).
- Dos imágenes del modal de abonos/fechas: `<Image fill>` `object-contain`.
- Con `next/image` se activan AVIF/WebP y el TTL de 31 días que ya estaban en `next.config.ts`.
- `npm run audit:images`: el archivo de la home queda **sin hallazgos** (antes 4).

**`next.config.ts` → `headers()`** — nueva regla para `/_next/static/:path*` con
`Cache-Control: public, max-age=31536000, immutable` (assets con hash de contenido). Next ya lo hace
en su server; se declara explícito para que aplique también detrás de un proxy/CDN. Se actualizó
`next.config.test.ts` (buscaba exactamente 1 regla de `headers()`; ahora localiza la de seguridad por
`source` y verifica la nueva).

**Qué NO se hizo (y por qué):** convertir la home en cáscara que **alimente** la isla de cliente con
la lista ya resuelta en servidor (acción 1 del doc 05, la que de verdad ataca el LCP de 23.4 s),
`preload` de la URL concreta del banner, y `Cache-Control` para respuestas de datos. Es el cambio más
grande y arriesgado sobre la página principal; se decidió dejarlo anotado como pendiente.

---

## 3. Verificación

| Check | Resultado |
|-------|-----------|
| `npx tsc --noEmit` | ✅ limpio |
| `npm run build` | ✅ 39 rutas |
| `utils/promociones.ts` vs `main_v2` | ✅ idéntico byte a byte |
| `utils/promociones.test.ts` | ✅ 75/75 |
| Suite completa (`vitest run --pool=threads`) | ✅ 135/135 en 18 archivos |
| `npm run audit:images` (home) | ✅ 0 hallazgos en `EventosView.tsx` (antes 4) |
| Marcadores de conflicto en el árbol | ✅ ninguno |
| Restos de lógica local de promos (`filtrarPromocionesAplicables` / `obtenerMejorPromocion` / `MejorPromo`) | ✅ ninguno |

**Lo que NO se pudo verificar y necesita QA en navegador** (el backend de producción
`https://v2.taquillavipmx.com` ya responde, así que ahora sí se puede):

1. **Selección de asientos numerados** con promoción automática de cada tipo:
   - `PORCENTAJE`: descuento y subtotal correctos; y si `evento.udsPorCategoria`, que el
     **cargo por servicio baje** proporcional al descuento (no que se cobre sobre el precio lleno).
   - `CANTIDAD` (3x2, etc.): que el toast de "selecciona al menos N" solo salga cuando toca, y
     el descuento sea el precio de los asientos gratis.
   - `RESTA` (nuevo): descuento = `min(cantidadResta, precioAsiento)` por asiento que califica.
2. **Abonos** (`/abonos/[slug]/...`): lo mismo, más los flujos pareja/familia (que dependen de
   `porcentaje_original`).
3. **Código manual de descuento** en ambas páginas por-asientos (campo de texto).
4. **Multifecha**: abrir un evento multifecha sin función → debe caer en
   `/eventos/informacion/[slug]` y listar fechas + abonos; el rango de fechas del encabezado.
5. **Deseleccionar todos los asientos** con promo activa: no debe saltar el toast falso.
6. **Home `/eventos` (tema 05)**: que el hero (Swiper) y las cards se vean igual con `next/image`
   (`fill` + `object-cover`/`object-contain`, esquinas redondeadas, `polygon-shape` en `lg`); que el
   primer banner cargue temprano (`<link rel=preload>` en el `<head>`); que no haya salto de layout
   al cargar. Comprobar que **todas** las imágenes de evento salgan del bucket S3 permitido
   (`next/image` con `src` de otro host **rompe el build**, no falla en runtime). Ver la tarjeta al
   compartir `…/eventos` (título/descripcion propios) y el `ItemList` en el Rich Results Test.

---

## 4. Pendiente / mejoras futuras

- **Redirección multifecha en el servidor**: hoy es un `router.replace` en el cliente
  (`EventoDetalleView.tsx`). La guía 00 sugiere resolverlo en el Server Component / middleware
  para evitar el flash. Requiere mover la resolución del detalle a servidor.
- **Centralizar el criterio de multifecha** (`esMultiFuncion && díasDistintos > 1`): hoy está
  repetido en home, catálogo, detalle e información. Igual que con promociones, conviene un
  helper único.
- **Tema 05 (LCP) — el grueso**: hecho lo de bajo riesgo (§ 2.9: cáscara de servidor mínima,
  `next/image`, `Cache-Control` inmutable). Falta lo que de verdad ataca el LCP de 23.4 s:
  **convertir `/eventos` en cáscara que alimente la isla de cliente con la lista ya resuelta en
  servidor** (hoy `page.tsx` la lee solo para el JSON-LD; `EventosView` sigue haciendo su propio
  fetch), `preload` de la URL concreta del banner, y `Cache-Control` para respuestas de datos.
  Ver [`docs/commits-nuevos/05-rendimiento-lcp-next.md`](../commits-nuevos/05-rendimiento-lcp-next.md).
- **Redirección multifecha en el servidor** y **centralizar el criterio de multifecha**: ver arriba.
- **Commit**: todo está sin commitear. Sugerencia de troceo:
  1. `utils/promociones.ts` + test + `fast-check` + cableado por-boletos
  2. cableado por-asientos (numerados + abonos) + recálculo del UDS
  3. tema 00 (leyenda + multifecha)
  4. temas 02, 03, 04
  5. resiliencia de red + logo + `reset-postgres.ps1`
  6. tema 05 bajo riesgo: `page.tsx`/`EventosView.tsx` split + `generateMetadata` + `ItemList`
     (`utils/jsonLdEvento.ts` + test), `next/image` en la home, `Cache-Control` en `next.config.ts`
     (+ `next.config.test.ts`), README

---

## 5. Nota sobre el repositorio v2

- HTTPS funciona: `git clone https://git.redgl.com/desarrollo/taquillavipfrontend-v2.git`
  (SSH falla por `publickey` en este entorno). La carpeta local ya está en
  `../TaquillaVipFrontend v2/taquillavipfrontend-v2`.
- El helper y sus tests están en la rama **`main_v2`** (no en `main`, que es más vieja).
  El rango `fecdc62..a2e80bb` de `docs/commits-nuevos/` vive ahí.
- **`origin/main_v2` sigue en `a2e80bb`** tras `git fetch` (2026-09-09): **0 commits nuevos** que
  portar desde la rama fuente documentada. Hay trabajo en otras ramas remotas —`feat-recaptcha`,
  y commits sueltos "Aplicar promos por categoria" / "Cargos por categoria" / "Promos aplican
  directo y limite de promo" / "Login con Google"— pero **no están mergeados a `main_v2`**, así que
  quedan fuera de esta migración hasta que alguien decida cuáles entran y por qué orden.
- El espejo de GitHub `luxyMedina1/proyectoggl` está sobre una **base vieja** (`f3c6438`, sin
  el trabajo de GitLab de SEO/legales/cache). Solo aporta `4f62df8` (resiliencia) y
  `1d276b0` (docs + `reset-postgres.ps1`), ya integrados aquí. **No hacer `reset` a esa rama.**

---

## 6. Archivos tocados (todo el working tree de esta migración)

`git diff --stat`: **20 archivos modificados + 4 nuevos** (sin contar este reporte), −1 682 / +1 086
líneas netas en el árbol sin stagear, más 5 archivos ya en el índice del cherry-pick de resiliencia.

### Nuevos

| Archivo | Tema | Qué es |
|---|---|---|
| `utils/promociones.ts` | 01 | Helper puro de promociones (copia verbatim de `main_v2`) |
| `utils/promociones.test.ts` | 01 | 75 tests property-based (`fast-check`) |
| `app/(site)/eventos/EventosView.tsx` | 05 | Cuerpo cliente de la home movido **verbatim** desde `page.tsx` + `next/image` |
| `utils/jsonLdEvento.itemList.test.ts` | 05 | 4 tests del `ItemList` JSON-LD |
| `scripts/reset-postgres.ps1` | extra | Reset del Postgres del backend v2 local (de `proyectoggl@1d276b0`) — **ya en el índice** |

### Modificados

| Archivo | Tema(s) | Cambio |
|---|---|---|
| `eventos/pages/formConferenciaPage.tsx` | 01 | Cableado por-boletos al helper; soporte `RESTA` |
| `app/(site)/eventos/[slug]/EventoDetalleView.tsx` | 01, 00 | Cableado por-boletos + leyenda configurable, orden DAYPASS, redirección multifecha |
| `app/(site)/eventos/[slug]/[seccionId]/[seccion]/page.tsx` | 01 | Cableado por-asientos + recálculo/restauración del UDS + rama `RESTA` (−~200 líneas) |
| `app/(site)/abonos/[slug]/[seccionId]/[seccion]/page.tsx` | 01 | Ídem, más una copia inline extra eliminada (−~200 líneas) |
| `app/(site)/eventos/informacion/[slug]/InfoEventoView.tsx` | 00, 04 | UI multifecha (abonos + grid de fechas), rango de fechas del encabezado, `DireccionMapsLink` por lat/lon |
| `eventos/pages/perfil/components/BoletoCard.tsx` | 02 | `precioOriginal?` + `promocion?`; etiqueta `PROMO:` y precio tachado |
| `eventos/pages/perfil/components/DetallesPedidoTab.tsx` | 02 | Mismos campos; chip `· <promo>` por línea; inversión de precedencia de precio |
| `utils/mapsHelpers.ts` | 04 | Nueva `coordenadasMapsUrl(lat, lng, etiqueta?)` |
| `components/DireccionMapsLink.tsx` | 04 | Props `latitud` / `longitud` / `etiqueta`; prioriza coordenadas |
| `api/apiApplication.ts` | extra | `timeout: 20000` + normalización de `error.message` sin respuesta — **ya en el índice** |
| `app/(site)/layout.tsx` | extra | `src={config?.logoMarca \|\| "/logo.png"}` (×3) — **ya en el índice** |
| `app/auth/(auth-layout)/layout.tsx` | extra | Ídem fallback de logo — **ya en el índice** |
| `app/auth/completar_perfil/page.tsx` | extra | Ídem fallback de logo — **ya en el índice** |
| `app/opengraph-image.tsx` | extra | Dibuja el logo de marca sobre el degradado (respaldo a texto) — **ya en el índice** |
| `app/(site)/eventos/page.tsx` | 03, 04, 05 | Reescrito como **Server Component**: `generateMetadata` (título/descr./canonical/OG + **imagen OG del evento destacado**) + `ItemList` JSON-LD; renderiza `<EventosView/>`. La lógica de tema 03/04 vive ahora en `EventosView.tsx` |
| `utils/jsonLdEvento.ts` | 05 | Nueva `construirItemListEventosJsonLd(eventos, siteUrl)` (pura) + tipo `EventoParaItemList` |
| `next.config.ts` | 05 | Regla `headers()` para `/_next/static/:path*` → `Cache-Control: public, max-age=31536000, immutable` |
| `next.config.test.ts` | 05 | Localiza la regla de seguridad por `source` + verifica la nueva regla de caché |
| `package.json` / `package-lock.json` | 01 | `fast-check@^4.9.0` como `devDependency` |
| `README.md` | 00–05 | Recuentos (23 páginas cliente, 4 `generateMetadata`, 111 `<img>` / 2 archivos migrados, 135 pruebas), estado de migración, *Última revisión* → 2026-09-09 |
| `docs/reportes/2026-09-09-helper-promociones.md` | — | Este reporte |

### Ya commiteado (fuera de esta tanda)

- `b52686e` — solo los 6 documentos de `docs/commits-nuevos/` (referencia), sin código.
