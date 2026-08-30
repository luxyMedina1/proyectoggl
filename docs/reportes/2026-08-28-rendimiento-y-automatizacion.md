# Reporte — Rendimiento y automatización

**Fecha:** 2026-08-28
**Proyecto:** `taquillavipfrontend-v3`
**Complementa:** `docs/reportes/2026-08-28-avance-migracion.md` (§11 puntos 2 y 4)
**Estado del build:** `npm run build` ✅ verde · 24 rutas · Next 16.3.2 (Turbopack) · `npm run typecheck` ✅ limpio · `npm test` ✅ 5/5

---

## 1. Resumen ejecutivo

Dos frentes en esta sesión:

1. **Rendimiento** — ajustes de configuración de bajo riesgo y reversibles que
   recortan bytes de imagen, evitan JS muerto de librerías de barril y adelantan
   la conexión al origen del LCP. No tocan lógica de producto.
2. **Automatización** — antes no había **ninguna**. Ahora hay CI en cada push/PR
   (GitHub y GitLab), un auditor de imágenes contra el CLS, Lighthouse
   programado, y el bundle-analyzer cableado.

| Área | Entregable | Estado |
|------|-----------|--------|
| Perf | `next.config.ts`: AVIF/WebP + TTL de imagen + `optimizePackageImports` + `poweredByHeader:false` | ✅ |
| Perf | `app/layout.tsx`: `preconnect` a S3 + `dns-prefetch` a los SDK de login | ✅ |
| Auto | `.github/workflows/ci.yml` + `.gitlab-ci.yml` (typecheck · test · build) | ✅ |
| Auto | `scripts/audit-images.mjs` + `npm run audit:images` (auditor de CLS) | ✅ |
| Auto | `.github/workflows/lighthouse.yml` + `lighthouserc.json` | ✅ |
| Auto | `@next/bundle-analyzer` cableado + `npm run analyze` | ✅ |
| Auto | `.githooks/pre-push` (opt-in) + scripts `typecheck` / `verify` | ✅ |

---

## 2. Rendimiento

### 2.1 `next.config.ts`

| Cambio | Qué hace | Por qué es seguro |
|--------|----------|-------------------|
| `images.formats: ["image/avif", "image/webp"]` | El optimizador sirve AVIF (~30 % más liviano que WebP) a quien lo soporta, con WebP de respaldo. Elige por el header `Accept`. | Solo cambia el formato de salida del optimizador; el `<Image>` y el origen no cambian. Reversible quitando la línea. Coste: el optimizador cachea **cada formato por separado** (más almacenamiento en disco de `.next/cache/images`). |
| `images.minimumCacheTTL: 2678400` (31 días) | Sube el TTL de la imagen optimizada de 4 h → 31 días. Las imágenes de evento (S3) casi no cambian, y cuando cambian se invalidan por el endpoint de revalidación (doc 03). | Solo afecta a la caché del optimizador, no al navegador más allá del `max-age` que ya emite Next. El upstream `Cache-Control` de S3 sigue mandando si es mayor. |
| `experimental.optimizePackageImports: [...]` | Reescribe `import { X } from "pkg"` a imports directos al módulo real → el bundler solo incluye lo usado. Lista: `@reduxjs/toolkit`, `react-redux`, `react-icons`, `react-spinners`, `react-toastify`. (`date-fns` y `react-icons/*` ya vienen optimizados por defecto; se dejan explícitos para dejar registro.) | Es una transformación de *tree-shaking*: en el peor caso es un no-op. El build imprime el aviso `Experiments (use with caution)` — esperado. Reversible. |
| `poweredByHeader: false` | Deja de mandar la cabecera `x-powered-by: Next.js` en cada respuesta. | Menos bytes por respuesta y menos *fingerprinting*. Sin efecto funcional. |
| `@next/bundle-analyzer` como *wrapper* | Transparente salvo con `ANALYZE=true`. Ver §3.4. | El *wrapper* sin la variable devuelve la config intacta. |

### 2.2 `app/layout.tsx` — `<head>` con hints de conexión

```html
<link rel="preconnect" href="https://taquilla-v2-files.s3.us-east-1.amazonaws.com" crossOrigin="" />
<link rel="dns-prefetch" href="https://accounts.google.com" />
<link rel="dns-prefetch" href="https://appleid.cdn-apple.com" />
```

- **`preconnect` a S3:** ese bucket es el origen del **LCP** en las rutas de
  evento (imagen de promoción / portada). Abrir DNS + TLS por adelantado ahorra
  ~1 RTT antes de la primera descarga de imagen.
- **`dns-prefetch` a Google / Apple:** los SDK de login cargan
  `strategy="afterInteractive"`; resolver su DNS antes evita que el primer clic
  en "Iniciar sesión" pague la resolución.
- No es render-blocking (a diferencia del `<head>` con `<link>` a Google Fonts
  que se quitó en la sesión anterior). El `<head>` explícito convive con la
  metadata que Next inyecta.

