# Reporte — CityPass a Server Component (landing + paquete), reconciliación de historial y OG de eventos sin canibalizar

**Fecha:** 2026-09-15
**Proyecto:** frontend v3 (Next 16.3.4 App Router)
**Rama:** `migracion-v2-v3`
**Repos:** `git.redgl.com/desarrollo/taquillavipfrontend-v3` (`origin`, GitLab) · `github.com/luxyMedina1/proyectoggl` (`proyectoggl`, GitHub)
**Base:** `adbd576` (punta al cierre de este reporte, solo local)

**Estado del build:**

- `npx tsc --noEmit` → ✅ limpio (corrido después de cada cambio y de cada merge)
- `npx vitest run` → ✅ 169/169 en 25 archivos (suite completa, corrida al cierre)
- `npx next build` → ✅ build de producción sin errores (corrido dos veces, antes y después de mergear)
- Push a `proyectoggl` (GitHub) hasta `ba07d4a` — el hook `pre-push` (tsc + tests + auditoría de imágenes) corrió solo y pasó
- `origin` (GitLab) **no se tocó** — sigue en `e29659b`, tal como se pidió
- El último commit (`adbd576`, diferenciación de OG de eventos) queda **solo en local**, pendiente de decidir a qué repo sube

---

## 1. Resumen ejecutivo

| Tarea | Estado |
|---|---|
| Detalle de paquete de CityPass (`/citypass/[slug]/paquete/[paqueteSlug]`) a Server Component con `generateMetadata` + `Product` JSON-LD | ✅ hecho |
| Landing de CityPass (`/citypass/[slug]`) a Server Component completo, sin fetch duplicado | ✅ integrado (hecho en paralelo en el repo de GitHub, traído por merge) |
| `cache-control` de CityPass: `no-store` → `s-maxage`/`stale-while-revalidate` | ✅ resuelto (parte del mismo trabajo de landing) |
| Historial divergente entre GitLab y GitHub (~30 commits solo en un lado, 7 solo en el otro) | ✅ reconciliado con merge, sin conflictos, verificado antes de cada push |
| `/eventos/[slug]` vs `/eventos/informacion/[slug]`: title/description idénticos para eventos de fecha única | ✅ arreglado, con test nuevo |

---

## 2. CityPass — detalle de paquete a Server Component

### El problema

`app/(site)/citypass/[slug]/paquete/[paqueteSlug]/page.tsx` era `"use client"` puro: sin `generateMetadata`
propio y sin JSON-LD — compartir el link de un paquete específico mostraba el OG genérico del sitio, y el
paquete no tenía ningún dato estructurado `Product` para buscadores.

### El fix

- **`lib/citypass/getCityPass.ts`**: nuevo `getPaqueteCityPassDetalle(paqueteSlug, ciudadSlug)`, mismo
  patrón `cache()` + `force-cache` + `revalidate`/`tags` que ya usaba `getLandingCityPass`. Usa el endpoint
  `GET /citypass/publico/paquete/slug/:slug` (documentado en el checklist SEO, acepta id numérico también) en
  vez del endpoint viejo por id. Reutiliza el tag `citypass:<ciudadSlug>` — no uno nuevo — para quedar en la
  misma cascada de invalidación que la landing. Si el paquete existe pero es de otra ciudad, devuelve `null`
  (evita servir un paquete ajeno bajo esa URL).
- **`page.tsx`**: pasó a Server Component real — `generateMetadata` (título/descripción/canonical/OG/Twitter,
  calcado del patrón de `citypass/[slug]/page.tsx`, con fallback a la imagen de marca heredada del layout) +
  un `Product` JSON-LD reusando `construirProductJsonLd` (ya existía en `utils/jsonLdCityPass.ts`).
- **`publicUi/pages/CityPassPaquetePage.tsx`**: se le agregó `'use client'` explícito. Antes heredaba el
  boundary de cliente del `page.tsx` padre; al convertir ese en Server Component, el `dynamic(..., {ssr:
  false})` de Leaflet que vive en este archivo necesitaba su propio `'use client'` (confirmado contra
  `docs/checklist-migracion/08-code-splitting.md`, que documenta esa regla).

Tests nuevos: `lib/citypass/getCityPass.test.ts` (3 casos del helper) y
`app/(site)/citypass/[slug]/paquete/[paqueteSlug]/page.test.tsx` (3 casos de `generateMetadata`, no existía
antes).

---

## 3. CityPass — landing a Server Component completo

Este trabajo se hizo en paralelo, del otro lado (repo de GitHub), mientras se verificaba lo del §2. Se integró
por merge sin conflictos (commit `27f8ed9`, autoría original de ese repo):

- `app/(site)/citypass/[slug]/page.tsx` ya resolvía la landing en servidor, pero solo para
  `generateMetadata`/JSON-LD — el contenido visible lo repintaba `CityPassPage` (`"use client"`) volviendo a
  pedir los mismos datos. Ahora `CityPassPage` recibe la landing ya resuelta como prop; solo quedan como islas
  de cliente las partes con interacción real (tabs, galería, botón de comprar).
