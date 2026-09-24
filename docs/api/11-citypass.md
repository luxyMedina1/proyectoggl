# Flujo 11 — CityPass

Paquetes de atracciones turisticas por ciudad, con vigencia por dias y accesos que se
van quemando. Es un flujo de compra **paralelo al de eventos**, con sus propios endpoints
de cargo y de transferencias.

| Ruta | Pagina |
|---|---|
| `citypass/:slug` | Landing de la ciudad |
| `citypass/:ciudadSlug/paquete/:paqueteSlug` | Detalle del paquete |
| `citypass/checkout/:paqueteId` | Checkout |
| `citypass/terminar_compra/:compraId` | Retorno de pago (`?id={transaccionId}`) |
| `/perfil/mis_compras` (pestaña) | Mis CityPass |

**Manejo de 404:** para `landing`, `paquete/{id}` y `mis-compras/{id}` un **404 se traduce
a `null`** y la UI muestra un estado vacio en vez de un error.

---

## 11.1 `GET /citypass/publico/landing?ciudadId={id}`

- **Auth:** publico.
- `ciudadId` se resuelve del slug de la URL via `GET /ciudades/get_all_ciudades`
  cuando no viene en el state del router.

La respuesta es una **union discriminada por `configurada`**:

```jsonc
// configurada: false
{
  "configurada": false,
  "ciudad": { "id": 5, "nombre": "Torreon" },
  "mensaje": "Proximamente en tu ciudad"
}
```

```jsonc
// configurada: true
{
  "configurada": true,
  "ciudad": { "id": 5, "nombre": "Torreon" },
  "hero": { "titulo": "Descubre Torreon", "descripcion": "...", "imagen": "https://cdn/..." },
  "categorias": [ { "clave": "museos", "nombre": "Museos", "disponible": true } ],
  "paquetes": [
    {
      "id": 3,
      "nombre": "Pass 3 Atracciones",
      "textoComplementario": "El mas vendido",
      "descripcion": "...",
      "imagenPrincipal": "https://cdn/...",
      "validezDias": 30,
      "cargoServicioPorcentaje": 10,
      "cargoTarjetaPorcentaje": 3,
      "fechaInicioVenta": "2026-01-01T00:00:00.000Z",
      "fechaFinVenta": null,
      "disponibleVenta": true,
      "atraccionesCount": 3,
      "precios": [ { "tipoBoletoId": 1, "tipoBoleto": "Adulto", "precio": 850 } ]
    }
  ],
  "comparativa": {
    "paquetes": [ { "id": 3, "nombre": "Pass 3", "atraccionesIncluidas": 3 } ],
    "atracciones": [
      { "atraccionId": 11, "nombre": "Museo A", "imagenPrincipal": "https://cdn/...",
        "incluida": [true, false] }
    ]
  },
  "galeria": [ { "url": "https://cdn/...", "orden": 1 } ]
}
```

> `comparativa.atracciones[].incluida` es un array de booleanos **alineado posicionalmente**
> con `comparativa.paquetes`.

---

## 11.2 `GET /citypass/publico/paquete/{id}`

```jsonc
{
  "id": 3,
  "nombre": "Pass 3 Atracciones",
  "textoComplementario": "El mas vendido",
  "descripcion": "...",
  "imagenPrincipal": "https://cdn/...",
  "validezDias": 30,
  "cargoServicioPorcentaje": 10,
  "cargoTarjetaPorcentaje": 3,
  "fechaInicioVenta": "2026-01-01T00:00:00.000Z",
  "fechaFinVenta": null,
  "disponibleVenta": true,
  "ciudad": { "id": 5, "nombre": "Torreon" },
  "atraccionesCount": 3,
  "precios": [ { "tipoBoletoId": 1, "tipoBoleto": "Adulto", "precio": 850 } ],
  "atracciones": [
    {
      "id": 11, "nombre": "Museo A", "descripcion": "...", "direccion": "Av. ...",
      "imagenPrincipal": "https://cdn/...", "latitud": 25.54, "longitud": -103.40,
      "galeria": [ { "url": "https://cdn/...", "orden": 1 } ]
    }
  ],
  "galeria": [ { "url": "https://cdn/...", "orden": 1, "atraccionId": 11, "atraccionNombre": "Museo A" } ],
  "mapa": {
    "puntos": [
      { "atraccionId": 11, "nombre": "Museo A", "descripcion": "...", "direccion": "Av. ...",
        "imagenPrincipal": "https://cdn/...", "latitud": 25.54, "longitud": -103.40 }
    ]
  }
}
```

