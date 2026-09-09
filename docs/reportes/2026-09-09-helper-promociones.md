# Reporte — Helper de promociones (tema 01 de `docs/commits-nuevos/`)

**Fecha:** 2026-09-09
**Proyecto:** `garza` (frontend v3, Next App Router)
**Referencia:** [`docs/commits-nuevos/01-helper-promociones.md`](../commits-nuevos/01-helper-promociones.md)
**Origen del código:** repo GitLab `taquillavipfrontend-v2`, rama `main_v2` (rango `fecdc62..a2e80bb`)
**Estado del build:** `npm run build` ✅ verde · `npx tsc --noEmit` ✅ limpio · `npx vitest run` ✅ 80/80

---

## 1. Resumen ejecutivo

Se portó el **helper puro de promociones** de v2 a v3 y se refactorizaron las **dos páginas
variante "por boletos"** para que lo consuman en lugar de tener la lógica duplicada.

El archivo `src/utils/promociones.ts` de v2 **no estaba en disco**. Se clonó el repo v2 por
HTTPS (SSH falla por `publickey`; HTTPS funciona con credenciales cacheadas de Windows) y se
encontró el helper en la rama `main_v2` — no en `main`. Se copió **verbatim**, sin reescribir
lógica.

| Cambio | Estado |
|--------|--------|
| `utils/promociones.ts` (helper puro) | ✅ Copiado verbatim de `main_v2:src/utils/promociones.ts` |
| `utils/promociones.test.ts` (75 tests property-based) | ✅ Copiado verbatim |
| `fast-check@4.9.0` como devDependency | ✅ Añadido (lo requieren los tests) |
| `eventos/pages/formConferenciaPage.tsx` (conferencias, *por boletos*) | ✅ Refactorizado |
| `app/(site)/eventos/[slug]/EventoDetalleView.tsx` (generales/detalle, *por boletos*) | ✅ Refactorizado |
| Páginas *por asientos* (numerados + abonos) | ⏳ Pendiente |
| Temas 00, 02, 03, 04, 05 de `commits-nuevos/` | ⏳ Sin empezar |

**Nada commiteado todavía.**

---

## 2. Qué se hizo

### 2.1 Helper y tests

- **`utils/promociones.ts`**: TypeScript puro, sin React, sin llamadas HTTP, sin `toast`/`Swal`.
  Funciona igual en Server Components y Client Components. Expone:
  - Tipos: `TipoPromocion` (`PORCENTAJE` | `CANTIDAD` | `RESTA`), `Promocion`, `PromoCategoria`,
    `Asiento`, `MejorPromoPorBoletos`, `MejorPromoPorAsientos`, `CategoriaAccessor`.
  - Accesores de categoría: `CATEGORIA_GENERAL_ACCESSOR` (generales/conferencias),
    `CATEGORIA_NUMERADA_ACCESSOR` (numerados), `categoriasValidasDePromo`.
  - Cálculo **por boletos**: `calcularDescuentoPorcentajePorBoletos`,
    `calcularDescuentoCantidadPorBoletos`, `calcularDescuentoRestaPorBoletos`.
  - Cálculo **por asientos**: `asientosPorCategoriaPrecio`,
    `calcularDescuentoPorcentajePorCategoria`, `calcularDescuentoCantidadPorAsientos`,
    `calcularDescuentoRestaPorAsientos`, `calcularDescuentoPorCategoriaDeAsientos`
    (descuento desglosado por categoría, necesario para recalcular el UDS),
    `calcularTotalNuevo`.
  - Filtrado: `filtrarPromocionesAplicablesPorCategoria` (string, generales/conferencias),
    `filtrarPromocionesAplicablesPorCategorias` (array, numerados).
  - Selección de mejor promo: `obtenerMejorPromocionPorBoletos` (incluye `precioFinal`),
    `obtenerMejorPromocionPorAsientos` (sin `precioFinal`).
  - Normalización: `normalizarPromocionesAplicaDirecto(promociones, conPorcentajeOriginal?)`
    — copia (no muta), convierte `cantidadResta` string→number, y si `conPorcentajeOriginal`
    añade `porcentaje_original` (flujos pareja/familia).
- **`utils/promociones.test.ts`**: 75 tests property-based con `fast-check`. Corren dentro de
  la config de Vitest ya existente (`include: ['**/*.{test,spec}.{ts,tsx}']`), sin cambios de
  configuración.
- **`fast-check@4.9.0`**: nuevo `devDependency` (v2 usa `^4.9.0`).

### 2.2 Refactor de las páginas "por boletos"

En `formConferenciaPage.tsx` y `EventoDetalleView.tsx` (cambios idénticos en ambas):

