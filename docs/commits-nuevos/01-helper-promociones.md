# 1. Helper de promociones — fuente única de verdad

Commit: `3355c5c` — *Separar a un helper promociones*
Archivo nuevo: `src/utils/promociones.ts` (+ `src/utils/promociones.test.ts`)

## Por qué se hizo

Antes de este cambio, **la misma lógica de promociones estaba copiada y pegada** en tres páginas:

- `src/eventos/pages/SeccionAsientoPage.tsx` (numerados — cálculo por **asientos**)
- `src/eventos/pages/detalleEventoPage.tsx` (generales — cálculo por **boletos**)
- `src/eventos/pages/formConferenciaPage.tsx` (conferencias — cálculo por **boletos**)

Cada copia tenía funciones locales `filtrarPromocionesAplicables` y `obtenerMejorPromocion`, más los `reduce` de agrupación de asientos por categoría/precio. Esto causaba:

- **Inconsistencias**: un fix en una página no llegaba a las otras.
- **Riesgo al agregar tipos de promoción**: había que tocar tres archivos.
- **Difícil de testear**: la lógica vivía dentro de componentes con estado, API y toasts.

La solución fue **extraer toda la lógica pura a `src/utils/promociones.ts`**: sin React, sin llamadas HTTP, sin `toast`/`Swal`, sin leer estado de componentes. Solo entra data, sale un número o un objeto. Eso la vuelve reutilizable y testeable (el archivo `promociones.test.ts` cubre los casos).

## Nuevo tipo de promoción: `RESTA`

Además del refactor, se **agregó un tercer tipo de promoción `RESTA`** (antes solo existían `PORCENTAJE` y `CANTIDAD`).

- `RESTA` descuenta un **monto fijo por boleto/asiento que califica** (`cantidadResta`).
- Tiene **piso por asiento**: el descuento nunca supera el precio del propio asiento → `min(cantidadResta, precioAsiento)`.
- La API puede devolver `cantidadResta` como `string` (columna numeric) y llega `null` para los otros tipos. Por eso hay una normalización (ver `normalizarPromocionesAplicaDirecto`).

```ts
export type TipoPromocion = 'PORCENTAJE' | 'CANTIDAD' | 'RESTA';
```

## API pública del helper

Todo lo exportado por `src/utils/promociones.ts`:

### Tipos
- `TipoPromocion`, `PromoCategoria`, `Promocion`, `MejorPromoPorBoletos`, `MejorPromoPorAsientos`, `Asiento`, `CategoriaAccessor`

### Accesores de categoría (dos variantes de la data real)
- `CATEGORIA_GENERAL_ACCESSOR` → `c.categoriaGeneral?.nombre` (generales/conferencias)
- `CATEGORIA_NUMERADA_ACCESSOR` → `c.categoria?.nombre` (numerados)
- `categoriasValidasDePromo(promo, accessor)` — deriva nombres válidos descartando `null/undefined`

### Cálculo de descuento — variante **por boletos** (generales/conferencias)
- `calcularDescuentoPorcentajePorBoletos(precioBoleto, cantidadBoletos, porcentaje)`
- `calcularDescuentoCantidadPorBoletos(precioBoleto, cantidadBoletos, cantidadCompra, cantidadPaga)`
- `calcularDescuentoRestaPorBoletos(precioBoleto, cantidadBoletos, cantidadResta)`

### Cálculo de descuento — variante **por asientos** (numerados)
- `asientosPorCategoriaPrecio(asientos)` — agrupa por categoría y luego por precio
- `calcularDescuentoPorcentajePorCategoria(subtotalesPorCategoria, porcentaje, aplicaTodoEvento, categoriasAplicables)`
- `calcularDescuentoCantidadPorAsientos(...)` → `{ descuentoTotal, algunaCategoriaCumple }`
- `calcularDescuentoRestaPorAsientos(...)` → `{ descuentoTotal, algunaCategoriaCumple }`
- `calcularDescuentoPorCategoriaDeAsientos(promo, asientos, subtotalesPorCategoria, categoriasAplicables)` → descuento **desglosado por categoría** (necesario para recalcular el cargo por servicio UDS sobre subtotales ya descontados)
- `calcularTotalNuevo(total, descuento)` → `Math.max(0, total - descuento)`

