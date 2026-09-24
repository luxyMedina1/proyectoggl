# Flujo 07 — Abonos (paquetes de temporada)

Un abono vende **el mismo lugar (o un lugar por funcion) a lo largo de varias funciones**.

- Ruta: `/abonos/:slug/:seccionId/:seccion?funcionId={id}&abonoId={id}`
- Pagina: `src/eventos/pages/AbonoSeccionAsientoPage.tsx`
- Retorno 3DS: `/terminar_compra_abono?id={transaccionId}` (sin params de ruta)
- Se llega desde el detalle de evento y desde el home (`/eventos/{slug}?isAbono=true&abonoId={id}`)

---

## 7.1 `GET /abonos/{id}`

El `{id}` es `abonoId` del query string, con `eventoId` como fallback.

```jsonc
// Response
{
  "id": 9,
  "nombre": "Abono Temporada 2026",
  "fecha": "2026-09-12T20:00:00.000Z",
  "eventoId": 1084,
  "evento": { "id": 1084, "limiteDeAsientos": 6 },

  "funciones": [
    { "id": 77, "fecha": "2026-09-12T20:00:00.000Z" },
    { "id": 78, "fecha": "2026-10-10T20:00:00.000Z" }
  ],

  "precios": [
    { "categoriaId": 1, "categoria": "VIP", "color": "#FFD700", "precio": 2500, "precios": [] }
  ],

  "esGratuito": false,
  "limiteDeAsientos": 6,
  "udsPorCategoria": false,
  "categoria": "Deportes",
  "recinto": { "id": 12, "nombre": "Estadio X" },
  "ciudad":  { "id": 5, "nombre": "Torreon" },
  "artista": { "id": 3, "nombre": "Equipo X" },
  "imagenPromocion": "https://cdn/...",
  "cargosPorCategoria": [ { "id": 1, "categoria": "VIP", "cargoPorCategoria": "50.00" } ]
}
```

`eventoId` (o `evento.id` como fallback) es el id que se usa para las promociones.

---

## 7.2 Mapa de asientos por funcion