1. Nuevo import desde `@/utils/promociones`:
   `filtrarPromocionesAplicablesPorCategoria`, `obtenerMejorPromocionPorBoletos`,
   `normalizarPromocionesAplicaDirecto`, `type Promocion`.
2. Se eliminó el `interface promocion` local → `type promocion = Promocion`.
3. Se eliminaron las funciones locales `filtrarPromocionesAplicables` y `obtenerMejorPromocion`
   (eran copias del helper, solo con `PORCENTAJE`/`CANTIDAD`, sin `RESTA`).
4. Llamadas actualizadas:
   - `filtrarPromocionesAplicables(...)` → `filtrarPromocionesAplicablesPorCategoria(...)`
   - `obtenerMejorPromocion(...)` → `obtenerMejorPromocionPorBoletos(...)`
   - `setDiscountPorcent(mejorPromocion.porcentaje)` →
     `setDiscountPorcent(Number(mejorPromocion.porcentaje))` (el helper tipa `porcentaje`
     como `number | string`).
5. Al recibir la respuesta de `/promociones/validar_promo_web`:
   `setPromocionesAplicanDirecto(normalizarPromocionesAplicaDirecto(res.data.promocionesAplicaDirecto))`.

**Beneficio colateral:** ambas páginas ahora soportan promociones tipo `RESTA` (antes las
ignoraban).

---

## 3. Verificación

- `npx tsc --noEmit` → limpio.
- `npx vitest run` → 80/80 tests (75 nuevos del helper + 5 previos).
- `npm run build` → verde, 24 rutas.
- `git diff --stat`: `EventoDetalleView.tsx` −124/+64 aprox., `formConferenciaPage.tsx` similar,
  `package.json` +1, `package-lock.json` +41. Archivos nuevos: `utils/promociones.ts`,
  `utils/promociones.test.ts` (sin trackear aún).

No se pudo probar en navegador: los datos de promociones se piden client-side y el backend LAN
(`192.168.1.188:3000`) va y viene. La red de seguridad son los 75 tests + el hecho de que el
helper es copia byte a byte de v2.

---

## 4. Pendiente

### 4.1 Tema 01 — páginas "por asientos" (numerados + abonos)

- [app/(site)/eventos/[slug]/[seccionId]/[seccion]/page.tsx](../../app/(site)/eventos/[slug]/[seccionId]/[seccion]/page.tsx)
- [app/(site)/abonos/[slug]/[seccionId]/[seccion]/page.tsx](../../app/(site)/abonos/[slug]/[seccionId]/[seccion]/page.tsx)

Más delicadas que las de boletos:

1. La lógica de promos está duplicada en ~3 bloques por archivo (~300 líneas): la función
   `validarDescuento`, dos bloques inline de agrupación de asientos, y las funciones locales
   `filtrarPromocionesAplicables` / `obtenerMejorPromocion` (que devuelven un `MejorPromo` local).
2. **Recálculo del UDS (cargo por servicio)**: cuando hay promo automática, el UDS se recalcula
   **sobre los subtotales YA descontados por categoría**, no sobre el subtotal completo. Para eso
   está `calcularDescuentoPorCategoriaDeAsientos` en el helper. Si al migrar se recalcula sobre
   el subtotal sin descontar, **el cliente paga de más en el cargo por servicio**.
3. Al normalizar la respuesta usar `normalizarPromocionesAplicaDirecto(data, true)` (numerados y
   abonos necesitan `porcentaje_original` para los flujos pareja/familia).
4. Requiere **prueba en navegador** con datos reales de asientos — no verificable por `curl`.

### 4.2 Otros temas de `docs/commits-nuevos/` (sin empezar)

| Doc | Tema |
|-----|------|
| 00 | Leyenda de mapa configurable + página de información multifecha (redirección server-side) |
| 02 | Mostrar promoción aplicada y precio original tachado en perfil/pedidos |
| 03 | Saltar el paso de selección de abonos cuando no hay abonos |
| 04 | Abrir Google Maps por lat/lon del recinto |
| 05 | Plan de trabajo para el LCP en v3 |

---

## 5. Nota sobre el repositorio v2

Para obtener el helper se necesitó clonar `taquillavipfrontend-v2`. Datos útiles:

- HTTPS funciona: `git clone https://git.redgl.com/desarrollo/taquillavipfrontend-v2.git`
  (SSH falla por `publickey` en este entorno).
- El helper y sus tests están en la rama **`main_v2`** (`src/utils/promociones.ts`,
  `src/utils/promociones.test.ts`), que es donde vive el rango `fecdc62..a2e80bb` descrito en
  `docs/commits-nuevos/`. La rama `main` es más vieja y no los tiene.
