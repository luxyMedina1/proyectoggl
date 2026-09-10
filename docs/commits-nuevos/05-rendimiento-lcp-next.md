# 5. Rendimiento y LCP — plan para v3 (Next.js)

Este documento **no corresponde a un commit**: es el plan de trabajo para atacar el rendimiento en v3, motivado por el reporte de PageSpeed Insights de la home (`/eventos`).

> Este plan está aterrizado sobre el código real del repo. Antes de asumir "Next lo resuelve solo", revisa qué ya está hecho (§ Estado actual del código) y ataca lo que **de verdad falta** (§ Acciones concretas). El elemento LCP de la home es el **banner grande (Swiper) de la parte superior**, hoy renderizado en cliente con `<img>` crudos.

## Diagnóstico actual (PageSpeed Insights)

| Métrica | Móvil | Escritorio |
|---|---|---|
| Rendimiento | **42** | **31** |
| First Contentful Paint (FCP) | 1.1 s ✅ | 0.3 s ✅ |
| **Largest Contentful Paint (LCP)** | **23.4 s** 🔴 | **5.2 s** 🔴 |
| Total Blocking Time (TBT) | 240 ms 🟠 | 590 ms 🔴 |
| Speed Index | 5.5 s 🟠 | 2.4 s 🔴 |
| Cumulative Layout Shift (CLS) | 0.828 🔴 | 0.341 🔴 |
| Accesibilidad / SEO / Prácticas | 84 / 100 / 96 | 84 / 96 / 96 |

Lo crítico: **el FCP es bueno pero el LCP es malísimo** (23.4 s en móvil). El primer pixel pinta rápido (el shell), pero **el elemento principal (el banner del hero) tarda muchísimo**. El CLS también está muy alto (la página "salta" mientras carga).

**Por qué pasa exactamente esto en la home:** `app/(site)/eventos/page.tsx` es `"use client"` y trae los datos en `useEffect` vía axios (`getListaEventos()` → `apiApplication`). El HTML inicial es prácticamente un shell + `<LocalLoader />`. El banner solo aparece **después** de que el bundle de React arranca, se ejecuta el `fetch` XHR y se resuelve; recién ahí se conoce la URL de la imagen y empieza su descarga. De ahí el LCP de 23.4 s. El axios client **no** participa del cache de `fetch` de Next, así que la lista se vuelve a pedir en cada visita sin render ni cache de servidor.

## Oportunidades que reportó PageSpeed

- **Usar tiempos de vida de caché eficientes** — ahorro estimado ~4393 KiB
- **Mejorar la entrega de imágenes** — ahorro estimado ~4336 KiB
- **Solicitudes que bloquean el renderizado** — ~120 ms
- **Causantes de los cambios de diseño** (CLS)
- **Desglose de LCP** / **Descubrimiento de solicitudes de LCP**
- **Redistribución forzada** (layout thrashing)
- **Árbol de dependencia de red**
- **JavaScript antiguo** — ahorro ~26 KiB

Las dos grandes: **entrega de imágenes** (~4.3 MB) y **caché** (~4.4 MB). El elemento LCP es el **banner/hero** de la home.

## Estado actual del código (qué YA está hecho)

Buena parte de la infraestructura ya existe. No hay que rehacerla, hay que **usarla desde la home**:

- ✅ **`next/font` (Poppins) self-hosted** en `app/layout.tsx` con `display: "swap"` y `variable: "--font-poppins"`. El navegador no habla con `fonts.googleapis.com`/`gstatic` y hay fallback con métricas ajustadas → **CLS por fuentes ya = 0**.
- ✅ **`preconnect` al bucket S3 del LCP** ya está en el `<head>` de `app/layout.tsx`: `https://taquilla-v2-files.s3.us-east-1.amazonaws.com`. Falta el `preload` de la imagen concreta (bloqueado hoy porque la URL solo se conoce tras el fetch en cliente — el punto 1 de abajo lo desbloquea).
- ✅ **`next.config.ts` → `images`** ya está listo para `next/image`: `remotePatterns` solo permite el bucket S3, `formats: ["image/avif", "image/webp"]`, `minimumCacheTTL: 2678400` (31 días). **El problema es que la home usa `<img>` crudos, así que nada de esto aplica al banner ni a las cards.**
- ✅ **Patrón de fetch de servidor con cache y tags** ya implementado en `lib/config/getSiteConfig.ts`: `fetch(..., { cache: "force-cache", next: { revalidate: 3600, tags: ["config:sitio"] } })` envuelto en `cache()` de React, con fallback. Este es el patrón a copiar para la lista de eventos.
- ✅ **Endpoint de revalidación** `app/api/revalidate/route.ts` funcionando (secreto en tiempo constante + rate limit + allowlist). El tag **`eventos:lista` ya existe en la allowlist**, pero hoy nada lo consume porque la home hace fetch en cliente.
- ✅ Root layout (`app/layout.tsx`) es **Server Component**; los providers (`app/providers.tsx`) se siembran con datos de servidor (`configInicial`, `coloresIniciales`).
- ✅ `optimizePackageImports` y `reactCompiler` ya activos en `next.config.ts`.

### Qué falta (los huecos reales)

- 🔴 `app/(site)/eventos/page.tsx` es `"use client"` y hace el fetch de eventos y categorías en cliente (axios) → **sin render ni cache de servidor**. Es la causa raíz del LCP.
- 🔴 El banner (Swiper, ~líneas 455-469) y las cards (~líneas 561-566) usan `<img>` crudos **sin `width`/`height`, sin `priority`, sin `sizes`** → CLS + LCP sin optimizar. `npm run audit:images` los marca (los `<img>` con solo `w-full`/`h-*` cuentan como sin dimensionar).
- 🔴 No hay `preload` de la imagen del LCP.
- 🔴 No hay `Cache-Control` en `headers()` de `next.config.ts` (solo cabeceras de seguridad).
- 🟠 `app/(site)/layout.tsx` es un `"use client"` grande (header + footer, polling de notificaciones cada 60 s, muchos `react-icons`) que envuelve toda la home.

## Acciones concretas para v3

### LCP (prioridad máxima)

1. **Convertir la home en un shell de servidor con isla de cliente.** Mover el fetch de la lista de eventos fuera del `"use client"`:
   - Crear un `page.tsx` (Server Component) en `app/(site)/eventos/` que haga `const eventos = await fetch(\`${apiBase}/eventos/get_all_select?tipoDispositivo=web\`, { next: { revalidate: <ttl>, tags: ["eventos:lista"] } })` — mismo patrón que `lib/config/getSiteConfig.ts` (con `x-api-key`, `AbortSignal.timeout`, fallback). **No** usar el axios client aquí: axios no entra al cache de `fetch` de Next.
   - Pasar `eventos` (y `config?.rutaBase`) como props a un componente cliente (p. ej. `EventosView.tsx` `"use client"`) que conserve Swiper, filtros, búsqueda y el modal. El markup del hero + primeras cards ya vive en el HTML inicial.
   - Esto conecta la home al tag **`eventos:lista`** que ya invalida el backend, y ataca directamente el LCP de 23.4 s y "Descubrimiento de solicitudes de LCP".

2. **Banner con `next/image` (el elemento LCP).** Reemplazar los `<img>` del Swiper (líneas ~455-469) por `next/image`:
   - `priority` en el **primer slide** (precarga el LCP, sin `lazy`). Ojo: en Next 16 `priority` está deprecado a favor de `fetchPriority` / `loading` según la doc instalada en `node_modules/next/dist/docs/` — verifica ahí la API exacta antes de escribir.
   - `width`/`height` explícitos o `fill` + contenedor con aspect-ratio (evita CLS). El contenedor ya tiene alto fijo (`h-48 lg:h-80`), así que `fill` + `object-cover` encaja bien.
   - `sizes` correcto para móvil vs escritorio (el banner ocupa la mitad derecha en `lg`).
   - Con `next/image` se activan AVIF/WebP y el TTL de 31 días que **ya** están en `next.config.ts`.

