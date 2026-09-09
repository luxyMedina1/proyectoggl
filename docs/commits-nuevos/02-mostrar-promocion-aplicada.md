# 2. Mostrar promoción aplicada en la compra

Commit: `e36ede7` — *Mostrar promoción aplicada compra*
Archivos: `src/eventos/pages/perfil/components/BoletoCard.tsx`, `src/eventos/pages/perfil/components/DetallesPedidoTab.tsx`

## Por qué se hizo

Cuando un boleto se compraba con una promoción, en el perfil / detalle del pedido **no había ninguna señal de que se aplicó un descuento**. El usuario no veía la promo ni el precio original. Este cambio muestra:

- El **nombre de la promo** aplicada (badge verde, ej. `PROMO: 2x1`).
- El **precio original tachado** cuando difiere del precio final.
- El **precio final** pagado.

## Cambios de datos (contrato con la API)

Se agregaron dos campos opcionales al boleto que la API debe enviar:

```ts
precioOriginal?: string | number;
promocion?: { id: number; nombre?: string; tipo?: string } | null;
```

En `BoletoCard.tsx` (`BoletoCardData`) y en `DetallesPedidoTab.tsx` (`BoletoLike`).

## Cambios de lógica

Se **corrigió la prioridad del precio mostrado**. Antes, para pase general se anteponía `precioEspecial`; ahora se prioriza siempre `boleto.precio` (el precio realmente pagado, ya con promo) y se cae a `precioEspecial` como respaldo:

```ts
// Antes (BoletoCard):
const precio = esPaseGeneral ? boleto.eventoSeccion?.precioEspecial ?? boleto.precio : boleto.precio;
// Ahora:
const precio = boleto.precio ?? boleto.eventoSeccion?.precioEspecial;
```

Lo mismo en `DetallesPedidoTab` para el `total` y para el precio por línea:

```ts
const p = b.precio ?? b.eventoSeccion?.precioEspecial ?? 0;
```

Esto asegura que el **total del pedido refleje los precios con descuento**, no el precio especial de sección.

## Cambios de UI

**`BoletoCard.tsx`** — el footer del precio pasó de un `<span>` simple a un bloque en columna:

```tsx
<div className="flex flex-col items-end whitespace-nowrap">
  {boleto.promocion?.nombre && (
    <span className="text-[10px] font-semibold text-emerald-600 uppercase leading-tight">
      PROMO: {boleto.promocion.nombre}
    </span>
  )}
  {boleto.promocion?.nombre && boleto.precioOriginal != null &&
   Number(boleto.precioOriginal) !== Number(precio ?? 0) && (
    <span className="text-xs text-gray-400 line-through">
      ${Number(boleto.precioOriginal).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  )}
  <span className="text-lg font-bold text-gray-800">{precioStr}</span>
</div>
```

**`DetallesPedidoTab.tsx`** — junto al nombre del asiento se muestra el nombre de la promo:

```tsx
{b.promocion?.nombre && (
  <span className="ml-1 text-[10px] font-semibold text-emerald-600 uppercase">· {b.promocion.nombre}</span>
)}
```

## Cómo migrar a v3 (Next.js)

1. Asegúrate de que el endpoint de boletos/pedidos del backend devuelva `precioOriginal` y `promocion` (id, nombre, tipo). Es prerequisito; sin esos campos la UI simplemente no muestra el badge.
2. Reproduce la **regla de prioridad de precio** (`precio ?? precioEspecial`) en v3, tanto para el precio por boleto como para el total del pedido.
3. Estos componentes son de **presentación pura sobre datos ya cargados**: en Next conviene que el pedido/perfil se **cargue en el servidor** (Server Component) y estos componentes reciban los datos como props. No requieren interactividad, así que pueden ser Server Components (no necesitan `"use client"`).
4. Mantén el formateo con `toLocaleString('es-MX', ...)` para consistencia de moneda.
