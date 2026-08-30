# Reporte de avance — Migración a Next nativo

**Fecha:** 2026-08-28
**Proyecto:** `taquillavipfrontend-v3`
**Referencia:** `docs/checklist-migracion/` (docs 01–09)
**Estado del build:** `npm run build` ✅ verde (24 rutas) · `npx tsc --noEmit` ✅ limpio
**Continuación:** el pase de rendimiento + automatización que sigue a este reporte
está en `docs/reportes/2026-08-28-rendimiento-y-automatizacion.md` (cierra los
puntos 2 y 4 de §11).

---

## 1. Resumen ejecutivo

Se completó la **migración de plataforma** (Vite → Next App Router, retiro de react-router) y un
primer corte de optimizaciones. En concreto, en esta sesión se aplicó:

| Doc | Tema | Estado |
|-----|------|--------|
| 04 | Metadatos / Open Graph | ✅ Hecho (3 rutas de contenido + fallback + robots + sitemap) |
| 07 | Fuentes (`next/font`) | ✅ Hecho |
| 08 | Fechas + code-splitting | 🟡 Parcial (fechas ✅, `html2canvas`/`mammoth` diferidos ✅, falta `sweetalert2`) |
| 03 | Endpoint de revalidación | ✅ Endpoint listo (backend pendiente de cablear) |
| 06 | Imágenes (`next/image`) | 🟡 Parcial (`remotePatterns` ✅ + 13 de 125 `<img>`) |
| 09 | Retiro de react-router | ✅ Hecho (verificado: 0 referencias) |
| 01 / 02 | Server Components + caché de datos | 🔴 Bloqueado (ver §7) |

Además: **limpieza** de código y assets muertos, y **retiro del repo v2** (`GGL_taquilla_next/`).

**Open Graph validado** contra el Sharing Debugger de Facebook (vía túnel): las páginas de evento
generan `og:title`, `og:description` y `og:image` reales; Facebook descarga la imagen sin error.

---

## 2. Doc 04 — Metadatos y Open Graph

**Problema que resuelve:** los scrapers de WhatsApp/Facebook/X/Telegram/LinkedIn no ejecutan JS.
Antes, cualquier evento compartido mostraba el mismo título genérico "TaquillaVip" y ninguna imagen.

### Cambios

| Archivo | Qué |
|---------|-----|
| `app/layout.tsx` | Metadata global: `metadataBase`, `title.template` (`%s \| Taquilla`), `openGraph`/`twitter` base. Se quitó la imagen OG hardcodeada (`/banner-firme.png`, 3 MB) para que la aporte la generada |
| `app/opengraph-image.tsx` (nuevo) | Imagen OG de respaldo generada con `next/og` — gradiente de marca + nombre, 1200×630, ~68 KB. La heredan las rutas sin imagen propia |
| `app/(site)/eventos/[slug]/page.tsx` (nuevo) | Server Component con `generateMetadata`. La UI se movió con `git mv` a `EventoDetalleView.tsx` (sigue `"use client"`, sin cambios de lógica) |
| `app/(site)/eventos/informacion/[slug]/page.tsx` (nuevo) | Igual, UI en `InfoEventoView.tsx` |
| `app/cosmotech/[eventoId]/page.tsx` | Convertido a Server Component con `generateMetadata` para conferencias |
| `eventos/pages/conferencias/DetalleConferencia.tsx` | Se le añadió `"use client"` — antes lo heredaba del `page.tsx`; al volverlo servidor hubo que marcar el nuevo límite cliente |
| `utils/ogEvento.ts` (nuevo) | El motor. Resuelve el slug (id numérico → `GET /eventos/slug/:slug` → fallback al listado), hace `fetch('/eventos/:id/detalle')` en el servidor (cacheado, `AbortSignal.timeout(4000)`, tags `evento:<slug>` / `eventos:lista`) y arma `og:*` + `twitter:*` + `canonical`. Si el backend no responde → `{}` → caen los tags globales del layout |
| `utils/sanitizeHtml.ts` | Nueva `textoPlano()` **isomorfa** (sin DOM) para derivar la `og:description` del HTML rich-text. `richTextToPlainText()` usa `document` y solo corre en el navegador |
| `app/robots.ts` (nuevo) | `/robots.txt` con `disallow` de `api/`, `auth/`, `perfil/`, checkout; link al sitemap |
| `app/sitemap.ts` (nuevo) | `/sitemap.xml`: rutas estáticas + una URL por función de evento + páginas de información. `revalidate: 3600`. Si el backend cae, sale solo con las estáticas |
| `utils/documentMeta.ts` | Fix: dejó de **vaciar el `content`** de las `<meta>` del servidor cuando no tiene valor en runtime. Antes, si la config de marca del backend no traía `descripcion`, borraba la `<meta name="description">` (y `og:description` / `twitter:description` / `og:image` / `twitter:image`) que puso `layout.tsx`. Ahora solo limpia sus propias etiquetas (`data-meta-dinamico`). Subió `/eventos` de SEO 92 → **100** |
| `.env.local` / `.env.template` | `NEXT_PUBLIC_SITE_URL` añadida |

