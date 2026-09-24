# Flujo 08 — Conferencias (micrositio cosmotech)

Micrositio independiente: estas rutas **no usan `HeaderLayout`**, se renderizan solas.
Se habilita con el flag `habilitarConferencias` de [`/configuraciones/detail/1`](./01-bootstrap-configuracion.md).

| Ruta | Componente |
|---|---|
| `cosmotech/:eventoId` | `DetalleConferencia` |
| `cosmotech/programa/:eventoId` | `ProgramaConferencia` |
| `cosmotech/speakers/:eventoId` | `SpeakersConferencia` |
| `cosmotech/recinto/:eventoId` | `RecintoConferencia` |
| `cosmotech/hoteles/:eventoId` | `HotelesConferencia` |
| `cosmotech/boletos/:eventoId` | `FormConferenciaPage` (registro + compra) |
| `terminar_compra_conferencia/:reservaId/:esGeneral/:invitadoId/:promocionId` | `TerminarCompraConferencia` |
| `terminar_compra_conferencia_gratis/:reservaId/:esGeneral/:invitadoId/:promocionId` | `TerminarCompraConferenciaGratis` |

---

## 8.1 Contenido del micrositio — 5 endpoints gemelos

Cinco hooks practicamente identicos, que solo cambian el segmento de la URL. Todos son `GET`,
sin body, y guardan **la respuesta completa** en estado.

| Endpoint | Pagina |
|---|---|
| `GET /eventos/conferencia/detalle/{eventoId}` | Detalle (y **el NavBar de todas las pantallas**) |
| `GET /eventos/conferencia/programa/{eventoId}` | Programa |
| `GET /eventos/conferencia/speakers/{eventoId}` | Speakers |
| `GET /eventos/conferencia/hoteles/{eventoId}` | Hoteles |
| `GET /eventos/conferencia/recinto/{eventoId}` | Recinto |

> **Carga duplicada:** el `NavBar` monta `useConferencia()` en **cada** pantalla, asi que
> `GET /eventos/conferencia/detalle/{eventoId}` se dispara una vez de mas en todas las paginas
> del micrositio.

### Response (mismo shape declarado en los cinco hooks)

```jsonc
{
  "id": 1200,
  "nombre": "Cosmotech 2026",
  "fecha": "2026-11-05T09:00:00.000Z",
  "descripcion": "...",
  "ubicacion": "Centro de Convenciones",

  "imagenBanner": "https://cdn/...",   // hero (background CSS)
  "imagenLogo":   "https://cdn/...",   // logo del navbar
  "imagenMapa":   "https://cdn/...",   // pagina de recinto

  "beneficios": [ { "descripcion": "...", "imagen": "https://cdn/..." } ],
  "patrocinadores": [ { "id": 1, "logo": "https://cdn/...", "nombre": "ACME" } ],
  "contactos": [ { "id": 1, "foto": "...", "nombre": "...", "puesto": "...", "correo": "..." } ],
  "redes_sociales": [ { } ],

  "programa": [
    {
      "fecha": "2026-11-05",
      "sesiones": [
        {
          "id": 10, "hora": "09:00", "titulo": "Keynote", "descripcion": "...",
          "expositores": [ { "id": 4, "nombre": "Ana Ruiz", "puesto": "CTO", "foto": "...", "orden": 1 } ]
        }
      ]
    }
  ],

  "hoteles": [ { "nombre": "...", "direccion": "...", "web": "...", "foto": "...", "descripcion": "..." } ]
}
```

Notas de consumo:

- `beneficios` se lee por **indice fijo**: `[0]` en el "about" y `[0..3]` en la galeria.
- `expositores` se deduplica por `nombre`, se ordena por `orden`, y **`orden == 0` se manda al final**.
- **`hoteles` no esta en la interfaz TS**: se accede con `(conferencia as any).hoteles ?? []`.
- Manejo de error uniforme: `error.response.data.message`, si no
  `"Ha ocurrido un error al obtener los datos."` + pagina de error.

### Endpoint huerfano

`GET /eventos/conferencia/{eventoId}` existe en `RegistroConferencia.tsx`, pero ese componente
**no esta en el router**. Codigo muerto. Leia `imagenBanner`, `nombre`, `fecha`, `ubicacion`.

---

## 8.2 Registro y compra — `cosmotech/boletos/:eventoId`

### Carga inicial