3. **`preload` del banner del LCP.** Una vez que la URL del banner se resuelve en servidor (acción 1), añadir el `preload` de esa imagen concreta en el `<head>` (o dejar que `next/image priority` lo emita). Complementa el `preconnect` a S3 que ya existe.

### CLS (0.828 móvil)

- Reservar espacio para el hero, el Swiper y las cards de "Próximos Eventos" con dimensiones/aspect-ratio fijos. Usar `next/image` con `width`/`height` o `fill` en contenedor con aspect-ratio.
- Correr `npm run audit:images` y cerrar los hallazgos por prioridad (el script prioriza `eventos/[slug]` → tarjetas → layout → resto). Recordar que `w-full` + `h-*` **no** cuenta como dimensionado para el script.
- Fuentes: **ya cubierto** por `next/font` (no re-hacer).
- No insertar contenido por encima del hero después de la carga (evitar que el fetch en cliente empuje el layout — se resuelve con la acción 1).

### TBT / JS

- Aprovechar el shell de servidor (acción 1) para **enviar menos JS al cliente**: los helpers de fecha/agrupación de `utils/` que hoy corren en el `"use client"` pueden ejecutarse en servidor donde aplique.
- Acotar `"use client"` a lo interactivo (Swiper, filtros, modal de funciones/abonos). Considerar bajar el boundary de `app/(site)/layout.tsx` (hoy todo el header/footer es cliente).
- Cargar Swiper y sweetalert2 solo en la isla de cliente (ya lo hace, pero al separar el shell dejan de bloquear el markup inicial).
- "JavaScript antiguo": confirmar el target de build moderno; `optimizePackageImports` y `reactCompiler` ya ayudan.

### Caché / red

- Añadir `Cache-Control` en `headers()` de `next.config.ts` para assets versionados (`immutable`). Hoy solo hay cabeceras de seguridad.
- La lista de eventos queda cacheada por el `fetch` de servidor con `revalidate` + tag `eventos:lista` (acción 1); la invalidación real la sigue disparando el backend vía `/api/revalidate`.
- CDN delante de imágenes y estáticos (S3 ya es el origen del LCP).
- **Recordatorio de repo:** si tocas config de CI, hay dos archivos equivalentes (`.github/workflows/ci.yml` y `.gitlab-ci.yml`); cambia uno, cambia el otro.

## Cómo medir el progreso

Correr `npm run verify` (typecheck + test + build) tras cada bloque, y volver a correr PageSpeed Insights (móvil y escritorio) comparando contra la tabla base de arriba. Usar `npm run audit:images` para el CLS y `npm run analyze` para vigilar el bundle. **La meta principal es bajar el LCP a < 2.5 s y el CLS a < 0.1.**

> Nota: las métricas de PageSpeed son estimaciones y varían entre corridas; usa varias mediciones para confirmar tendencias.

## SEO — lo que falta

Ya hecho (no re-hacer): `app/sitemap.ts` (eventos + informacion + CityPass, `revalidate: 3600`, particionable), `app/robots.ts` (allow `/`, disallow de privadas, apunta al sitemap), `generateMetadata` + JSON-LD server-side en detalle de evento (`app/(site)/eventos/[slug]/page.tsx`), informacion, CityPass y Cosmotech, `notFound()` real (sin soft 404) y `canonical` por ruta.

- 🔴 **La home `/eventos` no tiene `generateMetadata` propio.** Hereda las `<meta>` globales del layout raíz; no emite `title`/`description`/`canonical` específicos de la home. Al pasarla a shell de servidor (acción 1 de LCP), añadir un `generateMetadata` con `alternates: { canonical: \`${SITE_URL}/eventos\` }` y descripción propia.
- 🔴 **Sin `ItemList` JSON-LD en la home.** La lista de "Próximos Eventos" no emite structured data. Con el shell de servidor se puede emitir un `ItemList` (o `Event[]`) reutilizando el patrón de `utils/jsonLdEvento.ts`.
- 🟠 **`/explorar` está en el sitemap pero conviene verificar** que tenga `generateMetadata` propio (hoy solo `page.tsx`). Si es client-only, aplica el mismo patrón de shell de servidor.
- 🟠 El sitemap usa una sola partición (id 0); documentado, solo vigilar el límite de 50.000 URLs de Google.

