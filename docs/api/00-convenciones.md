# Convenciones de la API

Todo el trafico al backend sale de **una sola instancia de axios**: `src/api/apiApplication.ts`.
No se usa `fetch` ni se crean instancias nuevas (unica excepcion: los documentos legales,
que se descargan por `fetch` desde una URL absoluta que entrega `/configuraciones/detail/1`).

## Base URL

```
baseURL = VITE_URL_BACKEND + "/api/v1"
```

Si `VITE_URL_BACKEND` no esta definida se usa `/api/v1` relativo (mismo origen).

## Headers inyectados automaticamente

| Header | Valor | Cuando |
|---|---|---|
| `x-api-key` | `VITE_API_KEY` | En **todas** las peticiones |
| `Authorization` | `Bearer <token>` | Si existe token en storage. **Se omite** en `/auth/refresh-token` |

`src/api/apiApplication.ts:36-47`

## Almacenamiento de sesion — `src/utils/authStorage.ts`

| Clave | Contenido | Donde vive |
|---|---|---|
| `token` | JWT de acceso | `localStorage` si "mantener sesion", si no `sessionStorage` |
| `resetToken` | refresh token | idem |
| `keepSession` | `"1"` cuando la sesion es persistente | siempre `localStorage` |

`set(key, value, persist)` escribe en un storage y **borra la clave del otro**, para que nunca
queden dos sesiones. `get` lee `localStorage ?? sessionStorage`.

## Refresh automatico de token

Interceptor de respuesta (`apiApplication.ts:49-94`):

```
401  →  no reintentado antes  →  la URL no esta en SKIP_REFRESH_URLS  →  existe resetToken
     →  POST /auth/refresh-token { resetToken }
     →  guarda data.token (y rota data.refreshToken si viene)
     →  reintenta la peticion original con el nuevo Bearer
     →  si falla: authStorage.clearAuth() + redirect duro a /auth/login
```

Las peticiones concurrentes comparten una sola promesa de refresh (`refreshInFlight`).

**`SKIP_REFRESH_URLS`** — un 401 aqui se propaga tal cual, nunca dispara refresh:

```
/auth/refresh-token   /auth/otp/send    /auth/otp/resend   /auth/otp/validate
/auth/login           /auth/register    /auth/google       /auth/apple/verify
```

## Formato de error esperado

El front lee siempre `error.response.data.message`. Acepta **string o array de strings**
(si es array los une con `\n` para el Sweetalert). Cualquier endpoint debe responder:

```jsonc
{
  "message": "Texto para el usuario",   // o ["error 1", "error 2"]
  "error": "Bad Request",               // opcional
  "statusCode": 400                     // opcional
}
```

### Caso especial: canal OTP no disponible

`useAuthStore` detecta "servicio no disponible" si el status es **503** o si
`` `${data.message} ${data.error} ${data.code}` `` en minusculas y sin `[\s_-]`
contiene `serviceunavailable`. En ese caso no se muestra alerta: se deshabilita
el boton de SMS y se pinta un aviso ambar en linea.

## Interceptores de Meta Ads

Ademas del token y el `x-api-key`, los interceptores hacen dos cosas mas:

- **Peticion:** en las rutas de reserva y de cargo se agrega un campo `meta` al body con el
  `event_id` y las cookies de atribucion de Meta.
- **Respuesta:** si el body trae `meta.emitir: true`, se dispara el evento de conversion que
  el backend indique.

Los detalles, las rutas exactas y el contrato completo estan en
[flujo 13 — Meta Ads](./13-meta-ads.md). Importa para cualquier endpoint de pago nuevo: si su
URL no cae en `RUTAS_ATRIBUCION_META`, la venta no se atribuye.

## Fechas

Todas las fechas que devuelve el backend se formatean con `formatDate` (`src/utils/dateHelpers.ts`),
que fuerza la zona horaria `VITE_TIMEZONE` (default `America/Mexico_City`). El backend debe
mandar ISO 8601. Nunca se usa la TZ del navegador.

## Pasarela de pago

OpenPay se carga dinamicamente por `<script>` desde `resources.openpay.mx`, con las credenciales
que entrega `GET /pagos/get/credenciales`. El `deviceSessionId` se genera en el cliente y viaja
en el body de los cargos.