### Salida verificada (`/eventos/general` vía Facebook Debugger)

```
og:title       = general
og:description = 21 de agosto de 2026, 12:02 PM · Teatro Ricardo Castro · Durango
og:image       = https://taquilla-v2-files.s3.../maravillosa-jugada.webp   (descargable, HTTP 200)
og:type        = article
canonical      = .../eventos/general
```

Único aviso: `fb:app_id` faltante — **opcional**, no afecta la vista previa. Solo hace falta para
Insights de Meta o verificación de dominio.

---

## 2-bis. Metadata 100 % nativa — se retira `documentMeta` / `usePageMeta`

Antes, el `<head>` en tiempo de ejecución lo manipulaba `utils/documentMeta.ts` (vía el
hook `hooks/usePageMeta.ts` y `setMetaDeSitio()` desde `ColorContext`): `document.head`
+ `createElement('meta')` + `setAttribute`, en el navegador, después de hidratar. No es
la forma de Next y no sirve para los scrapers.

Ahora **todo el `<head>` sale de `metadata` / `generateMetadata`**.

| Archivo | Qué |
|---------|-----|
| `lib/config/getSiteConfig.ts` (nuevo) | Fetch de `/configuraciones/detail/1` **en el servidor**. `cache()` de React + `cache: 'force-cache'` + `revalidate: 3600` + tag `config:sitio` (lo invalida el backend, doc 03). Timeout de 15 s (esto corre en `next build` prerenderizando; un abort corto horneaba el fallback de marca) |
| `app/layout.tsx` | `export const metadata` → `generateMetadata()`: el `<title>`, la `description`, `og:*` y el favicon salen de `config.nombreMarca` / `config.imagenTabNavegador` (con fallback a las constantes). `RootLayout` es `async`: mete los 5 colores de marca en `<html style>` → **se va el flash de colores por defecto → marca**, y pasa `configInicial` / `coloresIniciales` a `<Providers>` |
| `app/providers.tsx` | Recibe y reenvía `configInicial` / `coloresIniciales` |
| `context/ColorContext.tsx` | Nace con los props del servidor (no `useState(DEFAULT)` + `useEffect(loadConfig)`). Se quitó `setMetaDeSitio` y el `useEffect` inicial de carga. `reloadConfig()` queda para refresco en runtime. Los pixels de Meta se activan en un `useEffect` de montaje con la config ya servida |
| `app/(site)/eventos/[slug]/EventoDetalleView.tsx` · `informacion/[slug]/InfoEventoView.tsx` | Se quitaron las llamadas `usePageMeta(...)` (redundantes: su `page.tsx` ya tiene `generateMetadata`) |
| `utils/ogEvento.ts` | `og:site_name` de las páginas de evento ahora usa `config.nombreMarca` (antes hardcodeado) |
| **Borrados** | `utils/documentMeta.ts`, `hooks/usePageMeta.ts` |

**Verificado** (`next dev` y `next start` limpio):
```
<html ... style="--color-emphasis:#082348;--color-accent-base:#023E8A;…">   ← colores de marca en el HTML inicial
<title>Taquilla Rube</title>                                                ← nombreMarca del backend
<meta name="description" content="…">                                      ← presente (el backend no trae `descripcion` → usa la constante)
data-meta-dinamico  → 0                                                     ← sin inyección en runtime
```

Las rutas estáticas (`○`) siguen estáticas — el fetch `force-cache` + `revalidate` las
deja como ISR (`Revalidate 1h`), no dinámicas.

> ⚠️ **Build inestable en esta máquina**: el proyecto vive en una carpeta sincronizada
> por **OneDrive**, que compite con las escrituras de `.next/**` durante `next build`
> (errores `ENOENT` en archivos `.tmp`, `os error 1450`, `BUILD_ID` ausente). No es el
> código — `next dev` y un `next start` sobre un build sano funcionan. **Excluir `.next`
> del sync de OneDrive, o mover el proyecto fuera de OneDrive.**