`latitud`/`longitud` pueden ser `null` en `atracciones`, pero en `mapa.puntos` son obligatorias.

---

## 11.3 `POST /pagos/citypass/make/cargo`

**Requiere sesion autenticada Y verificada** (`status === 'authenticated' && isVerified`).

```jsonc
// Request
{
  "paqueteId": 3,
  "items": [ { "tipoBoletoId": 1, "cantidad": 2 } ],
  "tipoDispositivo": "web",
  "device_session_id": "kR2z...",

  // --- Rama A: tarjeta guardada ---
  "source_id": "kdx205ackgpzc7ipavdg",
  "usuarioOpenpayId": "ag4nktpv...",

  // --- Rama B: tarjeta nueva (excluyente con la rama A) ---
  "tarjeta": {
    "card_number": "4111111111111111",
    "holder_name": "JUAN PEREZ",
    "expiration_year": "28",
    "expiration_month": "12",
    "cvv2": "123",
    "device_session_id": "kR2z..."
  }
}
```

> De los items solo viajan `tipoBoletoId` y `cantidad`. El `precio` y el `tipoBoleto`
> son solo para mostrar. Los totales se calculan en cliente a partir de
> `cargoServicioPorcentaje` y `cargoTarjetaPorcentaje` para pintarlos en el resumen;
> el importe que manda el cliente se contrasta contra el que calcula el backend.

```jsonc
// Response
{
  "compraId": 771,
  "cargo": {
    "id": "trzunhilfxbmhtoy2eyh",
    "status": "charge_pending",
    "payment_method": { "type": "redirect", "url": "https://..." }
  }
}
```

3DS cuando `payment_method.url` existe y `type === 'redirect'`.
Retorno: `/citypass/terminar_compra/{compraId}?id={cargo.id}`.

---

## 11.4 `POST /pagos/citypass/check/cargo/{transaccionId}`

- **Body: NINGUNO.**

```jsonc
// Response
{ "message": "Pago aprobado", "compraId": 771, "boletosEmitidos": 2 }
```

---

## 11.5 Mis CityPass

### `GET /citypass/publico/mis-compras`

Si la respuesta no es un array, se coacciona a `[]`.

```jsonc
[
  {
    "id": 771,
    "fecha": "2026-08-01T10:22:00.000Z",
    "estado": "pagada",
    "total": 1972.50,
    "validezDias": 30,
    "paquete": {
      "id": 3, "nombre": "Pass 3 Atracciones", "imagenPrincipal": "https://cdn/...",
      "ciudad": { "id": 5, "nombre": "Torreon" }, "validezDias": 30
    },
    "atraccionesCount": 3,
    "boletosCount": 2,
    "accesosTotales": 6,
    "accesosUsados": 2,
    "completamenteUsado": false,
    "vigente": true
  }
]
```

### `GET /citypass/publico/mis-compras/{id}`

```jsonc
{
  "id": 771,
  "fecha": "2026-08-01T10:22:00.000Z",
  "estado": "pagada",
  "esComprador": true,          // false = es receptor de una transferencia
  "subtotal": 1700.00,
  "cargoServicio": 170.00,
  "cargoTarjeta": 51.00,
  "total": 1921.00,
  "validezDias": 30,
  "completamenteUsado": false,
  "accesosTotales": 6,
  "accesosUsados": 2,
  "paquete": { "id": 3, "nombre": "Pass 3", "imagenPrincipal": "...", "ciudad": { "id": 5, "nombre": "Torreon" } },

  "boletos": [
    {
      "id": 9001,
      "compraId": 771,
      "tipoBoleto": { "id": 1, "nombre": "Adulto" },
      "precioUnitario": 850,
      "estado": "activo",              // 'sin_usar' | 'activo' | 'caducado'
      "vigenciaIniciada": true,
      "diasRestantes": 21,
      "activadoEn": "2026-08-03T11:00:00.000Z",
      "expiraEn": "2026-09-02T11:00:00.000Z",
      "accesos": [
        { "atraccionId": 11, "nombre": "Museo A", "direccion": "Av. ...", "imagen": "https://cdn/...",
          "horario": "10:00 - 18:00", "quemado": true, "fechaQuema": "2026-08-04T12:30:00.000Z" }
      ],
      "esCompradorOriginal": true,
      "esPropietarioActual": true,
      "puedeTransferir": true,          // el backend decide si se pinta el boton
      "puedeDevolver": false,
      "transferencia": {
        "estado": "en_proceso",         // 'en_proceso' | 'transferido'
        "transferId": 55,               // id del pendiente, para cancelar/responder
        "de":   { "id": "uuid", "nombre": "Juan", "imagen": null },
        "para": { "id": "uuid", "nombre": "Ana",  "imagen": null },
        "fecha": "2026-08-05T09:00:00.000Z"
      },
      "qr": null
    }
  ],

  "transferidos": [
    { "id": 9002, "tipoBoleto": { "id": 1, "nombre": "Adulto" }, "estado": "transferido",
      "transferidoA": { "id": "uuid", "nombre": "Ana", "imagen": null }, "fecha": "..." }
  ],

  "tarjeta": { "numero": "XXXX-1234", "marca": "visa", "tipo": "debit", "banco": "BBVA" }
}
```

