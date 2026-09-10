# Reporte — Frente A: rendimiento móvil, CLS, accesibilidad y verificación del bump de Next

**Fecha:** 2026-09-10
**Proyecto:** frontend v3 (Next 16.3.4 App Router)
**Rama:** `migracion-v2-v3`
**Repo:** `github.com/luxyMedina1/proyectoggl` (remoto `proyectoggl`)
**Base del frente A:** `a63d4c3` (`deps: next 16.3.4 + react 19.2.7`)
**Punta tras el merge con B:** `72adf71`
**Reparto:** el trabajo se dividió en dos frentes a partir del feedback de Lucecita.
Este reporte cubre **el frente A**. El [frente B](2026-09-10-frente-b-og-lint.md) (OG de
`/eventos`, barrido de `no-explicit-any`, QA de promociones) tiene su propio reporte.

**Estado del build (verificado en la punta y en cada commit propio):**

- `npm run build` → ✅ 26 páginas prerenderizadas, TypeScript limpio, 39 rutas
- Hook `pre-push` (`tsc --noEmit` + `vitest`) → ✅ **135/135** pruebas en 18 archivos
- `npm audit` → **0 vulnerabilidades**
- Todo commiteado y pusheado a `proyectoggl/migracion-v2-v3`.

> **Nota de entorno:** el equipo de desarrollo tiene poca RAM libre; `tsc --noEmit` y
> `vitest` a secas hacen OOM. La verificación fiable acá es `next build` con
> `NODE_OPTIONS=--max-old-space-size=3072` (hace su propio chequeo de tipos). Ver
> §4.

---

## 1. Resumen ejecutivo

| Tarea | Descripción | Estado |
|---|---|---|
| **A1** Bump de Next + audit | `next`/`eslint-config-next` `16.3.2 → 16.3.4` (RCE crítica GHSA-p293-qw3h-jr36 / GHSA-2xp9-vwfh-vxw4). `react`/`react-dom` `19.2.8 → 19.2.7` (el `.8` no existe en npm). `npm audit` limpio. README actualizado. | ✅ |
| **A2** QA del pipeline de imágenes | `next build` verde: `/opengraph-image` y todas las rutas con `next/image` generan bien tras el bump. El CVE de AVIF no rompió nada. | ✅ |
| **A3** Lighthouse móvil | El CI solo medía `preset: desktop`. Añadido `lighthouserc.mobile.json` + segunda pasada en `lighthouse.yml`. | ✅ |
| **A (perf)** Terceros fuera de la ruta crítica | Meta Pixel (`fbevents.js`, ~139 KB, ~1 s de hilo) diferido a `requestIdleCallback`. SDK de Google/Apple **quitados** del layout raíz (código muerto de v2). | ✅ |
| **A (perf)** CLS del `<footer>` en `/eventos` y `/explorar` | PSI: el footer era el 100 % del CLS (0.83 móvil `/eventos`). Reserva de alto en el `fallback` del `<Suspense>` (lo único que entra en el prerender por el bailout de CSR). | ✅ |
| **A (perf)** Imágenes del detalle de evento | `<img>` crudo a 1920×1080 (~1.8 MB JPEG) → `next/image` en caja `aspect-video`. | ✅ |
| **A (a11y)** `/eventos` PSI 84 | `<select>` de filtro y enlace de ícono sin nombre → `aria-label`; dos `<ul>` "Legal" del footer con `<a>` como hijos directos → `<li>`. | ✅ |
| Migración del resto de `<img>` a `next/image` | Backlog del doc 06. 46/109 `<img>` sin dimensiones en 27 archivos. | ⏳ |
| SSR de la lista de `/eventos` (doc 05) | El fix de raíz del CLS y del LCP. Fuera de alcance de este frente. | ⏳ |

### Mediciones PageSpeed Insights (`/eventos` móvil, Moto G Power, 4G)

| | Antes | Después |
|---|---|---|
| Rendimiento | 33 | ~55–79 *(1 run, varianza)* |
| **CLS** | **0.83** | **~0.004** |
| LCP | 6.4 s | ~5–7 s *(sin cambio real; necesita SSR)* |
| TBT | 630 ms | ~600 ms *(el bundle de `EventosView` sigue pesado)* |
| Accesibilidad | 84 | ~90+ |
| SEO / Recomendaciones | 100 / 100 | 100 / 100 |

La mejora sólida y reproducible es el **CLS** (0.83 → ~0). El LCP y el TBT necesitan el SSR
de la lista y el adelgazamiento del bundle — ver §5.

---

## 2. Qué se hizo, commit por commit

### 2.1 `a63d4c3` — bump de Next (verificación, A1/A2)