## 3. Doc 07 — Fuentes

**Antes:** 18 variantes de Poppins cargadas desde Google Fonts con un `<link>` render-blocking en
el `<head>`, para usar 5 pesos reales.

| Archivo | Qué |
|---------|-----|
| `app/layout.tsx` | `Poppins` de `next/font/google` a nivel de módulo (`subsets:['latin']`, 7 pesos `300–900`, `display:'swap'`, `variable:'--font-poppins'`). Se eliminó el `<head>` manual con los 3 `<link>` a Google Fonts. `<html className={poppins.variable}>`, `<body className="… font-sans">` |
| `app/globals.css` | Nuevo `@theme { --font-sans: var(--font-poppins), … }` para que `font-sans` de Tailwind v4 sea Poppins. El `body` deja de pedir `"Poppins"` por nombre |
| `styles/legacy.scss` | El `body` deja de pedir `"Poppins", serif` — ese `serif` era un bug: sin Poppins el sitio salía en Times New Roman |

**Resultado verificado:** 0 peticiones a `fonts.googleapis.com` / `fonts.gstatic.com`. 7 `.woff2`
autohospedados en `/_next/static/media/`. De 18 variantes → 7.

**Nota de diseño:** se dejaron 7 pesos (no 5) para no cambiar nada visualmente. Si se recorta a
`300–700`, hay que remapear los 5 usos de `font-extrabold` / `font-black` a `font-bold`.

---

## 4. Doc 08 — Fechas y code-splitting (parcial)

### Fechas ✅

| Archivo | Qué |
|---------|-----|
| `utils/dateHelpers.ts` | Nueva `eventoPasaFiltroFecha()` con `date-fns` (`startOfWeek`/`endOfWeek`/`addWeeks`/`addDays`/`isWithinInterval`/`isAfter`), `weekStartsOn: 0` para igualar el comportamiento de dayjs sin locale |
| `app/(site)/eventos/page.tsx` · `publicUi/pages/HomePage.tsx` (luego borrado) | `moment` estaba importado pero **sin usar** → fuera. `dayjs` + el `filtrarPorFecha` duplicado → una línea que llama al helper compartido |
| `package.json` | `npm uninstall moment dayjs` |

### Diferir librerías pesadas ✅

| Archivo | Qué |
|---------|-----|
| `eventos/pages/compras/TerminarCompraConferenciaGratis.tsx` · `…InvitadoConferenciaGratis.tsx` | `html2canvas` → `await import('html2canvas')` dentro de `downloadQR`. Solo baja al pulsar "Descargar QR" |
| `eventos/pages/legales/{AvisoPrivacidad,NuestrasPoliticas,TerminosCondiciones}.tsx` | `mammoth` (~1 MB) → `await import("mammoth")` dentro de `loadDocx`. Sale del chunk inicial de esas rutas |

### Falta (doc 08)

- Wrapper de `sweetalert2` (34 archivos) — no se hizo por riesgo: `Swal` se usa más allá de `.fire()`.
- `mammoth` **del todo al servidor** (convertir el `.docx` en servidor, servir HTML). Es parte del doc 01.

---

## 5. Doc 03 — Revalidación desde el backend

| Archivo | Qué |
|---------|-----|
| `app/api/revalidate/route.ts` (nuevo) | `POST /api/revalidate`. Secreto en `x-revalidate-secret` comparado con `timingSafeEqual`. Allowlist de tags (`config:sitio`, `ciudades`, `eventos:lista`, `legales` + prefijos `evento:` / `citypass:`). `revalidateTag(tag, { expire: 0 })` |
| `utils/ogEvento.ts` · `app/sitemap.ts` | Se les puso `cache: 'force-cache'` + `next.tags` para que el endpoint tenga algo real que invalidar |
| `.env.local` / `.env.template` | `REVALIDATE_SECRET` (sin prefijo `NEXT_PUBLIC_`) |

**Probado:** tags válidos → `invalidados`; `evento:` sin sufijo / basura → `rechazados`; secreto malo → 401.

**Pendiente:** que el backend llame a este endpoint después de cada mutación del dashboard
(contrato en `docs/checklist-migracion/03-revalidacion-desde-el-backend.md`).

---

## 6. Doc 06 — Imágenes (parcial)