### Filtrado de promociones aplicables
- `filtrarPromocionesAplicablesPorCategoria(promociones, categoria: string)` — variante generales/conferencias (una categoría)
- `filtrarPromocionesAplicablesPorCategorias(promociones, categorias: string[])` — variante numerados (varias categorías)

### Selección de la mejor promoción (mayor descuento, comparación estricta `>`)
- `obtenerMejorPromocionPorBoletos(promocionesAplicables, cantidadBoletos, precioBoleto)` → incluye `precioFinal`
- `obtenerMejorPromocionPorAsientos(promocionesAplicables, asientosSeleccionados, subtotalesPorCategoria)` → **sin** `precioFinal`

### Normalización de auto-aplicación
- `normalizarPromocionesAplicaDirecto(promociones, conPorcentajeOriginal = false)`
  - Copia (no muta el arreglo original).
  - Convierte `cantidadResta` a `number` cuando viene como string.
  - Si `conPorcentajeOriginal`, añade `porcentaje_original = porcentaje` (para flujos pareja/familia: numerados y abonos).

## Detalle importante: recálculo del UDS (cargo por servicio)

En numerados (`SeccionAsientoPage`), cuando se aplica una promo automática se **recalcula el cargo por servicio (UDS) sobre los subtotales YA descontados por categoría**, no sobre el subtotal completo. Para eso se usa `calcularDescuentoPorCategoriaDeAsientos`, que devuelve el descuento por categoría, y luego:

```
subtotalDescontadoCat = max(0, subtotalCat - descuentoCat)
udsTotal += subtotalDescontadoCat * cargoPorCategoria
```

Cuando no hay promo, el UDS se restaura con los subtotales completos. **Esto es fácil de perder al migrar**: si en v3 se recalcula el UDS sobre el subtotal sin descontar, el cliente paga de más en el cargo por servicio.

## Otros ajustes de comportamiento incluidos en este commit

1. **Reset silencioso al deseleccionar todo** (numerados): si `asientosSeleccionados.length === 0`, se hace `setDiscountAmount(0)` y `setSubotal(0)` y se retorna, para evitar el falso positivo del toast al quitar todos los asientos.
2. **Dependencias del `useEffect`** en numerados ampliadas a `[subtotalesPorCategoria, asientosSeleccionados, totalBoletos]`.
3. Se cambió `mejorPromocion.porcentaje` a `Number(mejorPromocion.porcentaje)` porque el helper tipa `porcentaje` como `number | string`.

## Cómo migrar a v3 (Next.js)

1. **Copia `src/utils/promociones.ts` tal cual** al proyecto v3 (p. ej. `lib/promociones.ts` o `utils/promociones.ts`). Es TypeScript puro, no depende de React ni del navegador, así que funciona **tanto en Server Components como en Client Components**.
2. **Copia también `promociones.test.ts`** y adáptalo al runner de v3 (Vitest/Jest). No reescribas la lógica: los tests son tu red de seguridad.
3. **No reintroduzcas** funciones `filtrarPromocionesAplicables` / `obtenerMejorPromocion` locales en las páginas. Importa siempre del helper.
4. Elige la variante correcta según el flujo:
   - **Numerados** → funciones `*PorAsientos` / `*PorCategoria` + `filtrarPromocionesAplicablesPorCategorias` (array) + `CATEGORIA_NUMERADA_ACCESSOR`.
   - **Generales / Conferencias** → funciones `*PorBoletos` + `filtrarPromocionesAplicablesPorCategoria` (string) + `CATEGORIA_GENERAL_ACCESSOR`.
5. Al normalizar la respuesta de los endpoints `validar_promo_web/pv/app`, usa `normalizarPromocionesAplicaDirecto(data, true)` en flujos numerados/abonos (que necesitan `porcentaje_original`) y `false` donde no aplique.
6. **Server side**: el cálculo del mejor descuento y el precio final se puede resolver en el servidor (Route Handler / Server Action) para no enviar toda la lista de promociones al cliente y reducir JS. El helper no cambia; solo cambia dónde lo llamas.
7. Recuerda migrar también el **recálculo del UDS por categoría descontada** (ver sección anterior).

## Referencia
La spec original de este refactor vive en `.kiro/specs/promociones-helper-compartido/` (requirements, design y tasks).
