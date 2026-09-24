# Reporte — QA en navegador, título de asientos y rendimiento de `/eventos` (lista en el servidor)

**Fecha:** 2026-09-24 (tarde; complementa [`2026-09-24-paridad-v2-selector-fechas-y-orden-precios.md`](./2026-09-24-paridad-v2-selector-fechas-y-orden-precios.md))
**Proyecto:** frontend v3 (Next 16.3.4 App Router)
**Rama:** `migracion-v2-v3`
**Repos:** `git.redgl.com/desarrollo/taquillavipfrontend-v3` (`origin`, GitLab) · `github.com/luxyMedina1/proyectoggl` (`proyectoggl`, GitHub)
**Backend usado:** producción (`https://v2.taquillavipmx.com`), solo lectura. No se reservó ni se pagó nada.

**Estado del build:**

- `npm run typecheck` → ✅ limpio
- `npx vitest run --pool=threads` → ✅ 174/174 en 26 archivos
- `npx next build` → ✅ sin errores
- Navegador (Chromium headless + Chrome del usuario): sin errores de hidratación en `/eventos`

---

## 1. Resumen ejecutivo

| Tarea | Commit | Estado |
|---|---|---|
| Merge de los docs de Lucy (`proyectoggl/main`) | `a4451a8` | ✅ un conflicto en doc 06, resuelto conservando ambos lados |
| QA en navegador: selector de fechas, orden por precio, descuento RESTA por asientos | — | ✅ todo correcto (§2) |
| Título de la pantalla de asientos decía `VIP%20CENTRAL` | `63ed95b` | ✅ arreglado |
| `fetchpriority=high` en la imagen LCP de `/eventos` | `0ccc547` | ✅ |
| Lista de `/eventos` resuelta en el servidor y pintada en el HTML inicial | este commit | ✅ |
| `experimental.inlineCss` | `0ccc547` → revertido aquí | ❌ descartado, sale más caro de lo que ahorra (§4.3) |
| Caché de S3, cargo por servicio > $0, PORCENTAJE/CANTIDAD, deploy | — | ⏳ dependen de otras personas (§6) |

---

## 2. QA en navegador (producción)

Producción solo tiene 3 eventos: Sky Fest Laguna (generales, multifunción), Tuff Riders y Ronda & Jazz (numerados).

| Prueba | Evento | Resultado |
|---|---|---|
| Selector de fechas: cambiar de función navega, cambia título/horario/apertura y la URL no se revierte | Sky Fest Laguna (7 matutino → 8 vespertino) | ✅ |
| Precios por función se vuelven a pedir al cambiar de fecha | Sky Fest ($180/$650 → $250/$750) | ✅ |
| Orden por precio ASC, DAYPASS al final | Sky Fest y Ronda & Jazz | ✅ |
| Descuento RESTA por asientos, 2 asientos | Ronda & Jazz, VIP CENTRAL: 2 × $350 − $100 "DSCTO" = **$600** | ✅ |
| Descuento RESTA se recalcula al quitar un asiento | 1 × $350 − $50 = **$300** | ✅ |
| Errores de consola | — | ✅ ninguno |

Durante la prueba de asientos se neutralizó `window.fbq` en la pestaña para no mandar `AddToCart`
falsos al pixel real de Meta.

**No se pudo probar** (no hay datos en producción): promociones **PORCENTAJE** y **CANTIDAD** (ningún
evento las tiene; la lógica está cubierta por las 75 pruebas de `utils/promociones.test.ts`),
**cargo por servicio > $0** (los 3 eventos tienen `uds = 0`: "los boletos ya incluyen cargos") y la
promo de Tuff Riders (pide código).

---

## 3. Título de asientos `VIP%20CENTRAL` (`63ed95b`)