| Archivo | Qué |
|---------|-----|
| `next.config.ts` | `images.remotePatterns` para `taquilla-v2-files.s3.us-east-1.amazonaws.com`. Prerrequisito: sin esto, el primer `<Image>` remoto rompe el build |
| `app/(site)/eventos/[slug]/EventoDetalleView.tsx` | 12 logos locales de tarjetas/bancos + openpay (`<img src="/visa.png" width height>`) → `<Image>`. Dimensiones explícitas, sin `fill` → riesgo cero |

**Estado:** 13 `<Image>` / 112 `<img>` restantes. La migración del resto es trabajo **zona por
zona con verificación visual** (el doc lo exige): `fill` rompe en silencio contenedores sin
`relative`+altura. Orden del doc: LCP `eventos/[slug]` → tarjetas del listado → logo del layout →
`formConferenciaPage` (15) → resto.

---

## 7. Bloqueado — docs 01 / 02 (núcleo de la migración)

Es "la única razón por la que se cambió de Vite a Next" según el README. Depende de:

| Bloqueo | Dueño | Detalle |
|---------|-------|---------|
| `GET /eventos/slug/:slug` responde 404 | Backend | Sin él, resolver un slug obliga a descargar el listado completo. Contrato en doc 04 |
| `NEXT_PUBLIC_API_KEY` / `URL_BACKEND` con prefijo público | Front | Renombrarlas sin prefijo rompe `api/apiApplication.ts` (el cliente las lee). Paso intermedio: duplicar sin prefijo y que solo el código de servidor use las nuevas |
| Nº de réplicas del front | Infra | `revalidateTag` es local a la instancia. Si hay >1 réplica y no hay Redis compartido, la revalidación es best-effort y el TTL manda. Anotar en el ticket |

Mientras: 29 de 34 `page.tsx` siguen abriendo con `"use client"` y montándose en el navegador.
Las 3 rutas migradas solo renderizan el `<head>` en servidor; el `<body>` sigue siendo isla cliente.

---

## 8. Limpieza realizada

| Borrado | Motivo |
|---------|--------|
| `publicUi/pages/{index,HomePage,TestPage,AboutPage}.tsx` | Scaffold de Vite + barrel huérfano. El home es `app/(site)/eventos/page.tsx`; nadie importaba `@/publicUi/pages` |
| `publicUi/components/SliderComponent.tsx` | 0 referencias |
| `public/{next,vercel,vite,file,globe,window}.svg` | Iconos por defecto de Next/Vite, 0 referencias |
| `public/banner-firme.png` (3 MB) | Era el fallback de OG; ahora lo genera `app/opengraph-image.tsx` |
| `GGL_taquilla_next/` (13 MB, 283 archivos) | Repo git embebido de v2. `git rm --cached` + `rm -rf`. Sigue en GitHub (`Yadira-rs/GGL_taquilla_next`), re-clonable si se necesita como referencia |
| `tsconfig.json` → `exclude` | Se quitó `"GGL_taquilla_next"` (ya no existe). `"src"` ya lo habías quitado |

Ya estaban borrados de antes (trabajo previo, no de esta sesión): `src/`,
`utils/nextRouterCompat.tsx`, `publicUi/components/{MenubarView,ProtectedRoute}.tsx`.

### Fix de build no relacionado

`app/(site)/explorar/page.tsx` — envuelto en `<Suspense>`. Un cambio sin commitear en
`ExplorarPage.tsx` (migración de `useSearchParams` del doc 09) rompía `next build` en `/explorar`
con "CSR bailout".

---

## 9. Mediciones (Lighthouse — build de producción, móvil)

| Métrica | `/eventos` (100% cliente) | `/eventos/general` (ruta migrada) | Objetivo |
|---------|--------------------------|-----------------------------------|----------|
| Performance | 36 | 50 | — |
| **SEO** | 92 → **100** *(tras fix de `documentMeta`)* | **100** | — |
| FCP | 2.6 s | **1.1 s** | < 1.8 s |
| LCP | 2.6 s | 3.1 s | < 2.5 s |
| TBT (bloqueo de JS) | 1.450 ms | 860 ms | < 200 ms |
| **CLS** | **0.647** | **0.729** | < 0.1 |

**Lectura:**
- La ruta migrada tiene **SEO 100** (vs 92) y **FCP de 1.1 s en vez de 2.6 s** — el trabajo de
  metadata/servidor ya se nota.
- **CLS 0.65–0.73 es la emergencia** (7× sobre el presupuesto). Causas: los ~112 `<img>` sin
  dimensiones, el flash de colores por defecto → marca (`ColorContext` pide config al navegador),
  los carruseles Swiper.
