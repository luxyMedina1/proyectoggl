# Reporte — Paridad completa con v2: selector de fechas, boletos por precio, pixel en información y docs

**Fecha:** 2026-09-24
**Proyecto:** frontend v3 (Next 16.3.4 App Router)
**Rama:** `migracion-v2-v3`
**Repos:** `git.redgl.com/desarrollo/taquillavipfrontend-v3` (`origin`, GitLab) · `github.com/luxyMedina1/proyectoggl` (`proyectoggl`, GitHub)
**Fuente v2:** `main_v2` de `taquillavipfrontend-v2`, hasta `3cebdc5` (incluido)
**Base:** `ef9656b` (commit de Lucy) + 4 commits de este reporte

**Estado del build:**

- `npm run typecheck` (`next typegen && tsc --noEmit`) → ✅ limpio
- `npx vitest run --pool=threads` → ✅ 174/174 en 26 archivos
- `npx next build` → ✅ sin errores
- Probado en navegador: selector de fechas (Lucy, contra `sky-fest-laguna`). **Sin probar en navegador:** orden de boletos por precio

---

## 1. Resumen ejecutivo

| Tarea | Estado |
|---|---|
| v2 `399c70c` — selector rápido de fechas en multifunción + tarjetas de información | ✅ portado por Lucy (`ef9656b`) |
| v2 `3cebdc5` — ordenar boletos por precio, DAYPASS al final | ✅ portado (`343a4cf`) |
| Unir el trabajo de Lucy con el local sin perder nada | ✅ sin conflictos |
| `/eventos/informacion/[slug]` no sumaba el pixel de Meta del promotor | ✅ arreglado (`af48e09`) |
| `docs/api/` y documentos de funcionalidad de v2 que no existían en v3 | ✅ copiados (`500411f`) |
| Auditoría de paridad v2 → v3 (commits, rutas, helpers, Meta Pixel, docs) | ✅ **no falta nada de `main_v2`** |

---

## 2. Commits nuevos de v2

Solo había dos commits en `main_v2` posteriores a lo ya portado (`a2e80bb`, temas 00–05):

| Commit v2 | Título | En v3 |
|---|---|---|
| `399c70c` (23-sep) | Permitir cambiar rápido entre fechas | `ef9656b` (Lucy) |
| `3cebdc5` (24-sep) | Ordenar por precio boletos | `343a4cf` |

El detalle de cada uno está en [`docs/commits-nuevos/06-selector-rapido-fechas.md`](../commits-nuevos/06-selector-rapido-fechas.md)
(el orden por precio va como anexo al final).

### 2.1 Selector rápido de fechas (`399c70c`)

En un evento multifunción, cambiar de fecha obligaba a volver a `/eventos/informacion/:slug`. Ahora la
página de compra muestra arriba una barra de fechas; cada una navega a la URL de su función.
El bloque "Información importante del evento" pasó a 4 tarjetas con icono (Fecha, Horario, Apertura de
puertas, Límite por persona).

Archivos: `eventos/components/SelectorFechasEvento.tsx`, `eventos/components/iconosEvento.tsx`,
`app/(site)/eventos/[slug]/EventoDetalleView.tsx`. Incluye los dos fixes que trae v2:

- **`slugResuelto`**: la URL no se canonicaliza mientras se resuelve el slug nuevo (si no, regresaba al slug anterior).
- **El detalle se vuelve a pedir con `[id, funcionId]`**: cambiar de función no cambia el `eventoId`.

### 2.2 Boletos ordenados por precio (`3cebdc5`)

En el fetch de secciones de `EventoDetalleView.tsx`, las categorías se ordenan por su **precio más bajo,
de menor a mayor** (antes por nombre) y dentro de cada categoría los precios van ascendentes (antes
descendentes). Las DAYPASS siguen al final. Ningún otro componente dependía del orden anterior.

---

## 3. Unión con el trabajo de Lucy

Lucy subió `ef9656b` a GitLab mientras el mismo port estaba hecho en local sin commit. Se comparó
archivo por archivo:

- Las dos versiones del selector eran **iguales salvo formato** → se quedó la de Lucy (ya probada en navegador).
- A la suya le faltaba `"use client"` en `SelectorFechasEvento.tsx` (usa hooks; truena si se importa
  desde un Server Component) → agregado en `343a4cf`.
- `3cebdc5` solo estaba en local → aplicado encima.

`ef9656b` trae además, de Lucy:

| Cambio | Por qué |
|---|---|
| `sanitizeRichText` usa el saneado por string cuando no hay `window` | DOMPurify tronaba en el render del servidor y mandaba toda la página a client-side rendering |
| `priority` → `preload` en `next/image` | `priority` está deprecado en Next 16 |
| Tamaño explícito en logos de App Store, Google Play y Openpay | Evita el aviso de relación de aspecto de Lighthouse |
| `preload` en la imagen de respaldo del carrusel de `/eventos` | Es el candidato a LCP cuando no hay eventos |
| Clon local de v2 excluido de `tsc`, eslint, vitest y `.gitignore` | Es solo referencia, no parte de la app |

En `proyectoggl/main` (GitHub) hay un commit de CityPass de Lucy y su revert, más un merge: **en neto no
cambian nada**, no hubo que traerlos.

---

## 4. Auditoría de paridad v2 → v3

Se revisó todo `main_v2` contra v3, no solo los commits nuevos:

| Qué | Resultado |
|---|---|
| Commits de `main_v2` de la fecha en que se creó v3 (`a8f26ab` fix abonos, `3804ab1` Meta Ads) | ✅ ya estaban |
| Rutas del router de v2 vs `app/` de v3 | ✅ todas existen. Las 3 `terminar_compra_invitado*` no, pero **también están deshabilitadas en v2** (`usuarioInvitado` nunca se activa): mismo comportamiento |
| Helpers, hooks, store, api, types | ✅ todos. `usePageMeta` / `documentMeta` no existen a propósito: los reemplaza `generateMetadata` |
| Llamadas de Meta Pixel | ❌→✅ faltaba `usePixelsDeEvento` en `InfoEventoView` (ver §5) |
| `docs/` de v2 | ❌→✅ no existían en v3 (ver §6) |

---

## 5. Pixel de Meta en `/eventos/informacion/[slug]` (`af48e09`)

En v2, `infoEventoPage` llama `usePixelsDeEvento(evento.metaPixels)`. Al portarla a `InfoEventoView.tsx`
esa llamada se perdió: en la ficha de información solo se disparaban los pixels de la marca, no el del
promotor. Se agregó la llamada y el campo `metaPixels` a la interfaz `Evento`.

---

## 6. Documentación de v2 (`500411f`)

Copiados tal cual de `main_v2`, en las mismas rutas:

- `docs/api/` — contrato de los endpoints del backend (14 archivos + README).
- `docs/meta-pixel-frontend.md`, `amigos-transferencias.md`, `auth-otp-refresh-qr.md`, `qr-dinamico.md`,
  `slugs-eventos.md`, `metadatos-og-eventos.md`.

`hooks/useMetaPixel.ts`, `utils/metaPixel.ts` y las dos páginas de asientos ya citaban
`docs/meta-pixel-frontend.md`, que no existía. **Ojo:** esos documentos citan rutas de v2 (`src/...`); el
README lo avisa en la sección Documentación.

---

## 7. Pendiente

- **Probar en navegador** el orden de boletos por precio y, sobre todo, los descuentos por asientos
  (PORCENTAJE / CANTIDAD / RESTA) y el cargo por servicio contra `v2.taquillavipmx.com` — pendiente desde el 09-sep.
- **Sincronizar `proyectoggl` (GitHub)**: su `migracion-v2-v3` sigue en `5e22dfa`, sin el commit de Lucy ni estos.
- **Ramas de v2 sin mergear a `main_v2`** (`feat-recaptcha`, `copy_universal_tickets`): no se portaron; decidir si entran.
- **Para no duplicar trabajo**: antes de portar un commit de v2, hacer `git fetch --all` en v3 y revisar
  si alguien ya lo subió.