### 2.3 Lo que **no** se tocó (y por qué)

| Palanca | Motivo de dejarlo pendiente |
|---------|----------------------------|
| Migrar los 49 `<img>` sin dimensiones a `<Image>` | El doc 06 lo exige **zona por zona con navegador abierto** (`fill` rompe en silencio contenedores sin `relative`+altura). Aquí se entrega el **auditor** que lista exactamente cuáles (§3.2), no el cambio. |
| `experimental.cssChunking: 'graph'` (solo Turbopack) | Reordena CSS entre rutas; con `legacy.scss` + Tailwind v4 + módulos hay riesgo de regresión visual que no se puede verificar sin navegador. Candidato claro para la próxima sesión con QA visual. |
| `reactCompiler: true` | Necesita `babel-plugin-react-compiler` y una pasada de verificación por ruta. Alto valor potencial (quita `useMemo`/`useCallback` manuales), pero es su propio proyecto. |
| Diferir los `<Script>` de Google/Apple a `lazyOnload` | Cambia el *timing* del botón de login; requiere probar el flujo real. |
| Server Components (docs 01/02) | Sigue bloqueado por backend/infra (ver reporte anterior §7). Es la palanca que de verdad mueve TBT y First Load JS. |

---

## 3. Automatización

### 3.1 CI — `.github/workflows/ci.yml` y `.gitlab-ci.yml`

Se entregan **los dos** porque `origin` es `git.redgl.com` (GitLab) y hay
espejo en GitHub (`proyectoggl`).

| | Gatea (rojo si falla) | Informativo (no gatea) |
|---|---|---|
| Pasos | `npm run typecheck` · `npm test` · `npm run build` | `npm run lint` · `npm run audit:images` |

- **Por qué `lint` no gatea todavía:** `npm run lint` sale hoy con **301
  errores** heredados del código legacy (`@typescript-eslint/no-explicit-any`,
  `no-img-element`, etc.). Se deja visible en cada corrida pero con
  `continue-on-error` (GitHub) / `allow_failure` (GitLab). **Cuando llegue a 0,
  quitar esa marca** y empieza a gatear.
- **Env del build en CI:** se pasan marcadores
  (`NEXT_PUBLIC_API_KEY=ci-placeholder`, etc.). El build **no contacta al
  backend real**: `lib/config/getSiteConfig.ts` captura el `HTTP 403` y usa el
  fallback de marca. Verificado en local: build verde con placeholders.
- `concurrency` / `interruptible`: un push nuevo cancela la corrida anterior en
  vuelo.

### 3.2 Auditor de imágenes — `scripts/audit-images.mjs`

Apoya la **emergencia de CLS** del reporte anterior (§9: CLS 0.65–0.73, 7× sobre
presupuesto). Recorre `.tsx`/`.jsx` y marca cada `<img>` que no reserva su caja.

- **Heurística:** se considera "dimensionado" si tiene `width`+`height`, o
  `fill`, o clases Tailwind que reservan la caja (`aspect-[…]`, o un par
  `h-<n>`/`w-<n>` fijo). `h-full`/`w-full` **no** cuenta (depende del
  contenedor) — es justo el patrón que causa CLS.
- **Sin dependencias** (`node:fs` / `node:path`). Node 18+.
- **Uso:**
  ```
  npm run audit:images              # informe legible, siempre exit 0
  node scripts/audit-images.mjs --strict   # exit 1 si hay pendientes (para gatear en el futuro)
  node scripts/audit-images.mjs --json     # salida para dashboards
  ```
- **Foto de hoy:** **49 de 112 `<img>` sin dimensiones, en 26 archivos.**
  Los peores nidos: `app/(site)/eventos/[slug]/[seccionId]/[seccion]/page.tsx`,
  `eventos/pages/perfil/components/MisCityPass.tsx`,
  `publicUi/components/citypass/*`.
- **Plan:** conforme el doc 06 cierre archivos, el número baja. Al llegar a 0,
  cambiar el paso de CI a `--strict` para impedir regresiones.

### 3.3 Lighthouse — `.github/workflows/lighthouse.yml` + `lighthouserc.json`

Reemplaza el paso **manual** de la §9 del reporte anterior.

- **Disparo:** `workflow_dispatch` (botón en la pestaña Actions) + `schedule`
  semanal (lunes 06:00 UTC). No corre en cada PR (Lighthouse es lento y ruidoso).
- **No bloquea:** `continue-on-error` en el job + todas las aserciones de
  `lighthouserc.json` en modo `warn`. Solo deja el número registrado y sube el
  reporte HTML a *temporary-public-storage*.
- **Rutas medidas:** `/eventos`, `/eventos/general`, `/explorar` — 3 corridas
  cada una, preset *desktop*.
- **Presupuestos** (= objetivos del reporte anterior): Performance ≥ 0.6,
  FCP ≤ 1800 ms, LCP ≤ 2500 ms, **CLS ≤ 0.1**, TBT ≤ 300 ms, SEO ≥ 0.95.

