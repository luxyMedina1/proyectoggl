# Flujo 09 — Perfil, mis compras, boletos y QR

Todo bajo `/perfil/*` esta protegido por `ProtectedRoute` (redirige a `/auth/login`
si no hay `user`). **Todos estos endpoints requieren Bearer.**

| Ruta | Pagina |
|---|---|
| `/perfil/mi_perfil` | Datos personales y foto |
| `/perfil/mis_formas_de_pago` | Tarjetas guardadas |
| `/perfil/mis_compras` | Eventos comprados, boletos y QR |
| `/perfil/mis_amigos` | Amigos y solicitudes → [flujo 10](./10-transferencias-amigos.md) |
| `/perfil/mis_transferencias` | Bandeja de transferencias → [flujo 10](./10-transferencias-amigos.md) |

---

## 9.1 Mi Perfil

### `GET /usuarios/mi_perfil`

```jsonc
// Response
{ "id": 42, "fullName": "Juan Perez", "email": "usuario@dominio.com", "image": "https://cdn/..." }
```

`image` puede ser `null`.

### `PATCH /usuarios/update/perfil` — **dos payloads distintos, mismo endpoint**

**(a) Actualizar datos.** Se manda un **diff parcial**: una clave se incluye **solo si cambio**
respecto al perfil cargado. Si nada cambio, **no se hace la peticion**.

```jsonc
{ "nombre": "Juan Perez Lopez", "email": "nuevo@dominio.com" }
```

> **La clave es `nombre`, NO `fullName`** — a diferencia de la respuesta de `mi_perfil`.

**(b) Cambiar password** (desde el componente `CambiarPassword`):

```jsonc
{ "actualPassword": "Vieja123", "newPassword": "Nueva123" }
```

`newPasswordConfirm` se valida solo en cliente y **nunca se envia**.

En ambos casos la respuesta no se consume; al terminar se re-consulta `GET /usuarios/mi_perfil`.

### `PATCH /usuarios/update/profile-pic` (multipart)

- **Header:** `Content-Type: multipart/form-data`
- **Campo del FormData: `imagenPerfil`**
- **Restriccion de cliente:** solo `image/png` y `image/jpeg`
- **Response:** no se consume; se re-consulta `mi_perfil`

---

## 9.2 Mis compras

Al montar la pagina se disparan **tres llamadas independientes**:

```
GET /eventos/mis_eventos
GET /usuarios/mi_perfil
GET /wallet/is-active
```

### `GET /eventos/mis_eventos`

```jsonc
// Response — array
[
  {
    "id": 1084,
    "nombre": "Tuff Riders",
    "imagenPromocion": "https://cdn/...",
    "fecha": "2026-09-12T20:00:00.000Z",
    "cantidadBoletos": 3,
    "cantidadDinero": 2550.00,
    "recinto": { "nombre": "Auditorio X" },
    "ciudad":  { "nombre": "Torreon" },
    "funcionId": 77,
    "funcionNombre": "Matutino"
  }
]
```

### `GET /eventos/mis_eventos/{id}?funcionId={funcionId}`

`funcionId` se manda **solo cuando no es null**.

```jsonc
// Response
{
  "evento": {
    "id": 1084,
    "nombre": "Tuff Riders",
    "imagenPromocion": "https://cdn/...",
    "fecha": "2026-09-12T20:00:00.000Z",
    "recinto": { "nombre": "Auditorio X", "direccion": "Av. ..." },
    "ciudad": { "nombre": "Torreon" },
    "fechaCompra": "2026-08-01T10:22:00.000Z",
    "direccion": "Av. ...",
    "metodoPago": { "tipo": "visa", "ultimosDigitos": "1234" },
    "numeroPedido": "TQV-99120"
  },
  "boletos": [ /* BoletoVigente — asientos numerados */ ],
  "pasesGenerales": [ /* BoletoVigente — pases generales */ ],
  "transferidos": {
    "asientos": [ /* BoletoTransferido */ ],
    "pases":    [ /* BoletoTransferido */ ]
  }
}
```

### Shape de un boleto

```ts
interface BoletoCardData {
  id: number;
  funcion?: { id: number; fecha?: string; nombre?: string } | null;

  // La PRESENCIA de eventoSeccion es lo que distingue "pase general" de "asiento"
  eventoSeccion?: {
    precioEspecial?: string;
    seccion?: { nombre?: string; bloque?: { nombre?: string } };
  };
  asiento?: {
    numero?: string | number;
    fila?: { nombre?: string; seccion?: { nombre?: string; bloque?: { nombre?: string } } };
  };

  categoria?: { nombre?: string };
  precio?: string | number;
  quemadoFlag?: boolean;
  transferidoEn?: string;
  transferidoA?: { id: string; fullName: string; image?: string | null };

  dynamicQr?: QrSeed | null;
  qrEstatico?: boolean;
  qrBloqueado?: boolean;             // el backend niega el QR en web: solo app movil
  qrDisponibleDesde?: string | null; // ISO a partir del cual se libera en la app

  transferenciaPendiente?: TransferenciaPendienteInfo | null;
}
```

`BoletoVigente` = `BoletoCardData` + `quemadoUUID: string`, `quemadoFlag: boolean`,
`ticket?: { id?: number }`, `transferenciaPendiente`, `esCompradorOriginal?: boolean`.

`BoletoTransferido` = `BoletoCardData` + `transferido: true`, `transferidoEn: string`,
`transferidoA: { id, fullName, image }`.

> **Regla clave:** `eventoSeccion` presente ⇒ es un **pase general**; ausente ⇒ es un **asiento**.
> Ese mismo booleano se manda como `esGeneral` a wallet y como `tipo: 'pase' | 'asiento'`
> a transferencias.