- **TBT alto** → docs 01 (Server Components) y 08. Bloqueado/parcial.
- Best Practices 57: mayormente ruido de localhost (sin HTTPS, cookies de terceros de los SDK de
  login Google/Apple). Real: "imágenes con aspect-ratio incorrecto" (doc 06) y errores en el panel
  Issues de DevTools (revisar).

**Palanca desbloqueada que mueve CLS + LCP:** doc 06 en las dos rutas de evento (imagen de
promoción como LCP + tarjetas del listado con dimensiones).

---

## 10. Archivos tocados en esta sesión

**Nuevos:**
```
app/opengraph-image.tsx
app/robots.ts
app/sitemap.ts
app/api/revalidate/route.ts
app/(site)/eventos/[slug]/page.tsx
app/(site)/eventos/informacion/[slug]/page.tsx
utils/ogEvento.ts
docs/reportes/2026-08-28-avance-migracion.md   (este archivo)
```

**Renombrados (`git mv`):**
```
app/(site)/eventos/[slug]/page.tsx            → EventoDetalleView.tsx
app/(site)/eventos/informacion/[slug]/page.tsx → InfoEventoView.tsx
```

**Modificados:**
```
app/layout.tsx
app/globals.css
styles/legacy.scss
next.config.ts
tsconfig.json
package.json                (- moment, - dayjs)
utils/dateHelpers.ts
utils/sanitizeHtml.ts
utils/documentMeta.ts       (fix: no vaciar <meta> del servidor)
app/cosmotech/[eventoId]/page.tsx
app/(site)/eventos/page.tsx
app/(site)/explorar/page.tsx
eventos/pages/conferencias/DetalleConferencia.tsx
eventos/pages/compras/TerminarCompraConferenciaGratis.tsx
eventos/pages/compras/TerminarCompraInvitadoConferenciaGratis.tsx
eventos/pages/legales/AvisoPrivacidad.tsx
eventos/pages/legales/NuestrasPoliticas.tsx
eventos/pages/legales/TerminosCondiciones.tsx
app/(site)/eventos/[slug]/EventoDetalleView.tsx   (+ 12 <Image>)
.env.local  .env.template   (+ NEXT_PUBLIC_SITE_URL, + REVALIDATE_SECRET)
```

**Borrados:** ver §8.

> El árbol tenía además trabajo sin commitear de otra persona (retiro de `nextRouterCompat` en
> ~20 archivos de `conferencias/`, `citypass/`, `perfil/`, `explorar/`; setup de vitest). Eso no es
> de esta sesión.

> **Pase de continuación** (reporte `2026-08-28-rendimiento-y-automatizacion.md`): además se
> modificaron `next.config.ts` (AVIF/WebP + `minimumCacheTTL` + `optimizePackageImports` +
> `poweredByHeader` + wrapper de bundle-analyzer), `app/layout.tsx` (`<head>` con `preconnect` a
> S3 + `dns-prefetch` a los SDK de login) y `package.json` (scripts `typecheck` / `analyze` /
> `audit:images` / `verify`); y se añadieron `.github/workflows/{ci,lighthouse}.yml`,
> `.gitlab-ci.yml`, `lighthouserc.json`, `scripts/{audit-images,analyze}.mjs` y `.githooks/pre-push`.

---

## 11. Próximos pasos recomendados

1. **Pedir a backend** `GET /eventos/slug/:slug` y **a infra** el nº de réplicas. Todo lo demás
   depende de esas dos respuestas.
2. ✅ **CI hecho** — `.github/workflows/ci.yml` + `.gitlab-ci.yml` (origin es GitLab):
   `typecheck` + `test` + `build` gatean; `lint` + `audit:images` informativos (lint aún
   arrastra 301 errores legacy). Detalle en el reporte de continuación.
3. **`NEXT_PUBLIC_SITE_URL`** = dominio real en el `.env` de producción (hoy `localhost`).
4. **Doc 06** en las 2 rutas de evento (con navegador abierto, verificar CLS antes/después).
   Ya existe `npm run audit:images` que lista los 49 `<img>` sin dimensiones pendientes.
5. **Doc 08**: wrapper de `sweetalert2`.
6. Cuando llegue el endpoint de slug: **doc 02** (`lib/data/eventos.ts` con `cache()` + tags,
   `getSiteConfig` al servidor) y **doc 01** (partir `citypass` / `abonos`, sembrar estado con props).
7. Proyecto aparte: sesión `localStorage` → cookie `httpOnly` (habilita SSR de perfil/compras).