> Los botones de accion se controlan **desde el servidor** con `puedeTransferir`,
> `puedeDevolver` y `transferencia.estado`. El front no los infiere.
>
> `qr` esta tipado como `any | null` y **nunca se renderiza en web**.

### `GET /citypass/publico/mis-boletos` — sin consumidores

Devuelve `CityPassGrupoBoletos[]` = `{ paquete, boletos: CityPassBoletoDetalle[] }[]`.
Implementado en el hook pero **ningun componente lo llama**.

---

## 11.6 Transferencias de CityPass

| Metodo | Ruta | Body |
|---|---|---|
| `POST` | `/citypass/transferencias` | `{ "boletoId": 9001, "destinatarioId": "uuid" }` |
| `PATCH` | `/citypass/transferencias/{id}` | `{ "accion": "aceptar" \| "rechazar" \| "cancelar" }` |
| `POST` | `/citypass/transferencias/devolver` | `{ "boletoId": 9001 }` |
| `GET` | `/citypass/transferencias/enviadas` | — |
| `GET` | `/citypass/transferencias/recibidas` | — |
| `GET` | `/citypass/transferencias/pendientes/enviadas` | — |
| `GET` | `/citypass/transferencias/pendientes/recibidas` | — |

> **Diferencia con eventos:** el body de `devolver` **no lleva `tipo`**
> (en eventos es `{ tipo, boletoId }`). Ademas la devolucion es **inmediata**,
> sin paso de aceptacion.

Los cuatro GET **toleran tres envolturas**: array plano, `{ items: [...] }` o `{ data: [...] }`.

```ts
interface CityPassTransferencia {
  id: number;
  estado: 'pendiente' | 'completada' | 'rechazada' | 'cancelada';
  tipoMovimiento: 'transferencia' | 'devolucion';
  createdAt: string;
  respondedAt: string | null;
  boleto: { id: number; paquete?: { id: number; nombre: string } } | null;
  fromUser: CityPassUsuarioMin;   // { id, fullName?, email?, image? }
  toUser: CityPassUsuarioMin;
}
```

> **Nombres de campo:** `CityPassTransferencia.fromUser/toUser` usan
> `fullName`/`image`, mientras que `transferencia.de/para` dentro del boleto usan
> `nombre`/`imagen`.

---

## 11.7 Secuencia de compra

```
GET  /ciudades/get_all_ciudades                    (solo si no viene ciudadId en el state)
GET  /citypass/publico/landing?ciudadId={id}
GET  /citypass/publico/paquete/{id}
--- el usuario elige cantidades y navega a /citypass/checkout/{paqueteId} ---
GET  /citypass/publico/paquete/{paqueteId}
GET  /pagos/get/credenciales
GET  /pagos/get/mi_perfil          (fallback POST /pagos/save/usuario)
[opt] POST /pagos/save/tarjeta
POST /pagos/citypass/make/cargo    -> { compraId, cargo: { id, payment_method } }
     '- 3DS -> redirect -> /citypass/terminar_compra/{compraId}?id={cargo.id}
POST /pagos/citypass/check/cargo/{transaccionId}   (SIN body)
```

## 11.8 Secuencia de "Mis CityPass"

```
Promise.all([
  GET /citypass/publico/mis-compras,
  GET /citypass/transferencias/pendientes/recibidas,   // .catch(() => [])
  GET /citypass/transferencias/pendientes/enviadas     // .catch(() => [])
])

--- abrir una compra ---
Promise.all([
  GET /citypass/publico/mis-compras/{compraId},
  GET /citypass/publico/paquete/{paqueteId}
])

--- tras aceptar / rechazar / cancelar / devolver ---
se recargan mis-compras + ambos pendientes + el detalle abierto
```
