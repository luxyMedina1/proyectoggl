# Flujo 03 — Catalogo, busqueda y detalle de evento

Cubre el home (`/eventos`), el explorador de reels (`/explorar`) y la resolucion de slugs
hacia el detalle de evento. Todos estos endpoints son **publicos** (se manda el Bearer si existe,
pero no es obligatorio).

---

## 3.1 Home — `GET /eventos/get_all_select?tipoDispositivo=web`

- **Auth:** no requiere. **Body:** ninguno.
- **Query:** `tipoDispositivo=web` esta hardcodeado.

```jsonc
// Response — el front solo lee `eventosFiltrados`
{
  "eventosFiltrados": [
    {
      "id": 1084,
      "slug": "tuff-riders",
      "tipo": "Comercial",              // agrupa las secciones del home. Solo "Comercial" y "Conferencia" tienen config
      "nombre": "Tuff Riders",
      "fecha": "2026-09-12T20:00:00.000Z",
      "aperturaPuertas": "2026-09-12T18:00:00.000Z",
      "finalEvento": "2026-09-12T23:30:00.000Z",
      "descripcion": "...",
      "precioBase": "450.00",
      "precioMin": "450.00",
      "precioMax": "2500.00",
      "asientosDisponibles": 320,
      "imagenPromocion": "https://cdn/.../promo.jpg",
      "imagenBanner": "https://cdn/.../banner.jpg",   // si falta, se usa imagenPromocion
      "categoria": "Conciertos",                       // se cruza con /categorias/get_all
      "artista":  { "id": 3,  "nombre": "Tuff Riders", "genero": "Rock" },
      "recinto":  { "id": 12, "nombre": "Auditorio X", "direccion": "Av. ..." },
      "ciudad":   { "id": 5,  "nombre": "Torreon" },
      "esMultiFuncion": true,
      "funciones": [
        { "id": 77, "fecha": "2026-09-12T20:00:00.000Z", "nombre": "Matutino",
          "aperturaPuertas": "2026-09-12T18:00:00.000Z", "finalEvento": "2026-09-12T23:30:00.000Z" }
      ]
    }
  ]
}
```

### Reglas de multifecha (se resuelven en el cliente)

- Las `funciones` se ordenan por `fecha` y se agrupan por `yyyy-MM`.
- "Multifecha" = `esMultiFuncion === true` **y** mas de un dia distinto entre las funciones.
- Cuando es multifecha, el texto de apertura de puertas pasa a ser literalmente
  **"varía según cada fecha"** en vez de una hora concreta.
- Fechas iguales se agrupan y se muestran juntas.

---

## 3.2 Resolucion de slug — `GET /eventos/slug/{slug}`

Traduce la URL legible (`/eventos/tuff-riders`) al par de ids que necesita el resto del flujo.

- **Auth:** no requiere. `slug` va con `encodeURIComponent`.

```jsonc
// Response
{ "eventoId": 1084, "funcionId": 77 }   // funcionId puede ser null
```

Lanza error si `eventoId` viene `null`/`undefined`.

### Cadena de fallbacks (`src/hooks/useEventosStore.tsx:33-49`)

1. Si el segmento de URL es **todo digitos** (`/eventos/1084`, QR viejos ya impresos),
   se usa como id directamente y **no se hace ninguna peticion**.
2. Si `/eventos/slug/{slug}` falla, cae a `GET /eventos/get_all_select?tipoDispositivo=web`
   y resuelve el slug localmente contra `eventosFiltrados`.

> Contrato adicional documentado en `docs/slugs-eventos.md`.

---

## 3.3 Catalogos auxiliares

### `GET /categorias/get_all`

```jsonc
{ "categorias": [ { "id": 1, "nombre": "Conciertos" } ], "paginacion": { } }
```

El `nombre` en minusculas elige el icono del home: `deportes`, `concierto`, `artes`,
`conferencia`, `teatro`.

### `GET /ciudades/get_all_ciudades`

El front **tolera dos formas**: un array plano o `{ ciudades: [...] }`. Cualquier otra cosa → `[]`.

```jsonc
{ "ciudades": [ { "id": 5, "nombre": "Torreon" } ] }
```

### `GET /abonos/evento/{id}` (solo desde el home)

Se llama **solo si** `status === "authenticated" && isVerified`. Un usuario sin sesion
salta directo al selector de fechas.

Acepta **tres formas** de respuesta: array plano, `{ abonos: [...] }`, o un objeto suelto
(que se envuelve en array).

```jsonc
[
  {
    "id": 9,
    "nombre": "Abono Temporada 2026",
    "funciones": [ { "id": 77, "fecha": "...", "nombre": "..." } ],
    "evento": { "id": 1084, "nombre": "Tuff Riders", "slug": "tuff-riders", "imagen": "https://cdn/..." }
  }
]
```

> Ojo: aqui el campo de imagen es **`evento.imagen`**, no `imagenPromocion`.

Genera el enlace `/eventos/{slug}?isAbono=true&abonoId={abono.id}`.

---

