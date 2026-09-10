# TaquillaVip — Frontend v3

Sitio público de venta de boletos de TaquillaVip: eventos, abonos, CityPass y conferencias, más el
perfil del comprador (compras, boletos con QR, transferencias, amigos).

Es la tercera versión del front, migrada de **React + Vite (SPA)** a **Next.js 16 App Router**. La
migración de plataforma ya está hecha; el aprovechamiento del servidor está a medias y es el trabajo
que sigue (ver [Estado de la migración](#estado-de-la-migración)).

| | |
|---|---|
| **Repo** | `git.redgl.com/desarrollo/taquillavipfrontend-v3` (origin, GitLab) |
| **Stack** | Next 16.3.2 · React 19.2.8 · TypeScript strict · Redux Toolkit · Tailwind 4 + Sass legacy |
| **Backend** | REST externo en `$NEXT_PUBLIC_URL_BACKEND/api/v1`, se autentica con `x-api-key` |
| **Node** | 20 en CI (funciona en 22 local) |

---

## Puesta en marcha

```bash
npm ci                      # usa el package-lock, no `npm install`
cp .env.example .env.local  # y rellena los valores
npm run dev                 # http://localhost:3000  (la raíz redirige a /eventos)
```

`.env.example` es la referencia real de configuración: cada variable trae qué hace, quién la consume
y qué se rompe si falta. Léelo antes de pedirle las claves a alguien.

### Variables de entorno

| Variable | Obligatoria | Para qué |
|---|---|---|
| `NEXT_PUBLIC_URL_BACKEND` | Sí | URL base del backend, **sin** `/api/v1` (el código lo añade) |
| `NEXT_PUBLIC_API_KEY` | Sí | Header `x-api-key` del backend |
| `NEXT_PUBLIC_SITE_URL` | Sí | Dominio público. Es el `metadataBase`: sin él, las vistas previas de WhatsApp y Facebook se caen |
| `REVALIDATE_SECRET` | Sí | Secreto compartido para `POST /api/revalidate`. **Distinto por entorno** |
| `NEXT_PUBLIC_TITLE_APP` | No | Nombre de marca de respaldo cuando el backend no responde |
| `NEXT_PUBLIC_TIMEZONE` | No | Zona para formatear fechas de evento (default `America/Mexico_City`) |

Regla que cuesta caro olvidar: **`NEXT_PUBLIC_` significa literalmente "publica esto"**. Next inlinea
esas variables en el JavaScript que descarga cualquier visitante, así que se leen con Ctrl+U. Todo lo
que sea secreto va sin prefijo.

---

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` | Build de producción — 39 rutas |
| `npm start` | Sirve el build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest, una pasada |
| `npm run test:watch` | Vitest en watch |
| `npm run verify` | `typecheck` + `test` + `build`. Lo que corre CI, en local |
| `npm run lint` | ESLint. **Hoy sale rojo a propósito** — ver [Gotchas](#gotchas) |
| `npm run analyze` | Treemap del bundle (equivale a `ANALYZE=true npm run build`) |
| `npm run audit:images` | Auditor de `<img>` sin dimensiones, contra el CLS |

### Hook de pre-push (opcional)

```bash
git config core.hooksPath .githooks
```

Corre `typecheck` + `test` antes de cada push. No corre el build, que tarda minutos — ese lo valida CI.

---

## Estructura

El repo tiene **dos capas que conviven**: las rutas de Next en `app/`, y las carpetas de features en
la raíz que sobrevivieron a la SPA de Vite. No es un accidente pendiente de arreglar: la migración se
hizo ruta por ruta para no romper nada, y las vistas se quedaron donde estaban.

```
app/                    Rutas (App Router)
  (site)/               Sitio público con header/footer: eventos, abonos, citypass, perfil, legales
  auth/                 Login, recuperación de contraseña, completar perfil
  cosmotech/            Conferencias (marca aparte: speakers, programa, hoteles, recinto, boletos)
  api/revalidate/       Endpoint que el backend llama para invalidar caché
  layout.tsx            Metadata global + fuente + providers + preconnect a S3
  opengraph-image.tsx   Imagen OG de respaldo generada con next/og
  robots.ts sitemap.ts

eventos/  explorar/  publicUi/  auth/    Vistas y componentes heredados de la SPA
components/  hooks/  context/  store/   Compartido: Redux Toolkit, contextos de marca y de auth modal
api/apiApplication.ts                   Cliente axios único: refresh de token + atribución Meta Pixel
lib/config/getSiteConfig.ts             Config de marca del backend, del lado servidor
utils/                                  Fechas, slugs, QR dinámico, sanitizado de HTML, OG de evento
docs/                                   Guía de migración y reportes de avance
scripts/                                analyze.mjs, audit-images.mjs
```

Alias de imports: `@/*` apunta a la raíz del repo.

### Piezas que conviene conocer antes de tocar nada

| Archivo | Por qué importa |
|---|---|
| `api/apiApplication.ts` | **Todas** las peticiones del navegador pasan por aquí. Trae el interceptor de refresh de token y la inyección de atribución de Meta Pixel en las rutas de pago |
| `app/layout.tsx` | Metadata global, Poppins vía `next/font`, `preconnect` al bucket de S3 (origen del LCP) |
| `lib/config/getSiteConfig.ts` | Trae nombre, colores, logo y pixels del backend (`/configuraciones/detail/1`). Si falla hay fallback: el sitio no se cae |
| `app/api/revalidate/route.ts` | `POST` con header `x-revalidate-secret`, comparación en tiempo constante y **allowlist** de tags (`config:sitio`, `eventos:lista`, `evento:*`, `citypass:*`…) |
| `utils/ogEvento.ts` | Resuelve slug → evento y arma los `og:*` de las páginas de evento. Si el backend no responde, caen los tags globales del layout |
| `utils/eventoSlug.ts` | Los slugs de eventos multifecha llevan sufijo de día (`sky-fest-laguna-7-matutino`). Cambiar `NEXT_PUBLIC_TIMEZONE` cambia URLs y QR ya impresos |
| `components/AppGate.tsx` | Puerta de sesión: fuerza `/auth/completar_perfil` y dispara el `PageView` del pixel en cada cambio de ruta |

### Cómo fluyen los datos

```
Servidor    layout.tsx ─────────> getSiteConfig() ──> backend   (marca, colores, pixels)
            page.tsx de evento ─> ogEvento.ts ─────> backend   (metadata OG, cacheada por tag)

Navegador   componentes ─> hooks/use*Store ─> api/apiApplication.ts ─> backend
                                  └────────> Redux Toolkit (auth, app)

Backend ──> POST /api/revalidate  (x-revalidate-secret) ──> revalidateTag()
```

La sesión vive en `localStorage` (`utils/authStorage.ts`), no en cookie. Por eso el perfil y "mis
compras" todavía no se pueden renderizar en el servidor.

---

## Calidad y CI

Hay dos configuraciones equivalentes: `.github/workflows/ci.yml` y `.gitlab-ci.yml`. `origin` es
GitLab; la de GitHub existe por el espejo del repo. **Si cambias una, cambia la otra.**

| Job | ¿Gatea? |
|---|---|
| `typecheck` · `test` · `build` | Sí |
| `lint` | No (`continue-on-error`) |
| `audit:images` | No |

Además, `lighthouse.yml` corre los lunes 06:00 UTC —y a mano desde Actions— sobre un build real de
`/eventos`, `/eventos/general` y `/explorar`. Los presupuestos de `lighthouserc.json` están todos en
modo `warn`: registran el número, nunca rompen CI.

Pruebas: Vitest + jsdom + Testing Library. Hoy son **135 pruebas en 18 archivos**, la mayoría de
propiedad (`fast-check`) sobre los helpers puros de `utils/` (promociones, slugs, JSON-LD, fechas).
Cualquier `*.test.ts(x)` o `*.spec.ts(x)` en cualquier carpeta se recoge solo.

---

## Estado de la migración

La plataforma ya migró: Vite → App Router, react-router retirado, Open Graph validado contra el
Sharing Debugger de Facebook. Lo que falta es dejar de renderizar todo en el navegador.

| | Hoy |
|---|---|
| Páginas que abren con `'use client'` | 23 de 34 (2 de las otras son `redirect()` de una línea) |
| Rutas con `generateMetadata` | 4 de contenido, más el layout raíz |
| `<img>` nativos vs. `next/image` | 111 contra 2 archivos migrados (`/eventos` y el detalle de evento) |
| Perfil y "mis compras" en el servidor | Bloqueado por la sesión en `localStorage` |

De las 23 páginas cliente, **20 lo son con razón**: perfil, auth y checkout son privadas y están
excluidas en `robots.ts`, y la selección de asiento necesita disponibilidad en tiempo real, que no se
debe cachear nunca. Las 3 que faltan por migrar son públicas y compartibles: las dos de CityPass y
`/explorar`. El listado `/eventos` ya es cáscara de servidor (`generateMetadata` con OG de marca
—título e imagen— + `ItemList` JSON-LD), pero todavía trae la lista en el cliente: el SSR de los datos
para el LCP sigue pendiente (ver
[`docs/commits-nuevos/05-rendimiento-lcp-next.md`](docs/commits-nuevos/05-rendimiento-lcp-next.md)).
**"Todo SSR" no es la meta** — la meta es cáscara de servidor con islas de cliente.

El plan está escrito y numerado en [`docs/checklist-migracion/`](docs/checklist-migracion/README.md):
los docs 01 → 05 se leen en orden, del 06 al 10 son optimizaciones independientes. Si sólo vas a leer
una cosa, que sea el doc 01, y dentro de él esta idea:

> `'use client'` no significa "este componente es interactivo". Marca **el punto donde empieza el
> bundle del navegador**: todo lo que ese archivo importe, y todo lo que esos importen, se manda al
> navegador.

---

## Gotchas

**Este Next no es el que conoces.** Es la 16.3.2 y trae cambios de ruptura. Mucho de lo que salga en
Google, en blogs o de una IA va a estar desactualizado: el caché de `fetch` ahora es *opt-in*,
`revalidateTag(tag)` con un solo argumento está deprecado, y el prop `priority` de `next/image`
también. La fuente buena es `node_modules/next/dist/docs/`, que es la doc de la versión instalada.

**`npm run lint` sale rojo y es esperado.** 236 errores + 157 warnings heredados del código legacy. Se
muestra sin bloquear; cuando llegue a 0, hay que quitar el `continue-on-error` de los dos CI para que
empiece a gatear. No lo "arregles" con un `--fix` masivo dentro de un PR de otra cosa.

**La API key viaja al navegador.** `NEXT_PUBLIC_API_KEY` se lee con Ctrl+U. Es un hallazgo abierto de
la auditoría, no un descuido: `api/apiApplication.ts` corre en el cliente y no tiene alternativa
hasta que la sesión pase a una cookie `httpOnly`. Los cuatro consumidores de servidor
(`getSiteConfig`, `ogEvento`, `sitemap`, `cosmotech`) deberían migrar a una `API_KEY` sin prefijo; las
variables ya están comentadas en `.env.example`, listas para descomentar.

**`REVALIDATE_SECRET` distinto por entorno.** Si staging y producción comparten el valor, un aviso de
staging invalida el caché de producción. Y si falta, el endpoint responde 401 a todo sin explicar por
qué: es el fallo más común al montarlo.

**Imágenes remotas sólo desde el bucket declarado.** `next.config.ts` sólo permite optimizar
`taquilla-v2-files.s3.us-east-1.amazonaws.com`. Un `<Image>` con `src` de otro host **falla el build**,
no falla en runtime.

**El deploy no está documentado.** No hay Dockerfile, ni pipeline de despliegue, ni tabla de entornos
en el repo. Si te toca averiguarlo, escríbelo aquí.

---

## Documentación

| Dónde | Qué |
|---|---|
| [`docs/checklist-migracion/`](docs/checklist-migracion/README.md) | Guía de migración, docs 01–10. Escrita asumiendo que es tu primera vez con Next |
| [`docs/checklist-migracion/glosario.md`](docs/checklist-migracion/glosario.md) | LCP, CLS, hidratación, RSC, tree-shaking… |
| [`docs/checklist-migracion/05-checklist-de-pr.md`](docs/checklist-migracion/05-checklist-de-pr.md) | Qué revisar antes de pedir review. Cabe en una pantalla |
| [`docs/checklist-migracion/10-mejoras-extra.md`](docs/checklist-migracion/10-mejoras-extra.md) | 23 mejoras que no bloquean nada: JSON-LD de eventos, soft 404s, cabeceras de seguridad, React Compiler, accesibilidad |
| [`docs/reportes/`](docs/reportes/) | Reportes de avance, con el detalle de cada cambio y por qué se hizo |
| `.env.example` | Referencia de configuración, variable por variable |
| `AGENTS.md` / `CLAUDE.md` | Instrucciones para los agentes de IA que trabajen en el repo |

---

**Última revisión:** 2026-09-10, contra Next 16.3.2 y React 19.2.8.

Los números de este archivo (34 páginas, 23 cliente, 111 `<img>`, 236 errores de lint, 135 pruebas,
39 rutas) salen de contar el repo, no de estimar. Si no cuadran, el repo cambió: vuelve a contar y
actualiza.