```
GET  /eventos/{eventoId}/detalle                              -> tarifas, limite, clave_acceso
POST /promociones/validar_promo_web { evento_id }
GET  /eventos/{eventoId}/detalle_seccion/false/web/undefined   <-- ver aviso abajo
GET  /pagos/get/credenciales
```

> `getDetalleEventoSecciones(eventoId)` se llama con **un solo argumento**, asi que la ruta
> sale literalmente con `undefined` en el ultimo segmento. El backend debe tolerar ese string.

De `/eventos/{eventoId}/detalle` se leen ademas dos campos propios de conferencias:

| Campo | Uso |
|---|---|
| `clave_acceso` | String. Habilita el formulario de **expositor** cuando el usuario teclea exactamente ese valor |
| `mostrarWeb` | Referenciado, hoy comentado |

Las secciones con `seccionAdicional != null && !== 0` son los **tipos de boleto** visibles.
La primera con `asientosDisponibles > 0` se autoselecciona a los 500 ms.

### Reserva — `POST /eventos/{eventoId}/reservar_generales`

Mismo contrato que [generales](./05-compra-generales.md#51-post-eventoseventoidreservar_generales):

```jsonc
{ "cantidadAsientos": 2, "seccionId": 88 }
```

Respuesta: `{ "id": "RES-9001", "fechaExpiracion": "..." }`. **Requiere sesion.**

---

## 8.3 El cargo de conferencia — `POST /pagos/make/conferencia/cargo`

Este es **el unico cargo de toda la app que no es JSON**: va como `multipart/form-data`.

### Campos del FormData (todos los posibles)

| Campo | Valor | Condicion |
|---|---|---|
| `eventoId` | id del evento (string) | si `eventoId` truthy |
| `reservaId` | id de la reserva (string) | si `reservaId` truthy |
| `esGeneral` | literal `"true"` | siempre |
| `tipoDispositivo` | literal `"web"` | siempre |
| `source_id` | `tarjetaSeleccionada` o `""` | siempre |
| `tarjeta` | **`JSON.stringify({card_number, holder_name, expiration_year, expiration_month, cvv2, device_session_id})`** | solo si tarjeta nueva y `precioBoletos > 0` |
| `amount` | `calcularTotal().toString()` | siempre |
| `device_session_id` | id de OpenPay | si `deviceDataId` truthy |
| `redirect_url` | literal `"/"` | siempre |
| `promocion_id` | string, `"0"` si no hay promo | siempre |
| `tipo_participante` | `"invitado"` \| `"expositor"` | siempre |
| `nombre` | `formValues.nombre_conferencia` | siempre |
| `telefono` | `formValues.telefono_conferencia` | siempre |
| `empresa` | `formValues.empresa_conferencia` | siempre |
| `puesto` | `formValues.puesto_conferencia` | siempre |
| `correo` | `formValues.correo_conferencia` | siempre |
| `temas` | `formValues.temas_exponer` | siempre (vacio si es `invitado`) |
| `actividades` | `formValues.que_ofrecer` | siempre |
| `requerimientos` | `formValues.requerimientos_espacio` | siempre |
| `no_personas` | `formValues.personas_expositor` | siempre |
| `foto` | **archivo binario** | solo si `formValues.foto instanceof File` |
| `usuarioOpenpayId` | `openId` | solo si hay `tarjetaSeleccionada` **y** `openId` |

> **El campo `tarjeta` es un string JSON, no partes anidadas del multipart.**
> El backend tiene que hacer `JSON.parse` de ese campo.
>
> **Cuidado:** el nombre del titular de la tarjeta sale de `formValues.nombre`,
> mientras que el campo `nombre` del FormData es `formValues.nombre_conferencia`.
> Son dos valores distintos.

**Validaciones del cliente antes de enviar:**
- `invitado` requiere: `nombre_conferencia`, `telefono_conferencia`, `empresa_conferencia`, `puesto_conferencia`, `correo_conferencia`
- `expositor` ademas requiere: `temas_exponer`, `que_ofrecer`, `requerimientos_espacio`, `personas_expositor`
- `foto`: `accept="image/*"`, el MIME debe empezar con `image/`, recomendado 300x300–400x400 px (el usuario puede ignorarlo)

### Response

```jsonc
{
  "invitadoId": 4412,
  "cargo": { "payment_method": { "type": "redirect", "url": "https://..." } }
}
```

`invitadoId` es obligatorio: se inyecta en la ruta de confirmacion.

> **Ruteo del retorno:** solo la rama 3DS esta condicionada. Un cargo que **no** devuelva
> `payment_method.url` — de pago o gratuito — termina en la pantalla
> `terminar_compra_conferencia_gratis`.

---

## 8.4 Los 2 endpoints de confirmacion

| Variante | Endpoint | Claves extra en el body | Id del ticket | Manda correo | Ruteada |
|---|---|---|---|---|---|
| Pago, autenticado | `POST /pagos/check/conferencia/cargo/{invitadoId}/{transaccionId}` | — | `data.id` (no se usa) | no | si |
| Gratis, autenticado | `POST /pagos/check/conferencia/cargo/gratis/{invitadoId}` | — | `data.id` | si | si |

### Body comun

```jsonc
{
  "reservaId": "RES-9001",
  "esGeneral": true,          // esGeneral === "true" en las variantes autenticadas;
                              // hardcodeado a boolean true en las de invitado
  "promocion_id": "7"         // STRING, param crudo de la ruta, nunca se convierte a number
}
```

### Response — variante de pago

```jsonc
{
  "id": 55123,
  "message": "Pago aprobado",
  "total": 3480.00,
  "cargo": { "pagado": true },
  "evento": { "nombre": "Cosmotech 2026", "recinto": { "nombre": "Centro de Convenciones" } }
}
```

### Response — variante gratuita (**envoltura distinta**)

```jsonc
{
  "id": 55123,                 // en la variante de INVITADO gratuito esto viene en ticket.id
  "message": "Registro confirmado",
  "ticket": {
    "total": 0,
    "evento": {
      "nombre": "Cosmotech 2026",
      "imagenLogo": "https://cdn/...",
      "recinto": { "nombre": "Centro de Convenciones" }
    }
  },
  "pases": {
    "generatedMaps": [ { "quemadoUUID": "b1f2c3d4-..." } ]
  }
}
```

**El QR se arma en el cliente** con:

```js
JSON.stringify({ quemadoUUID, general: esGeneral })
```

donde `general` es el **string crudo** de la ruta (`"true"`), no un boolean.

### `POST /correos/sold-tickets-email-invitado-conferencia/{invitadoId}/{ticketId}`

- **Body:** ninguno.
- **Response:** trae `user.email`, pero la pagina gratuita la descarta.

---

## 8.5 Otros endpoints de esta pagina

| Endpoint | Body |
|---|---|
| `POST /pagos/save/tarjeta` | payload de tarjeta (solo con tarjeta nueva y `precioBoletos > 0`) |
| `POST /pagos/aplicar-promo` | `{ promocionId, eventoId }` |
| `POST /promociones/validar_clave_web` | `{ clave, evento_id }` — **match contra `categorias[].categoriaGeneral.nombre`** |
| `DELETE /pagos/tarjeta/{clienteId}/{tarjetaId}` | — |
| `POST /eventos/{eventoId}/cancelar` | `{ reservaId, esGeneral: true }` → luego navega a `/cosmotech/{eventoId}` |

---

## 8.6 Secuencia resumida

```
GET  /eventos/{eventoId}/detalle
POST /promociones/validar_promo_web { evento_id }
GET  /eventos/{eventoId}/detalle_seccion/false/web/undefined
GET  /pagos/get/credenciales

--- requiere sesion ---
POST /eventos/{eventoId}/reservar_generales { cantidadAsientos, seccionId }
GET  /pagos/get/mi_perfil            (fallback POST /pagos/save/usuario)
[opt] POST /promociones/validar_clave_web
[opt] POST /pagos/save/tarjeta
[si promo] POST /pagos/aplicar-promo

POST /pagos/make/conferencia/cargo        <-- multipart/form-data
     -> { invitadoId, cargo: { payment_method: { url, type } } }

  PAGO + 3DS -> redirect
             -> /terminar_compra_conferencia/{reservaId}/true/{invitadoId}/{promocionId}?id={transaccionId}
             -> POST /pagos/check/conferencia/cargo/{invitadoId}/{transaccionId}
             (no se manda correo)

  GRATIS / sin 3DS
             -> /terminar_compra_conferencia_gratis/{reservaId}/true/{invitadoId}/{promocionId}
             -> POST /pagos/check/conferencia/cargo/gratis/{invitadoId}
             -> POST /correos/sold-tickets-email-invitado-conferencia/{invitadoId}/{id}
             -> QR renderizado en cliente desde pases.generatedMaps[0].quemadoUUID

[abortar] POST /eventos/{eventoId}/cancelar { reservaId, esGeneral: true }
```