## 3.4 Explorar — feed de reels

El feed vertical de `/explorar` tiene su propio documento:
**[flujo 12 — Explorar / Reels](./12-explorar-reels.md)**.

Comparte con este flujo `GET /categorias/get_all` y `GET /ciudades/get_all_ciudades` (para los
filtros), y llama a `GET /eventos/{id}/detalle` cuando el CTA de un reel apunta a un evento
multifuncion y hay que elegir fecha.

---

## 3.5 Detalle de evento — `GET /eventos/{id}/detalle`

Es la base de todas las paginas de compra. **Publico** — la sesion solo hace falta al reservar.

```jsonc
// Response — campos que el front realmente lee
{
  "id": 1084,
  "slug": "tuff-riders",
  "nombre": "Tuff Riders",
  "fecha": "2026-09-12T20:00:00.000Z",
  "aperturaPuertas": "2026-09-12T18:00:00.000Z",
  "finalEvento": "2026-09-12T23:30:00.000Z",
  "funciones": [
    { "id": 77, "fecha": "...", "nombre": "Matutino", "aperturaPuertas": "...", "finalEvento": "..." }
  ],

  "descripcion": "texto enriquecido",       // -> og:description (se aplana)
  "descripcionExtra": "<p>HTML</p>",        // -> se renderiza sanitizado
  "imagenPromocion": "https://cdn/...",
  "categoria": "Conciertos",
  "artista": { "id": 3, "nombre": "Tuff Riders" },
  "ciudad":  { "id": 5, "nombre": "Torreon" },
  "recinto": {
    "id": 12, "nombre": "Auditorio X", "direccion": "Av. ...",
    "svg": "<svg>...</svg>",     // mapa del recinto, se inyecta con dangerouslySetInnerHTML
    "esGeneral": false           // true oculta el "haz clic en el mapa"
  },

  "limiteDeAsientos": 10,        // maximo de boletos por compra
  "esGratuito": false,           // true -> se salta el pago y va a /eventos/{id}/gratis

  // --- Tarifas: llegan como STRING decimal, el front hace parseFloat ---
  "usoDeTarjeta": "0.03",        // udt
  "usoDeServicio": "0.10",       // uds
  "ivaRate": "0.16",
  "isIvaApplied": true,
  "udsPorCategoria": false,      // true -> el uds se lee por seccion, no global

  "cargosPorCategoria": [
    { "id": 1, "categoria": "VIP", "cargoPorCategoria": "50.00" }
  ]
}
```

### Como se aplica la funcion seleccionada

`GET /eventos/{id}/detalle` se llama **sin la funcion**. El front despues parcha
`fecha`, `aperturaPuertas` y `finalEvento` con la entrada de `funciones` que coincida con
el `funcionId` resuelto del slug. Si el evento tiene exactamente una funcion y no se dio
`funcionId`, gana esa unica funcion.

---

## 3.6 Secciones — `GET /eventos/{id}/detalle_seccion/false/web/{funcion}`

Los segmentos son **posicionales y dos estan hardcodeados**: `false` (literal) y `web`
(tipoDispositivo). **Este es el unico request al que llega la funcion.**

```jsonc
// Response
{
  "secciones": [
    {
      "id": 45,
      "nombre": "General",              // se cruza contra el id del nodo SVG (case-insensitive, exacto)
      "bloque": "A",                    // se cruza contra el atributo `bloque` del SVG
      "tipo_seccion": "general",        // 'general' | 'numerada' | 'suite' | 'mesas'
      "precioSeccion": "450.00",
      "precioAdicional": "0.00",
      "asientosDisponibles": 120,       // null permitido -> "Agotados"
      "colores": ["#FF0000", "#AA0000"],// 1 color = fill plano; 2+ = linearGradient generado
      "color": "#FF0000",
      "colorGeneral": "#FF0000",
      "nombreEspecial": "General A",    // clave para hacer match de promociones
      "uds": "0.10",                    // usado solo si evento.udsPorCategoria === true
      "seccionAdicional": null,         // != null && !== 0 -> va al bloque "Generales Adicionales"
      "disponiblesPorCategoria": [
        { "categoria": "Adulto", "disponibles": 80 }
      ]
    }
  ],
  "seccionesOcultas": [ /* mismo shape; su nodo SVG recibe opacity: 0 */ ],
  "preciosCategorias": [
    { "categoria": "VIP", "color": "#FFD700", "precios": [2500, 1800] }
  ]
}
```

**Ordenamiento de `preciosCategorias` (cliente):** se descartan precios <= 0, los precios se
ordenan descendente, y las categorias se ordenan por precio maximo descendente, luego las que
contienen "izquierda" primero, luego alfabetico.

### Ruteo segun `tipo_seccion`

| Valor | Comportamiento |
|---|---|
| `general` | Abre el modal de cantidad en la misma pagina → [flujo 05](./05-compra-generales.md) |
| cualquier otro | Navega a `/eventos/{slug}/{seccion.id}/{seccion.nombre}` → [flujo 06](./06-compra-numerados.md) |
