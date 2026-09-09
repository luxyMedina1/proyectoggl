# 0. Leyenda del mapa y página de información (multifecha)

Commit: `fecdc62` — *Leyenda mapa y pagina informacion*
Archivos: `src/eventos/pages/detalleEventoPage.tsx`, `src/eventos/pages/infoEventoPage.tsx`

> Este es el commit base del rango. Trae dos cosas: el manejo de eventos **multifecha** (redirección + nueva UI en la página de información) y una **leyenda de precios configurable** por evento.

## Por qué se hizo

1. **Multifecha entrando directo al mapa**: si un evento multifecha se abría **sin una función elegida** en la URL, el mapa (`detalle_seccion`) necesitaba una función y respondía con error, **redirigiendo al inicio**. Mala experiencia: el usuario quedaba varado.
2. **Página de información pobre para multifecha**: solo mostraba la primera función (se veía mal) y un botón genérico de comprar, sin listar las fechas ni los abonos disponibles.
3. **Leyenda de precios hardcodeada**: el texto "*Los precios son más cargos por servicio y en pesos mexicanos*" estaba fijo en el código, con parches por `id` de evento (ej. el evento 59). Se cambió por un campo `leyendaMapa` configurable desde el backend.

## Cambios en `detalleEventoPage.tsx`

### Redirección de multifecha sin función
Si el evento es multifecha (`esMultiFuncion` y **más de un día distinto**) y no hay `funcionId`, en lugar de fallar y mandar al inicio, se redirige a la página de información:

```ts
if (!funcionId && response.esMultiFuncion) {
  const diasDistintos = new Set(
    (response.funciones ?? []).map((f: any) => formatDate(f.fecha, 'yyyy-MM-dd')),
  ).size;
  if (diasDistintos > 1) {
    const destino = buildEventoSlug(response) || slug;
    navigate(`/eventos/informacion/${destino}`, { replace: true });
    return;
  }
}
```
El criterio de "multifecha" es **días distintos > 1** (varias funciones el mismo día cuentan como una sola).

### Nuevo orden de categorías (DAYPASS al final)
Antes las categorías se ordenaban por precio de mayor a menor, y a igualdad de precio se priorizaban las que tuvieran "izquierda" en el nombre. Ahora se ordenan **por nombre ascendente**, dejando siempre al final las categorías **DAYPASS** (ignorando espacios para cubrir "day pass" y "daypass"):

```ts
const esDaypassA = nombreA.replace(/\s+/g, "").includes("daypass");
const esDaypassB = nombreB.replace(/\s+/g, "").includes("daypass");
if (esDaypassA && !esDaypassB) return 1;   // daypass al final
if (!esDaypassA && esDaypassB) return -1;
return nombreA.localeCompare(nombreB);       // resto por nombre ASC
```

### Leyenda configurable
El texto de precios fijo se reemplazó por el campo `leyendaMapa` del evento:

```tsx
// Antes: texto fijo con parche por evento.id === 59
<p ...>*Los precios son {...} en pesos mexicanos.*</p>
// Ahora:
<p ...>{evento.leyendaMapa ? `*${evento.leyendaMapa}*` : ''}</p>
```
Se agregó `leyendaMapa: string` a la interfaz `Evento`.

### Botón "Agotados"
El botón de sección agotada ahora usa `invisible` (queda con un `TODO` para regresar el estado "Agotados" visible más adelante).

## Cambios en `infoEventoPage.tsx`

Se agregó a la interfaz `Evento`: `esMultiFuncion?`, `funciones?`. Y estado nuevo: `abonosEvento`, `cargandoAbonosEvento`.

### Detección de multifecha (mismo criterio que catálogo/home)
```ts
const funcionesOrdenadas = [...(evento?.funciones ?? [])].sort(
  (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
);
const diasDistintosFunciones = new Set(
  funcionesOrdenadas.map((f) => formatDate(f.fecha, 'yyyy-MM-dd')),
).size;
const esMultiFecha = !!evento?.esMultiFuncion && diasDistintosFunciones > 1;
```

### Texto de fecha del encabezado (rango en multifecha)
En multifecha se muestra un **rango** en vez de la primera función. Maneja el caso de mismo mes vs. cruce de mes:

```ts
// mismo mes:   "12 al 15 de octubre de 2025"
// cruza mes:   "12 de octubre al 3 de noviembre de 2025"
```
Se reemplazaron dos bloques de `toLocaleDateString/toLocaleTimeString` inline por esta función `textoFechaEncabezado()`.

### Carga de abonos (solo multifecha, una vez)
Se piden los abonos con `GET /abonos/evento/{id}` solo cuando el evento es multifecha, con la misma normalización de respuesta que el home (`array` / `{ abonos }` / objeto único) y bandera `activo` para evitar setState tras desmontar.

### Nueva UI de compra en multifecha
Cuando `esMultiFecha`, la sección de compra muestra:
- **Abonos de temporada** (si hay o mientras cargan): cards con nombre del abono, primeras fechas (máx. 4 + "+N fechas más") y link a `?isAbono=true&abonoId=...`.
- **Elige una fecha**: grid de cards por función con día/mes, día de semana, rango de hora (`formatRangoHora`), apertura de puertas y recinto, cada una enlazando a `rutaEvento(evento, funcion)`.

Cuando **no** es multifecha, se conserva el comportamiento anterior (flecha animada + "Comprar boletos"). Se eliminó el bloque comentado del SVG del mapa.

Se usa un nuevo helper `formatRangoHora` de `utils/dateHelpers` y nuevos íconos (`HiOutlineTicket`, `LuCalendarClock`, `GoChevronRight`, `FaLocationArrow`).

## Cómo migrar a v3 (Next.js)

1. **Backend primero**: el evento debe exponer `esMultiFuncion`, `funciones` (con `fecha`, `finalEvento`, `aperturaPuertas`, `nombre`) y `leyendaMapa`. Sin `leyendaMapa` no se muestra nada (elimina los parches por `id`).
2. **Rutas / redirección**: en Next la redirección de "multifecha sin función" es un caso ideal para resolver en el **servidor** (en el Server Component / `generateMetadata` / middleware): si es multifecha y no hay función en la URL, `redirect()` a la página de información. Así se evita el flash de cliente y el ida y vuelta.
3. Centraliza el criterio de **multifecha (`esMultiFuncion && díasDistintos > 1`)** en un helper compartido; hoy está repetido en home, catálogo, detalle e información. Igual que con promociones, conviene una sola fuente de verdad.
4. La lista de fechas y abonos de la página de información puede **renderizarse en el servidor** (Server Component) porque son datos + links, sin interactividad. Solo el fetch de abonos necesita estar disponible en SSR (mismo endpoint `/abonos/evento/{id}`).
5. Reutiliza `formatRangoHora` y la función `textoFechaEncabezado` (extráela a un helper puro de fechas para poder usarla en server).
6. Mantén el orden de categorías con **DAYPASS al final** al portar el detalle.
