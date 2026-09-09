# Migración a v3 (Next.js) — Cambios desde `fecdc62`

Este documento describe **qué cambió, por qué se hizo y cómo migrarlo** al proyecto v3 (Next.js).
Cubre desde el commit `fecdc62823fc56b68f9dd627cd994547e52bd8da` (incluido) hasta `HEAD`.

## Rango de cambios

| Commit | Título | Tema |
|--------|--------|------|
| `fecdc62` | Leyenda mapa y página información | Multifecha: redirección + UI de fechas/abonos y leyenda de precios configurable |
| `3355c5c` | Separar a un helper promociones | Refactor: fuente única de verdad para promociones + nuevo tipo `RESTA` |
| `e36ede7` | Mostrar promoción aplicada compra | UI: mostrar promo y precio original tachado en perfil/pedidos |
| `a4da7ba` | Fix: sale selección de abonos sin abonos | UX: saltar paso intermedio cuando no hay abonos |
| `a2e80bb` | Feat: usar lat y lon recintos | Abrir Google Maps por coordenadas cuando el recinto las tiene |

Cada tema tiene su propio documento:

- [`00-leyenda-mapa-pagina-informacion.md`](./00-leyenda-mapa-pagina-informacion.md)
- [`01-helper-promociones.md`](./01-helper-promociones.md)
- [`02-mostrar-promocion-aplicada.md`](./02-mostrar-promocion-aplicada.md)
- [`03-fix-abonos-sin-abonos.md`](./03-fix-abonos-sin-abonos.md)
- [`04-recintos-lat-lon-maps.md`](./04-recintos-lat-lon-maps.md)
- [`05-rendimiento-lcp-next.md`](./05-rendimiento-lcp-next.md) — plan de trabajo para el LCP en v3

## Contexto del proyecto v3

- v3 está en **Next.js**. Todo lo que se pueda mover a **server side** (Server Components, data fetching en el servidor, generación de metadatos) es preferible.
- El helper de promociones es **código puro (sin React, sin DOM, sin llamadas a API)**, por lo que se puede reutilizar tal cual tanto en cliente como en servidor.
- El LCP actual es muy pobre según PageSpeed (móvil LCP ~23.4 s, escritorio ~5.2 s). Migrar a Next es la oportunidad para atacarlo de raíz. Ver documento 05.

## Principio general de la migración

El objetivo del refactor de promociones fue tener **una sola fuente de verdad**: la lógica de cálculo de descuentos estaba **duplicada** en tres páginas (numerados, generales/detalle y conferencias) con pequeñas variaciones que causaban inconsistencias. Al migrar a v3, **no vuelvas a duplicar esa lógica**: importa el helper.