### 3.4 Bundle analyzer — `npm run analyze`

- `@next/bundle-analyzer` ya estaba en `devDependencies` pero **sin cablear**.
  Ahora `next.config.ts` lo envuelve, activado solo con `ANALYZE=true`.
- `scripts/analyze.mjs` es un *wrapper* sin dependencias (multiplataforma: no
  depende de la sintaxis de env de la shell) que pone la variable y llama a
  `next build`. Abre el treemap `.html` del cliente/servidor/edge al terminar.

### 3.5 Scripts nuevos en `package.json`

| Script | Qué |
|--------|-----|
| `npm run typecheck` | `tsc --noEmit` (lo usa CI y el hook) |
| `npm run analyze` | build + treemap del bundle |
| `npm run audit:images` | auditor de CLS (§3.2) |
| `npm run verify` | `typecheck && test && build` — los mismos gates que CI, para correr antes de pushear |

### 3.6 Hook opt-in — `.githooks/pre-push`

Checks rápidos antes de un push (typecheck + test + auditoría; **no** el build,
que tarda). Activación explícita, una sola vez:

```
git config core.hooksPath .githooks
```

No se fuerza al equipo: sin ese `git config`, el archivo es inerte.

---

## 4. Mediciones tomadas en esta sesión

### 4.1 Build de producción (Next 16.3.2, Turbopack)

- ✅ 24 rutas, `Compiled successfully`, TypeScript limpio.
- Los `HTTP 403` de `[config]` durante *static generation* son **esperados** con
  las claves marcadoras (no hay backend); el fallback de marca entra y el build
  no se rompe. Confirma que CI puede correr sin secretos reales.

### 4.2 First Load JS por ruta (sin comprimir) — `.next/diagnostics/route-bundle-stats.json`

| Ruta | JS (uncompressed) |
|------|-------------------|
| `/eventos/[slug]` | **968 KB** |
| `/eventos` | 909 KB |
| `/explorar` | 906 KB |
| `/perfil/mis_compras` | 896 KB |
| `/citypass/[slug]/paquete/[paqueteSlug]` | 878 KB |
| `/` (home) | 697 KB |
| resto | 700–850 KB |

**Lectura:** el *baseline* sigue siendo pesado (700–970 KB). `optimizePackageImports`
recorta en los márgenes; el salto real necesita Server Components (bloqueado).
Este archivo es ahora el número de referencia para futuras comparaciones — lo
genera cada `npm run build`.

### 4.3 Pendiente de re-medir con navegador

Las métricas de campo (FCP/LCP/CLS/TBT de la §9 anterior) **no** se re-corrieron
en esta sesión (sin navegador en el entorno). El workflow de Lighthouse (§3.3)
las produce en la próxima corrida; ese es el número que hay que comparar contra
la tabla del reporte anterior.

---

## 5. Archivos tocados

**Nuevos:**
```
.github/workflows/ci.yml
.github/workflows/lighthouse.yml
.gitlab-ci.yml
lighthouserc.json
scripts/audit-images.mjs
scripts/analyze.mjs
.githooks/pre-push
docs/reportes/2026-08-28-rendimiento-y-automatizacion.md   (este archivo)
```

**Modificados:**
```
next.config.ts      (formats AVIF/WebP, minimumCacheTTL, optimizePackageImports,
                     poweredByHeader:false, wrapper de bundle-analyzer)
app/layout.tsx      (<head> con preconnect a S3 + dns-prefetch a login SDKs)
package.json        (+ scripts typecheck / analyze / audit:images / verify)
```

> El árbol tiene, además, trabajo sin commitear de otras personas (retiro de
> `nextRouterCompat`, borrado de `src/`, cambios en `conferencias/`, `citypass/`,
> `perfil/`, `ColorContext`, setup de tests). Nada de eso es de esta sesión.

---

## 6. Próximos pasos

1. **Cablear CI:** subir estos archivos y confirmar que la primera corrida pasa
   en GitLab (origin) y GitHub (espejo).
2. **`NEXT_PUBLIC_SITE_URL`** = dominio real en el `.env` de producción (hoy
   `localhost` en `.env.local`).
3. **Doc 06 con QA visual:** ir cerrando los 49 `<img>` que lista
   `npm run audit:images`, empezando por el LCP de `/eventos/[slug]`. Al llegar
   a 0, pasar el paso de CI a `--strict`.
4. **Bajar los 301 errores de lint** hasta poder quitar `continue-on-error` y que
   `lint` gatee.
5. **Correr `npm run analyze`** y revisar el treemap: confirmar qué pesa en los
   ~950 KB de `/eventos/[slug]` (candidatos: `sweetalert2`, `swiper`, `leaflet`,
   `html2canvas`).
6. **Evaluar `cssChunking: 'graph'` y `reactCompiler`** con navegador y QA.
7. Cuando se desbloqueen los docs 01/02 (Server Components), re-medir con el
   workflow de Lighthouse y comparar contra la §9 del reporte anterior.
