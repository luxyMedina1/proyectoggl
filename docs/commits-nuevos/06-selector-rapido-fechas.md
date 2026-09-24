# 6. Selector rápido de fechas + tarjetas de información del evento

Commit: `399c70c` — *Permitir cambiar rapido entre fechas*
Archivos v2: `src/eventos/components/SelectorFechasEvento.tsx` (nuevo), `src/eventos/components/iconosEvento.tsx` (nuevo), `src/eventos/pages/detalleEventoPage.tsx`

**Estado: portado a v3 (sin commitear).** Ver «Qué se portó a v3» abajo.

## Por qué se hizo

En un evento multifunción (varias fechas para el mismo evento), la única forma de cambiar de
fecha desde el detalle era volver a la página de información y elegir otra vez. v2 agrega una
barra de pastillas de fecha arriba de "Compra tus boletos" para cambiar de función sin salir de
la página. De paso reemplaza el bloque de texto plano "Información importante del evento" por
tarjetas con ícono (Fecha, Horario, Apertura de puertas, Límite por persona), más fácil de leer.

## Qué cambió en v2

### `SelectorFechasEvento.tsx` — nuevo

- `SelectorFechas`: barra horizontal con una pastilla por función (mes/día arriba, nombre de la
  función abajo si tiene). La activa se resalta y se centra en el scroll con
  `scrollIntoView({ inline: 'center' })` al montar o cambiar de función. Flechas a los lados
  hacen `scrollBy` cuando hay más pastillas de las que caben.
- `InfoEvento`: tarjeta ícono + etiqueta + valor (+ detalle opcional) para el nuevo bloque de
  información.

### `iconosEvento.tsx` — nuevo

Cuatro íconos SVG inline (fecha, horario, apertura, límite) más un chevron reutilizado en las
flechas del selector. Inline en vez de sprite para poder colorearlos con `currentColor` sin
peticiones extra.

### `detalleEventoPage.tsx` — dos bugs corregidos de paso

1. **Fecha/horario pegados a la primera función cargada.** El efecto que pide el detalle del
   evento dependía solo de `[id]`. Como en multifunción el `id` del evento no cambia al elegir
   otra función, cambiar de fecha con el selector no volvía a pedir el detalle: `evento.fecha`,
   `aperturaPuertas` y `finalEvento` quedaban con los de la función anterior aunque la URL ya
   apuntara a la nueva. Fix: el efecto ahora depende de `[id, funcionId]`.
2. **Canonicalización de URL revertía la navegación.** Al cambiar de función, la URL se
   actualiza antes que el estado local (`resuelto`/`funcionId`) termine de resolverse contra el
   nuevo slug. Si el efecto de canonicalización corría en ese hueco, usaba `funcionActiva`
   todavía apuntando a la función vieja y reescribía la URL de vuelta a la anterior. Fix: se
   guarda `slugResuelto` (el slug del que salió el último `resuelto`) y la canonicalización se
   salta mientras `slugResuelto !== slug`.

## Qué se portó a v3

Ya está aplicado en `app/(site)/eventos/[slug]/EventoDetalleView.tsx` (el port de
`detalleEventoPage.tsx`) y dos componentes nuevos colocados junto a los demás de
`eventos/components/` (la carpeta compartida que ya usa `EventoDetalleView.tsx` para
`ListaPreciosCategorias`, `SeccionesAccesibles`, etc.):

- `eventos/components/SelectorFechasEvento.tsx` — mismo `SelectorFechas`/`InfoEvento`, con
  `useNavigate` (react-router) cambiado por `useRouter().push` (`next/navigation`).
- `eventos/components/iconosEvento.tsx` — copia 1:1 (SVG puro, sin dependencias de router).
- `EventoDetalleView.tsx`:
  - `formatFechaConRango` → `formatRangoHora` (ya existía en `utils/dateHelpers.ts`, no hubo que
    crearlo).
  - `rutaEvento` importado de `utils/eventoSlug.ts` (ya existía) para las rutas de cada pastilla.
  - Mismos dos fixes que v2: efecto de fetch con deps `[id, funcionId]`, y estado
    `slugResuelto` guardando la canonicalización.
  - `esMultiFechaSelector` = `!isAbono && evento?.esMultiFuncion && diasDistintosFunciones > 1 &&
    funcionesOrdenadas.length > 1` — en modo abono no se muestra (el flujo de abonos maneja sus
    propias fechas aparte).
  - El bloque de información viejo (`Información importante`, `Disponibles: N tipos de
    boletos`, `Evento: nombre`) se reemplazó por la grilla de 4 tarjetas, igual que en v2 —
    `Disponibles`/`Evento` no tienen equivalente en el diseño nuevo, se quitaron.

Verificado: `npm run typecheck`, `npm run build` y `npx vitest run` (174/174) en verde; probado
en navegador contra el backend real (`sky-fest-laguna`, evento multifunción con 2 días × 2
funciones) — cambiar de pastilla navega, refresca precios/horario y no revierte la URL.

**Pendiente:** commitear estos cambios (no se ha hecho todavía, a la espera de que el usuario lo
pida, mismo criterio que los temas 01-05).