- `generateStaticParams` + `revalidate` en la ruta, para que el `cache-control` real pase de `no-store` a
  `s-maxage`/`stale-while-revalidate` (el punto que había quedado pendiente y ambiguo en el checklist SEO —
  verificado con `next start`: sin las dos cosas juntas el header no cambiaba).
- Tests nuevos para `CityPassPage` y `PaquetesCityPass` (no había ninguno).

---

## 4. Historial divergente entre GitLab y GitHub — reconciliado

Al intentar subir el trabajo del §2 solo al repo de GitHub (`proyectoggl`), el push fue rechazado
(`non-fast-forward`): esa rama tenía ~30 commits propios que no estaban en GitLab (refactor de promociones,
scripts de Postgres local, limpieza de andamiaje viejo), y GitLab tenía 7 commits recientes de CityPass/auth
que no estaban en GitHub.

**Decisión (confirmada antes de actuar, dado el tamaño de la divergencia):** merge local del remoto de GitHub
hacia la rama de trabajo, sin tocar `origin` (GitLab), y solo empujar el resultado ya verificado a GitHub.

- Primer merge (`a0636e7`): sin conflictos — mucho del contenido de ambos lados había convergido de forma
  independiente al mismo estado final.
- El primer intento de push volvió a rechazarse (`fetch first`): el remoto de GitHub recibió el commit del §3
  mientras corrían el build y los tests de verificación. Segundo fetch + segundo merge (`ba07d4a`), también
  sin conflictos.
- Verificado entre cada merge y el push: `tsc --noEmit` limpio, `next build` sin errores, suite completa en
  verde (164/164 en ese punto).
- Push final a `proyectoggl` exitoso: `27f8ed9..ba07d4a`. `origin` (GitLab) no recibió ningún push — sigue
  exactamente donde estaba.

---

## 5. `/eventos/[slug]` vs `/eventos/informacion/[slug]` — title/description sin canibalizar

### El bug

`buildMetadataEvento()` (`utils/ogEvento.ts`) generaba el **mismo** `title` y la **misma** `description` para
ambas rutas cuando el evento tenía una sola fecha. El título solo cambiaba si había una función seleccionada
en la ruta de compra (eventos multifecha); la descripción no dependía de la variante en absoluto, así que
salía idéntica siempre, con o sin función. Riesgo real de canibalización de keyword — exactamente lo que el
checklist SEO pedía evitar.

### El fix

- `/eventos/[slug]` (compra directa) queda **exactamente igual que antes** — es la página primaria/transaccional, no había que arriesgarla.
- `/eventos/informacion/[slug]` (ficha extendida) ahora sale con:
  - **Título:** `{nombre} - Información y fechas`
  - **Descripción:** `Información y fechas de {nombre} en {ciudad}. {reseña real del evento}` — se conserva
    el texto real del evento (vía `textoPlano`), no se inventa contenido nuevo; solo se enmarca con una
    intención distinta a la de la página de compra.

No existía ningún test sobre `buildMetadataEvento`. Se agregó `utils/ogEvento.test.ts` con 5 casos, incluido
uno que verifica directamente que ambas variantes ya no salen idénticas.

---

## 6. Verificación

| Check | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ limpio, corrido después de cada cambio y de cada merge |
| `npx vitest run` (suite completa) | ✅ 169/169 en 25 archivos |
| `npx next build` | ✅ sin errores (corrido antes y después de mergear) |
| Hook `pre-push` (tsc + tests + auditoría de imágenes) | ✅ pasó en el push a GitHub |
| Push a `proyectoggl` (GitHub) | ✅ hasta `ba07d4a` |
| Push a `origin` (GitLab) | ⏸️ no se tocó, a propósito |

## 7. Pendiente / fuera de alcance de hoy

- El commit `adbd576` (OG de eventos, §5) **todavía no se subió a ningún repo** — queda pendiente decidir si
  va a GitHub, GitLab, o ambos.
- No se pudo verificar el "camino feliz" de CityPass en el navegador (paquetes reales, `Product` JSON-LD
  renderizado): el backend real (`v2.taquillavipmx.com`) solo tiene dada de alta una ciudad (Durango) y con
  `tieneCityPass: false` — no hay ningún CityPass activo para probar visualmente en este momento. La lógica
  está cubierta por tests con datos simulados, pero falta la confirmación visual con datos reales.
- Del checklist SEO general, siguen pendientes (sin tocar hoy): paginación indexable en `/eventos`, breadcrumb
  schema, separar `EventoDetalleView.tsx` (~2500 líneas) en Server Component + Client Component chico, el
  redirect `/` → `/eventos` sigue en 307 (no 308), y no existe alias `/sitemap.xml`. Los campos
  `EventoAPI.seo`/`recinto.latitud/longitud` siguen bloqueados en que el backend los mande.