El commit lo hizo Yadira; el frente A lo verificó:

- `npm audit` → **0 vulnerabilidades** (se fueron las 8, no solo la crítica).
- `next build` verde con `next@16.3.4`: TypeScript limpio, 26/26 páginas, `/opengraph-image`
  y `next/image` generan sin error.
- README: tabla de cabecera (`Next 16.3.4 · React 19.2.7`), gotcha nuevo "por qué están
  pineados exactos", línea de "Última revisión".

### 2.2 `9c97c3e` — perf + a11y (el grueso del frente A)

9 archivos, +171 / −47.

| Cambio | Archivo | Por qué |
|---|---|---|
| Meta Pixel → `requestIdleCallback` (fallback `setTimeout(2s)` para Safari/iOS) | `context/ColorContext.tsx` | `fbevents.js` se inyectaba en el `useEffect` de montaje: ~139 KB y ~1 s de bloqueo de hilo en la ventana crítica de hidratación. El PageView 1–2 s más tarde no afecta la analítica. |
| SDK Google/Apple `afterInteractive` → `lazyOnload` | `app/layout.tsx` | *(Reemplazado luego por la eliminación completa de Lucy, `3e12dee` — ver §6.)* |
| `<img>` sembrado → `next/image` en `<div aspect-video>` + thumbnail 75×75 → `next/image` | `app/(site)/eventos/[slug]/EventoDetalleView.tsx` | El `<img>` servía el promo original (1920×1080, ~1.8 MB JPEG). `next/image` sirve AVIF al ancho real; la caja reservada quita el salto. Detalle de evento: CLS ~0.63 → ~0.00, oportunidades "next-gen formats" / "encode images" desaparecen. |
| Badges de tienda `100×90` → `120×40` / `120×36` | `app/(site)/layout.tsx` | Los PNG reales son 192×64 (3.00) y 192×58 (3.31); Lighthouse marcaba `image-aspect-ratio` y salían aplastados. |
| `preconnect` a S3 sin `crossOrigin` | `app/layout.tsx` | `next/image` pide sin CORS; con `crossorigin` se abría una 2ª conexión y PSI seguía marcando "preconnect to required origins". |
| `aria-label` en el `<select>` de filtro y en el enlace de ícono (ojo) + `aria-hidden` en el ícono | `app/(site)/eventos/EventosView.tsx` | PSI a11y: "Select element must have an accessible name" / "Links must have discernible text". |
| Dos `<ul>` "Legal" del footer: `<a>` directo → envuelto en `<li>` | `app/(site)/layout.tsx` | HTML inválido; PSI "las listas no contienen solo `<li>`". |
| Reserva `min-h-[200vh] lg:min-h-[130vh]` en `EventosContent` mientras `eventos` vacío | `app/(site)/eventos/EventosView.tsx` | Mitigación interim del CLS del footer. **Apenas movió el número** — el `<div>` está dentro del componente cliente, que no entra en el prerender. Lucy dio con el fix real (§6). |
| `lighthouserc.mobile.json` + paso "móvil" en `lighthouse.yml`; `.lighthouseci/` a `.gitignore` | CI | El pipeline solo medía escritorio, y el reclamo era de móvil. |

### 2.3 `55fa4b0` — merge con el frente B de Lucy

Merge de `proyectoggl/migracion-v2-v3` (11 commits: OG de `/eventos`, tipado de `any`
158→68, fix del guard de `/perfil`). Conflictos resueltos:

- `README.md` — números reconciliados (lint 68, `<img>` 109).
- `EventoDetalleView.tsx` — **auto-merge limpio**: el `next/image` del frente A y el tipado
  de `any` de Lucy están en zonas distintas del archivo.

### 2.4 `15737a6` — merge: quitar SDK muertos (Lucy `3e12dee`)

Ver §6. El frente A se quedó con la versión de Lucy (eliminación completa) y conservó su
fix del `preconnect`. README actualizado a "quitados" en vez de "diferidos".

### 2.5 `629ae61` — la reserva anti-CLS solo mientras carga

`9c97c3e` reservaba alto mientras `eventos` estuviera vacío. Si el fetch de cliente termina
sin eventos (catálogo vacío o backend caído) eso dejaba ~2 pantallas en blanco sobre el
mensaje "sin eventos". Ahora se reserva solo hasta que la primera carga termina (flag
`cargaFinalizada`, puesto en el `finally`): camino feliz igual, camino de error se libera a
`min-h-screen`.

### 2.6 `72adf71` — merge: CLS del footer de Lucy

Ver §6. Auto-merge limpio (su cambio en el `fallback` del `<Suspense>`, el mío en
`EventosContent`).

---

## 3. El proceso de medición (para que nadie lo repita)