`useParams()` de Next devuelve el segmento tal cual viene en la URL; react-router (v2) lo entregaba
decodificado. El título de `/eventos/[slug]/[seccionId]/[seccion]` y del equivalente de abonos decía
"Sección: VIP%20CENTRAL". Se decodifica solo para mostrarlo (`decodeURIComponent` con `try/catch`).

---

## 4. Rendimiento de `/eventos`

### 4.1 Punto de partida (PageSpeed del usuario)

"Tiempos de caché eficientes" (222 KiB), "Solicitudes de bloqueo de renderización" (100 ms),
"Descubrimiento de solicitudes de LCP", "Árbol de dependencias de red", "JavaScript heredado" (26 KiB),
"Causantes del cambio de diseño", "Desglose de LCP".

La API pública de PageSpeed se quedó sin cuota diaria, así que se midió con **Lighthouse 12 local**
(móvil, throttling simulado). Los tiempos absolutos de esta máquina bailan; lo confiable es qué
auditorías pasan y el desglose del LCP.

### 4.2 Lista de eventos en el servidor (acción principal del doc 05)

**Antes:** `page.tsx` ya leía la lista en el servidor, pero solo para el JSON-LD. `EventosView`
(`"use client"`) la volvía a pedir con axios en un `useEffect`, y además `useSearchParams()` dentro del
`<Suspense>` hacía *bailout* de CSR en la ruta estática: el HTML inicial no traía ni banner ni grid.
La imagen LCP se descubría hasta que el JS arrancaba y respondía el fetch.

**Ahora:**

- `page.tsx` llama `connection()` → ruta dinámica, `useSearchParams()` tiene valor en el render del
  servidor (doc de Next `use-search-params`, "Dynamic Rendering"). Los filtros `?ciudad=` y `?buscar=`
  salen aplicados desde el HTML.
- La lista sigue cacheada 5 min con el tag `eventos:lista` (`apiGet` de `utils/ogEvento.ts`,
  invalidable por `/api/revalidate`): no hay petición al back en cada visita.
- Se le pasa a `EventosView` como `eventosIniciales`, **sin** los campos pesados que la vista no usa
  (`descripcion`, `descripcionExtra`, `cliente`, `leyendaMapa`, `imagenBoleto*`, `seo`,
  `camposIncluidosEnBoleto`): todo lo que va como prop viaja en el payload RSC.
- `EventosView` arranca con esa lista; el fetch de cliente se mantiene como **refresco silencioso**
  (sin loader, sin modal de error si ya hay datos, conserva el slide activo).
- Imagen del banner: `preload` + `fetchPriority="high"` (Next propaga `fetchPriority` al
  `<link rel="preload">` que genera, `image-component.js` → `ImagePreload`).

**Verificado:** los 3 eventos en el HTML inicial; `?ciudad=4` (Durango) muestra los eventos,
`?ciudad=999999` muestra "No hay eventos disponibles"; `?buscar=ronda` deja solo Ronda & Jazz; sin
errores de hidratación.

### 4.3 `experimental.inlineCss`: probado y descartado

Quita el aviso de "bloqueo de renderización", pero:

| | Sin inlineCss | Con inlineCss |
|---|---|---|
| CSS en el HTML | 0 (4 `<link>`, cacheados 1 año) | ~134 KB sin comprimir en `<style>` **y otra vez** en el payload RSC |
| HTML de `/eventos` comprimido | ~15 KB | ~88 KB |
| Navegaciones de cliente | CSS ya cacheado | Se re-descarga en cada RSC |

El "22 KB" que marcaba Lighthouse era el tamaño comprimido; el CSS real (Tailwind + swiper +
toastify + `@font-face` de Poppins) es mucho mayor. Se revirtió y quedó documentado en `next.config.ts`
para que nadie lo vuelva a prender sin medir.

### 4.4 Mediciones (Lighthouse local, móvil)