Se reutiliza `GET /eventos/{idEvento}/{idSeccion}/filas_por_seccion/{funcionId}`
— mismo contrato que en [numerados](./06-compra-numerados.md#61-get-eventosideventoidseccionfilas_por_seccionfuncionid).

**Se vuelve a llamar cada vez que el usuario cambia de pestaña de funcion.** En modo
`mismo_asiento` usa `funciones[0].id`; en modo `por_funcion` usa la funcion activa.

---

## 7.3 `POST /abonos/{abonoId}/reservar`

**Requiere sesion.** Sin `user` se abre el modal de login y se reintenta al terminar.

El body cambia segun el **modo** de compra:

```jsonc
// modo = "mismo_asiento" — el mismo lugar en todas las funciones
{ "modo": "mismo_asiento", "asientoIds": [9001, 9002] }
```

```jsonc
// modo = "por_funcion" — un asiento distinto por funcion
{
  "modo": "por_funcion",
  "selecciones": [
    { "funcionId": 77, "asientoId": 9001 },
    { "funcionId": 78, "asientoId": 9044 }
  ]
}
```

`selecciones` se arma mezclando el borrador de `localStorage` (`abonoBuilder.asientosPorFecha`)
con la seleccion de la pestaña activa.

### Respuesta de exito

```jsonc
{ "reservaId": "ABO-4412", "fechaExpiracion": "2026-08-24T18:35:00.000Z" }
```

### Respuesta de conflicto parcial (**no es un error HTTP**)

```jsonc
{
  "completo": false,
  "noDisponibles": [
    { "funcionId": 77, "asientoId": 9001 }
  ]
}
```

> El wrapper de `useEventosStore` **captura el error de axios y lo devuelve como valor resuelto**
> cuando el body trae `noDisponibles` o `completo === false`. El front entonces marca los
> asientos conflictivos y **fuerza la UI al modo `por_funcion`** para que el usuario reelija
> solo las funciones problematicas. La comparacion se hace con
> `String(funcionId)` y `Number(asientoId)`.

### Borrador en localStorage (no es API, pero refleja el contrato)

```jsonc
// clave: "abonoBuilder"
{
  "abonoId": 9,
  "modo": "por_funcion",
  "asientosPorFecha": { "77": [9001], "78": [9044] },
  "seleccionesParciales": [
    { "funcionId": 77, "asientoId": 9001, "seccionId": 45, "asientosObj": [ /* Asiento */ ] }
  ]
}
```

---

## 7.4 `POST /pagos/make/cargo_abono`

```jsonc
// Request
{
  "reservaId": "ABO-4412",
  "abonoId": 9,                       // Number(queryParams.get('abonoId'))
  "tipoDispositivo": "web",
  "source_id": "kdx205ackgpzc7ipavdg",   // o "" con tarjeta nueva
  "tarjeta": {                        // undefined cuando hay source_id
    "card_number": "4111111111111111",
    "holder_name": "JUAN PEREZ",
    "expiration_year": "28",
    "expiration_month": "12",
    "cvv2": "123",
    "device_session_id": "kR2z..."
  },
  "amount": 5240.80,
  "device_session_id": "kR2z...",
  "redirect_url": "/",
  "usuarioOpenpayId": "ag4nktpv..."   // SOLO cuando se usa tarjeta guardada
}
```

Respuesta y bifurcacion 3DS: [flujo 04, seccion 4.5](./04-pagos-openpay.md#45-contrato-comun-de-los-cargos).

> El wrapper lanza un `Error('Error al procesar el abono')` generico, pero la pagina si
> inspecciona `error.response.data.message` e `isPromoError`.

---

## 7.5 `POST /pagos/check/cargo_abono/{transaccionId}`

- **Request body: NINGUNO.** Es la unica variante de `check` que no manda nada.
  (Todas las de conferencia mandan `{reservaId, esGeneral, promocion_id}`.)
- Se llama desde dos lugares: en linea cuando no hubo 3DS, y desde
  `/terminar_compra_abono?id={transaccionId}` cuando si lo hubo.

```jsonc
// Response — solo la pagina de retorno la consume
{
  "id": 55123,
  "email": "usuario@dominio.com",
  "message": "Pago aprobado",
  "total": 5240.80,
  "cargo": { "pagado": true },
  "evento": { "nombre": "Temporada 2026", "recinto": { "nombre": "Estadio X" } }
}
```

Status aceptados: **200 o 201**. `cargo.pagado` es la compuerta del exito.

---

## 7.6 Abono gratuito — `POST /eventos/{eventoId}/gratis`

El id de la ruta es `evento?.id` (el `id` de la respuesta de `/abonos/{id}`),
**no** el `abonoId` del query string.

```jsonc
{
  "esGeneral": false,
  "reservaId": "ABO-4412",
  "email": "usuario@dominio.com",
  "nombre": "Juan Perez"
}
```

En este flujo **si esta vivo** el envio de correo (a diferencia de numerados):

```
POST /correos/sold-tickets-email/{user.email}/{resdata.id}
```

**Sin body**; su respuesta se ignora.

---

## 7.7 `POST /eventos/{eventoId}/cancelar`

```jsonc
{ "reservaId": "ABO-4412", "esGeneral": false }
```

Se lee `response.success`.

---

## 7.8 Promociones en abonos

Mismos endpoints de [flujo 04](./04-pagos-openpay.md#43-promociones), con una diferencia:

> El match de categorias en abonos se hace contra **`categorias[].categoria.nombre`**
> (conferencias usa `categorias[].categoriaGeneral.nombre`).

El `evento_id` que se manda es el `eventoId` de la respuesta de `/abonos/{id}`.

---

## 7.9 Secuencia resumida

```
GET  /eventos/slug/{slug}                                  -> { eventoId, funcionId }
GET  /abonos/{abonoId|eventoId}                            -> funciones[], precios[], esGratuito
POST /promociones/validar_promo_web { evento_id }
GET  /eventos/{eventoId}/{seccionId}/filas_por_seccion/{funcionId}   (por cada pestaña de funcion)
GET  /pagos/get/credenciales
[opt] POST /promociones/validar_clave_web { clave, evento_id }

--- requiere sesion ---
POST /abonos/{abonoId}/reservar { modo, asientoIds | selecciones }
     |- 200 { reservaId, fechaExpiracion }
     '- { completo:false, noDisponibles:[...] }  -> UI forzada a 'por_funcion', reintentar
GET  /pagos/get/mi_perfil        (fallback POST /pagos/save/usuario)

si esGratuito:
  POST /eventos/{eventoId}/gratis
  POST /correos/sold-tickets-email/{email}/{ticketId}
si no:
  [opt] POST /pagos/save/tarjeta
  [si promo] POST /pagos/aplicar-promo
  POST /pagos/make/cargo_abono   -> { cargo: { id, payment_method } }
       |- 3DS  -> redirect -> /terminar_compra_abono?id={transaccionId}
       '- POST /pagos/check/cargo_abono/{transaccionId}   (SIN body)

[abortar] POST /eventos/{eventoId}/cancelar { reservaId, esGeneral:false }
```