## Open Graph — lo que falta

Ya hecho: OG/Twitter server-side en detalle de evento, informacion, CityPass y Cosmotech (vía `utils/ogEvento.ts` con `fetch` cacheado, tags e imagen `imagenPromocion`), imagen OG de respaldo generada con `next/og` (`app/opengraph-image.tsx`, 1200×630), `metadataBase` en el layout para resolver URLs relativas.

- 🟢 **Hecho.** El `generateMetadata` de `/eventos` declara `openGraph`/`twitter` propios. El `<title>` del documento es "Eventos" (para SEO/pestaña), pero la tarjeta al compartir usa la **marca** en `og:title`/`twitter:title` y **hereda la imagen OG de respaldo** (`app/opengraph-image.tsx`, logo sobre degradado): la home es el índice del sitio y atar su portada compartida al banner de un evento suelto se veía mal cuando la lista venía vacía.
- � **El OG de fallback (`app/opengraph-image.tsx`) usa solo texto, no el logo de la marca.** Hoy pinta un `<div>` con `NEXT_PUBLIC_TITLE_APP` sobre un degradado; ignora la configuración. Debería usar el **logo de configuración** (`config.logo` de `getSiteConfig()`, mismo `ConfigResponse` que ya alimenta layout y colores) para que la tarjeta de respaldo muestre la marca real. Nota: `ImageResponse`/`next/og` no acepta `next/image`; cargar el logo como `<img src={config.logo} />` dentro del JSX de `ImageResponse`, con fallback al texto actual si `config` es `null` (el `getSiteConfig` ya cae a `DEFAULT_COLORS` cuando el backend no responde).

## Seguridad — lo que falta

Ya hecho: endpoint `/api/revalidate` con secreto en tiempo constante (`timingSafeEqual`) + rate limit por IP + allowlist de tags, cabeceras de seguridad en `next.config.ts` (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'self'`), JSON-LD emitido con `JSON.stringify` (sin inyección), rutas privadas fuera del sitemap y en `robots` disallow.

- 🔴 **`NEXT_PUBLIC_API_KEY` viaja al navegador** (hallazgo de auditoría conocido). Sigue pendiente mover la sesión/clave a cookie `httpOnly` y proxiar el backend desde route handlers, para dejar de exponer la key en el bundle (visible en view-source).
- 🟠 **No hay CSP completa**, solo `frame-ancestors 'self'`. El sitio carga SDKs de terceros (Google/Apple) y `sweetalert2`/`next/script`. Evaluar una CSP con `script-src` + nonces cuando se pueda, priorizando el checkout.
- 🟠 **Confirmar `REVALIDATE_SECRET` distinto por entorno** (staging vs producción): un valor compartido deja que staging invalide la caché de producción. Verificar en la config de despliegue, no solo en `.env.example`.
- 🟠 **La sesión vive en `localStorage`** (`utils/authStorage.ts`), no en cookie: expuesta a XSS. Ligado al punto de la API key; el movimiento a cookie `httpOnly` cubre ambos y además desbloquea SSR de perfil/compras.

## Cómo medir el progreso

Correr `npm run verify` (typecheck + test + build) tras cada bloque, y volver a correr PageSpeed Insights (móvil y escritorio) comparando contra la tabla base de arriba. Usar `npm run audit:images` para el CLS y `npm run analyze` para vigilar el bundle. Para SEO/OG, validar con el Rich Results Test de Google y el depurador de compartir de Facebook/WhatsApp. **La meta principal es bajar el LCP a < 2.5 s y el CLS a < 0.1.**

> Nota: las métricas de PageSpeed son estimaciones y varían entre corridas; usa varias mediciones para confirmar tendencias.