| Corrida | Perf | LCP | TBT | CLS | Retraso de carga del LCP |
|---|---|---|---|---|---|
| Inicio (vía túnel) | 49 | 6.5 s | 1,290 ms | 0.004 | **1,081 ms** |
| + fetchpriority + inlineCss (vía túnel) | 66 | 4.7 s | 510 ms | 0.004 | 879 ms |
| **Final: SSR + fetchpriority, sin inlineCss** (localhost) | 66 | 4.7 s | 660 ms | **0** | **40 ms** |

La cifra que más cambia es el **retraso de carga del LCP** (tiempo entre que llega el HTML y empieza a
bajar la imagen): de ~1 s a 40 ms, porque la imagen ya está en el HTML. Hay que confirmar con
**PageSpeed Insights** contra un túnel o deploy cuando vuelva la cuota.

### 4.5 Lo que Lighthouse sigue marcando y por qué se queda

| Aviso | Causa | Acción |
|---|---|---|
| Caché (≈215 KiB) | ~150 KB son `fbevents.js`/`signals` de Facebook (TTL 20 min, de terceros). ~50 KB son el logo `TaquillaBlanco.svg`, que S3 sirve **sin `Cache-Control`** | **Backend**: al subir a S3 poner `CacheControl: "public, max-age=31536000, immutable"` (los nombres llevan UUID); para los existentes, `aws s3 cp --metadata-directive REPLACE` |
| JavaScript heredado (≈25 KiB) | 12 KB de `fbevents.js` + 13 KB del `polyfill-module` que Next incluye siempre al inicio de su chunk | No configurable |
| Árbol de dependencias de red | Sugiere `preconnect` a `connect.facebook.net` | No se agrega: el pixel se carga a propósito en idle; conectar antes le quita ancho de banda al LCP |
| Bloqueo de renderización (≈100–250 ms) | 4 CSS con `<link>` | Aceptado (ver §4.3) |
| TBT | Bundle de `EventosView` (redux + swiper + sweetalert2) | Pendiente (§6) |

---

## 5. Archivos tocados

| Archivo | Cambio |
|---|---|
| `app/(site)/eventos/page.tsx` | `connection()`, `paraCliente()` (quita campos pesados), pasa `eventosIniciales` |
| `app/(site)/eventos/EventosView.tsx` | Prop `eventosIniciales`, estado inicial sembrado, refresco silencioso; `preload` + `fetchPriority` en el banner; `Evento` exportado |
| `next.config.ts` | `inlineCss` retirado, con el porqué |
| `app/(site)/eventos/[slug]/[seccionId]/[seccion]/page.tsx`, `app/(site)/abonos/.../page.tsx` | Título de sección decodificado (`63ed95b`) |
| `README.md`, `docs/commits-nuevos/05-…`, `docs/commits-nuevos/README.md` | Estado actualizado |

---

## 6. Pendiente

**Depende de otras personas:**

- **Deploy de v3**: no hay Dockerfile ni pipeline; preguntar a quien despliega v2 hoy y documentarlo en el README.
- **Backend (RIADWaffle)**: `Cache-Control` en las subidas a S3 (§4.5); un evento de prueba con cargo
  por servicio > $0 y promociones PORCENTAJE/CANTIDAD para terminar el QA de §2.
- **Lucy**: `git pull` de `migracion-v2-v3` antes de seguir; su `main` de GitHub no tiene estos commits.

**Código (siguiente paso sugerido):**

- **TBT de `/eventos`**: separar del bundle inicial lo que no se ve al cargar (modal de funciones,
  sweetalert2 ya es dinámico en otras rutas).
- **`/explorar`**: última página pública `'use client'`; mismo patrón que `/eventos` (datos del servidor como estado inicial).
- **46 `<img>` sin dimensiones** (`npm run audit:images`).
- **Sesión en cookie `httpOnly`** (destraba perfil en servidor y sacar la API key del navegador).
- **Merge request `migracion-v2-v3` → `main`**, después del deploy y del QA pendiente.