---

## 9.3 Wallet

### `GET /wallet/is-active`

```jsonc
{ "google": true, "apple": false }
```

Controla el estado deshabilitado de cada boton de wallet.

### `GET /wallet/google-ticket?uuidBoleto={...}&esGeneral={...}`

- `uuidBoleto` = `boleto.quemadoUUID`
- `esGeneral` = `!!boleto.eventoSeccion`

```jsonc
{ "url": "https://pay.google.com/gp/v/save/..." }
```

Se abre con `window.open(data.url, '_blank')`.

### `GET /wallet/apple-ticket?uuidBoleto={...}&esGeneral={...}`

> **Este es el UNICO endpoint que NO pasa por axios.** Se hace
> `window.location.assign(baseURL + '/wallet/apple-ticket?...')`, asi que
> **no lleva `Authorization` ni `x-api-key`**.
>
> Debe ser accesible sin esos headers (o autenticarse por cookie) y responder el binario
> `.pkpass` con `Content-Type: application/vnd.apple.pkpass` como descarga.

---

## 9.4 QR dinamico

### `GET /dynamic-qr/seed?tipo={tipo}&boletoId={id}`

- `tipo`: `"asiento"` | `"pase"`
- `boletoId`: `number`

```jsonc
// Response — QrSeed
{
  "schemeVersion": "tqv1",
  "qrPublicId": "a1b2c3d4e5",
  "tipo": "asiento",
  "ownerId": "uuid-del-usuario",
  "eventoId": 1084,
  "funcionId": 77,
  "secret": "base64DeLaLlaveHMAC==",
  "version": 1,
  "timeStepSec": 30,
  "acceptedSkew": 1,
  "otpBytes": 8,
  "serverEpoch": 1787000000,
  "expiresAtEpoch": 1787086400
}
```

### Generacion del QR en el cliente

```js
// El reloj del dispositivo NUNCA se usa como referencia absoluta:
// serverEpoch se ancla al momento local de recepcion y solo se mide el tiempo transcurrido.
serverNow = seed.serverEpoch + (Date.now() - seed.fetchedAtLocalMs) / 1000;
ts        = Math.floor(serverNow / seed.timeStepSec);

msg  = `tqv1|${version}|${qrPublicId}|${ownerId}|${eventoId}|${ts}`;   // separador PIPE
mac  = HMAC_SHA256(base64ToBytes(seed.secret), utf8(msg));             // WebCrypto
otp  = base64url(mac.slice(0, seed.otpBytes));                         // + -> -, / -> _, sin =

qrText = `${schemeVersion}.${eventoId}.${qrPublicId}.${ts}.${otp}`;    // separador PUNTO
```

| Detalle | Valor |
|---|---|
| Cache | `sessionStorage`, clave `qr_seed_v2:{tipo}:{boletoId}` |
| Refresco anticipado | Si al seed le quedan menos de **30 min**, se re-pide en segundo plano |
| Recalculo | Cada **1 s** se recalcula `qrText` y `secondsLeft` |
| Expiracion | Cuando `serverNow >= expiresAtEpoch` → estado `expired` y re-fetch automatico |
| Estados | `idle` \| `loading` \| `ready` \| `expired` \| `error` |

### Cuando se usa QR dinamico vs estatico

```js
useDynamic = !quemado && !qrBloqueado && !boleto.qrEstatico
             && (boleto.dynamicQr || !boleto.quemadoUUID);
```

Payload del QR **estatico** (fallback):

```jsonc
{ "quemadoUUID": "b1f2c3d4-...", "general": true, "funcion": 77 }
```

`funcion` solo se incluye si el boleto trae `funcion`.

`qrBloqueado === true` significa que el backend no sirve el QR en web (solo app movil),
con `qrDisponibleDesde` como la fecha ISO de liberacion.

---

## 9.5 Mis formas de pago

Usa la capa compartida de [flujo 04](./04-pagos-openpay.md):

| Endpoint | Nota en esta pagina |
|---|---|
| `GET /pagos/get/mi_perfil` | Lista `idOpenpay` + `tarjetas[]` |
| `POST /pagos/save/tarjeta` | **Sin `device_session_id`** (solo carga el SDK base de OpenPay) |
| `DELETE /pagos/tarjeta/{idOpenpay}/{idtarjeta}` | Devuelve `{ message }` |

La respuesta de `save/tarjeta` **si se consume aqui**: se lee `data.tarjeta` para agregarla
al listado local.

---

## 9.6 `GET /boletos/mis` — implementado sin consumidores

Listado de boletos independiente del evento. **Ningun componente lo usa hoy.**

```ts
interface MisBoletosResponse {
  asientos: MiBoletoAsiento[];
  pases: MiBoletoPase[];
}

interface MiBoletoAsiento {
  id: number;
  estado: string;
  quemadoUUID: string;
  quemadoFlag: boolean;
  evento: { id: number; nombre?: string; imagenBoleto?: string; imagenPromocion?: string; fecha?: string } | null;
  funcion: { id: number; nombre?: string; fecha?: string } | null;
  asiento?: { numero?: string | number; fila?: { nombre?: string; seccion?: { nombre?: string; bloque?: { nombre?: string } } } };
  categoria?: { nombre?: string };
  ticket: { id: number };
  propietarioActual: { id: string } | null;
  transferenciaPendiente: TransferenciaPendienteInfo | null;
}

// MiBoletoPase es igual pero sin `estado`, `asiento` ni `categoria`.

interface TransferenciaPendienteInfo {
  id: number;
  createdAt: string;
  toUser: UserMini | null;
}
```
