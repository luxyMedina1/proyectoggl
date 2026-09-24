# 7. `&` se transcribe como "y" en los slugs

Commit v2: `40b2d79` — *no eliminar & slugs* (2026-09-24)
Archivos v2: `src/utils/slugify.ts`

**Estado: portado a v3** (`utils/slugify.ts`, con prueba nueva en `utils/slugify.test.ts`).

## Por qué se hizo

`slugify` borraba el `&` junto con el resto de caracteres no alfanuméricos: "RONDA & JAZZ" daba
`ronda-jazz`, pero el backend genera `ronda-y-jazz`. Cuando el front arma un slug por su cuenta (nombre
de función, evento sin `slug`, ciudad o paquete de CityPass), la URL no coincidía con la del backend y
se perdía el enlace.

## Qué cambió

Una línea antes de colapsar separadores: `.replace(/&/g, " y ")`. Así `RONDA & JAZZ` → `ronda-y-jazz`
y `Rock&Roll` → `rock-y-roll`, igual que el `slugify` del backend.

## Alcance en v3

`slugify` lo usan `utils/eventoSlug.ts` (slug de evento y sufijo de función), las rutas de CityPass
(`/citypass/[slug]`, `/citypass/[slug]/paquete/[paqueteSlug]`), el selector de ciudad del header y el
sitemap. Nombres sin `&` no cambian.