1. **Primer intento: Lighthouse local contra `localhost:3000`.** Números catastróficos (LCP
   15–24 s, "2.5 MB de JS sin usar"). Resultó que el `:3000` que respondía era el
   `npm run dev` (Turbopack, sin minificar) de otra terminal, no un `next start`. **El
   `next dev` no sirve para medir rendimiento.**
2. **Segundo intento: `next start` local + Lighthouse.** Números reales pero con varianza
   enorme — el equipo tiene ~3 GB de RAM libre y `next start` + Chrome se ahogan. El CLS de
   `/eventos` móvil salió 0.004, luego 0.835, luego 0.000 en tres corridas seguidas. Los
   audits de estructura (`<title>`, `lang`, meta-description) fallaban **en falso** porque
   Chrome capturaba el DOM a medias.
3. **Lo que funcionó: PageSpeed Insights** contra la build de prod expuesta con un túnel
   de Cloudflare (`cloudflared tunnel --url http://localhost:3000`). PSI corre Lighthouse
   en la infraestructura de Google — cero carga local, cero varianza por swap. Ahí salieron
   los números de §1.
4. **Señal fiable incluso con ruido:** que una *oportunidad* desaparezca del reporte
   ("serve images in next-gen formats") no depende de la varianza — se calcula de los bytes
   y el formato de los recursos pedidos. Por eso el fix de imágenes del detalle se dio por
   bueno aunque el score bailara.

**Recomendación:** medir siempre en CI (`lighthouse.yml`, corre en `ubuntu-latest`) o con
PSI contra un deploy. El equipo local no da números confiables.

---

## 4. Lo que queda (no es de este frente)

| Pendiente | Dónde | Nota |
|---|---|---|
| **SSR de la lista de `/eventos`** | doc `05-rendimiento-lcp-next.md` | El fix de raíz del LCP (hoy el `<img>` del carrusel es el LCP y no pinta hasta hidratar) y del CLS (la reserva de alto es una mitigación, no la cura). Lucy probó sembrar la lista desde el servidor (`e0f9ef4`) y lo **revirtió** (`986c0b9`) — no era trivial. |
| **Adelgazar el bundle de `EventosView`** | — | TBT alto: redux + `swiper` + `sweetalert2` (importado en 33 archivos) + `react-icons`. Es un refactor con su propio PR. |
| **`<img>` → `next/image`** | doc 06 | 46/109 `<img>` sin dimensiones en 27 archivos. Prioridad: LCP `eventos/[slug]` → tarjetas → layout → resto. |
| **Contraste de los botones de categoría** | `app/(site)/eventos/EventosView.tsx` | PSI a11y: `text-neutral` sobre `bg-gray-400` no cumple ratio. Es decisión de paleta de marca. |
| **`useGoogleAuth` y los métodos oauth muertos de `useAuthStore`** | — | Quedaron sin llamadores tras quitar los SDK (`3e12dee`). Limpieza aparte. |

---

## 5. Coordinación con el frente B

El frente A y el B tocaron archivos que se solaparon; se integró todo por merge, sin
`rebase`, resolviendo a mano solo lo mínimo:

| Commit de Lucy | Qué aportó | Cómo se integró |
|---|---|---|
| `1c9b022` … `1d9d56d` (11) | OG de `/eventos`, tipado de `any`, fix `/perfil` | Merge `55fa4b0`. Conflicto solo en `README.md` (números). |
| `3e12dee` | **Quitar** los `<Script>` de Google/Apple del layout raíz — código muerto de v2 (nada consume `window.google`/`AppleID`, el login es solo OTP). Mejor que el `lazyOnload` del frente A. | Merge `15737a6`. Se tomó su versión + se conservó el fix del `preconnect` del frente A. |
| `8f96427` / `4f40a68` | **El fix real del CLS del footer.** Por el bailout de CSR (`useSearchParams`), lo único que entra en el HTML prerenderizado es el `fallback` del `<Suspense>`, y era `<LocalLoader/>` suelto (0 de alto) → footer pegado al header → salto de ~2000 px al hidratar. El `fallback` ahora es un spacer con el mismo `min-h` que dejó el frente A en `EventosContent`. Medido por Lucy: `/eventos` móvil CLS **0.83 → 0.004**, perf 55 → 79. | Merge `72adf71`. Auto-merge limpio (su cambio en `EventosView()`, el del frente A en `EventosContent()`). |

**Sobre `README.md`:** A lo tocó por la versión de Next y la sección de rendimiento; B por la
deuda de lint. Cada merge reconció su parte.

**`origin` (GitLab)** sigue ~25 commits atrás de `proyectoggl` — lo sincroniza el equipo
aparte.
