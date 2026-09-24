# Auth OTP · Refresh Token · QR dinámico — referencia frontend

Guía de los hooks y utilidades agregados para login por OTP, sesión persistente con
refresh token, selector de país y QR dinámico (TOTP). Sirve para replicar o extender el
flujo sin volver a leer todo el código.

Todos los endpoints viven bajo `VITE_URL_BACKEND + /api/v1`. La instancia única
`src/api/apiApplication.ts` inyecta `x-api-key` y `Authorization: Bearer` automáticamente.

---

## 1. Almacenamiento de sesión — `src/utils/authStorage.ts`

Abstrae `localStorage` vs `sessionStorage` según el flag "mantener sesión":

```ts
authStorage.set(key, value, persist) // persist=true → localStorage; false → sessionStorage
authStorage.get(key)                 // lee de donde exista (local primero)
authStorage.remove(key)              // borra de ambos
authStorage.clearAuth()              // borra token + resetToken + keepSession
authStorage.isPersistent()           // true si keepSession==='1' en localStorage
```

Keys manejadas: `'token'` (JWT 8h), `'resetToken'` (refresh 50h), `'keepSession'` (`'1'`).

- `persist=true` → escribe en `localStorage` (sobrevive cierre de pestaña).
- `persist=false` → escribe en `sessionStorage` (muere al cerrar pestaña).
- `apiApplication` lee el token siempre vía `authStorage.get('token')`.

---

## 2. Interceptores axios — `src/api/apiApplication.ts`

### Request
- Agrega `Authorization: Bearer <token>` salvo en `/auth/refresh-token` (ese va sin Bearer
  a propósito; el JWT puede estar vencido).
- Agrega `x-api-key` de `VITE_API_KEY`.

### Response (refresh reactivo)
Al recibir `401`:
1. Si la URL está en `SKIP_REFRESH_URLS` (endpoints de entrada: otp/*, login, register,
   google, apple, refresh-token) → no intenta refrescar, propaga el error.
2. Si no hay `resetToken` en storage → propaga el error.
3. Llama `performRefresh()` → `POST /auth/refresh-token { resetToken }`, guarda el nuevo
   `token` + `refreshToken` rotado (manteniendo el flag `keepSession`).
4. Reintenta la request original **una vez** con el JWT nuevo.
5. Si el refresh falla → `authStorage.clearAuth()` + redirige a `/auth/login`.

`refreshInFlight` deduplica: si varias requests fallan con 401 a la vez, solo se dispara un
refresh y las demás esperan el mismo Promise. `original._retry` evita bucles infinitos.

> `/auth/check-status` **no** está en la skip list a propósito: un 401 ahí dispara refresh.

---

## 3. Hook de auth — `src/hooks/useAuthStore.tsx`

"Hook-as-service": componentes nunca llaman axios directo. Métodos nuevos:

| Método | Firma | Qué hace |
|---|---|---|
| `startSendOtp` | `(telefono, canal?='whatsapp') → Promise<OtpSendResult>` | `POST /auth/otp/send`. `{ ok, serviceUnavailable }`. `serviceUnavailable=true` cuando el canal no está disponible (503 o mensaje `serviceunavailable`); en ese caso **no** dispara Swal, lo maneja la UI. |
| `startResendOtp` | `(telefono, canal?='whatsapp') → Promise<OtpSendResult>` | `POST /auth/otp/resend`. Mismo contrato que `startSendOtp`. |
| `startValidateOtp` | `(telefono, codigo, mantenerSesion) → Promise<OtpAuthResponse \| null>` | `POST /auth/otp/validate`. Persiste tokens, despacha `onLogin` (con `perfilCompleto` inyectado en `user`), pide resetToken si el perfil ya está completo. |
| `completarPerfilOTP` | `(email, fullName) → Promise<OtpAuthResponse \| null>` | `PATCH /auth/otp/update` (con Bearer). Reemplaza el token, despacha `onLogin`, pide resetToken. |
| `requestResetToken` | `() → Promise<void>` | `GET /auth/get-reset-token`, guarda `resetToken`. No fatal si falla. |

`startLogin`, `startRegister`, `loginWithGoogle`, `loginWithApple` ahora también llaman
`requestResetToken()` al final para dejar listo el refresh.

`telefono` debe ir en **E.164**: `+<dialCode><digits>` (`+525512345678`). Normalizar en
cliente, el backend compara por igualdad estricta.

### `OtpAuthResponse`
```ts
{ user: any; perfilCompleto: boolean; isVerified: boolean; token: string; refreshToken: string | null }
```

### Distinguir registro vs login
`startValidateOtp` devuelve `perfilCompleto`:
- `true` → login normal, ir a `/eventos`.
- `false` → registro nuevo, ir a `/auth/completar_perfil` (forzado).

---

## 4. Guardia de perfil incompleto

- `UserAuthDTO` tiene `perfilCompleto?` y `telefono?`.
- `App.tsx`: si `status==='authenticated' && user.perfilCompleto===false` y la ruta no es
  `/auth/completar_perfil` → `<Navigate replace>` ahí. Cubre todas las rutas.
- `CompletarPerfilPage` (`/auth/completar_perfil`, fuera de `AuthLayout` para no chocar con
  su redirect): pide email + fullName, llama `completarPerfilOTP`, redirige a `/eventos`.
  Si `status==='checking'` corre `checkAuthToken` (la página no está bajo HeaderLayout).

---

## 5. Login OTP — `src/auth/pages/LoginPage.tsx`

Máquina de estados `step: 'phone' | 'otp'`:

- **phone**: `CountryCodeSelect` + input teléfono (formato visual `123-123-1234`, solo
  dígitos internamente) + checkbox "Mantener sesión" + **dos botones de envío**:
  "Continuar con WhatsApp" y "Continuar con SMS", ambos → `handleSendOtp(canal)` →
  `startSendOtp(telefonoE164, canal)`. El canal elegido se guarda en `channelUsed` para el
  reenvío.
- **otp**: 6 inputs (`CODE_LENGTH=6`) con auto-advance, backspace, flechas, paste; contador
  de reenvío 30s (`RESEND_SECONDS`); botón "Verificar" → `startValidateOtp`; "Cambiar
  número" vuelve a phone. El reenvío usa `channelUsed`.

`telefonoE164 = +${country.dialCode}${onlyDigits(phone)}`.

**Fallback de canal**: si `startSendOtp`/`startResendOtp` devuelven
`serviceUnavailable=true` (backend responde `serviceunavailable`/503 para SMS) → se oculta
el botón SMS (`smsEnabled=false`), se muestra aviso y solo queda WhatsApp. En reenvío, si el
canal SMS deja de estar disponible se reintenta automáticamente por WhatsApp.

---

## 6. Códigos de país — `src/data/countryCodes.ts` + `CountryCodeSelect.tsx`

- `COUNTRY_CODES: { name, iso2, dialCode }[]` — ~240 países en español.
- `DEFAULT_COUNTRY` = México (MX, +52).
- `isoToFlagEmoji(iso2)` — convierte ISO-2 a emoji bandera (regional indicators).
- `CountryCodeSelect` — dropdown buscable. La búsqueda **normaliza** (NFD + strip
  diacríticos + strip no-alfanuméricos + lowercase) así "mexico", "México", "me-xico"
  matchean igual. También busca por dial code e ISO.

---

## 7. QR dinámico (TOTP)

Implementa el contrato de `docs/dynamic-qr/mobile-integration.md` del backend, adaptado a
web (sin SecureStore; cache en `sessionStorage`, sin modo offline).

### 7.1 `src/utils/dynamicQr.ts`

```ts
type QrTipo = 'asiento' | 'pase';

interface QrSeed {            // lo que devuelve GET /dynamic-qr/seed
  schemeVersion: 'tqv1'; qrPublicId; tipo; ownerId; eventoId; funcionId;
  secret /*base64 32B*/; version; timeStepSec /*30*/; acceptedSkew; otpBytes /*10*/;
  serverEpoch /*s*/; expiresAtEpoch /*s*/;
}
interface CachedSeed extends QrSeed { fetchedAtLocalMs: number } // ancla local exacta
```

Funciones:

| Función | Qué hace |
|---|---|
| `fetchSeed(tipo, boletoId)` | `GET /dynamic-qr/seed?tipo&boletoId`, guarda y devuelve `CachedSeed`. |
| `saveSeed / loadSeed / clearSeed` | Cache en `sessionStorage`, key `qr_seed_v2:<tipo>:<boletoId>`. |
| `clearAllSeeds()` | Borra todos los seeds (v1 y v2). Llamado en `logout`. |
| `serverNowSec(seed, nowMs?)` | **Hora anclada al servidor** = `serverEpoch + (now - fetchedAtLocalMs)/1000`. |
| `computeQr(seed, nowMs?)` | Devuelve `{ qrText, ts, secondsLeft }`. |
| `base64ToBytes / bytesToBase64Url / hmacSha256` | Crypto helpers (Web Crypto `crypto.subtle`). |

**Algoritmo del OTP** (idéntico al server):
```
serverNow = serverEpoch + (Date.now() - fetchedAtLocalMs)/1000   // NUNCA Date.now() crudo
ts        = Math.floor(serverNow / timeStepSec)
MSG       = `tqv1|${version}|${qrPublicId}|${ownerId}|${eventoId}|${ts}`
mac       = HMAC_SHA256(base64Decode(secret), utf8(MSG))          // 32 bytes
otp       = base64UrlEncode(mac.slice(0, otpBytes))               // ≈14 chars sin padding
qrText    = `${schemeVersion}.${eventoId}.${qrPublicId}.${ts}.${otp}`
```

> ⚠️ El ancla es `serverEpoch + elapsed`, no `Date.now()` crudo. Solo depende de medir
> *tiempo transcurrido*, no de la hora absoluta del dispositivo. `serverEpoch` y
> `fetchedAtLocalMs` se capturan **juntos** en cada `fetchSeed` — por eso NO se debe usar el
> `dynamicQr` embebido en `/eventos/mis_eventos` para el ancla (su `serverEpoch` es viejo y
> contaminaría el offset → "QR fuera de ventana"). El prefijo de cache es `_v2` justamente
> para orfanar entradas viejas con ancla contaminada.

### 7.2 `src/hooks/useDynamicQr.ts`

```ts
const { qrText, secondsLeft, status, error, refresh } = useDynamicQr({
  tipo, boletoId, enabled
});
// status: 'idle' | 'loading' | 'ready' | 'expired' | 'error'
```

- Al montar: usa cache si existe (su ancla es válida); si queda <30 min de vida refresca en
  background. Si no hay cache → `fetchSeed`. Dedupe con `inFlight` ref.
- `setInterval(1000ms)` recalcula `qrText` y `secondsLeft`; al cruzar la frontera de step el
  QR cambia solo. Recomputar a 1s (no a `timeStepSec`) evita ver el QR vencido entre frames.
- Si `serverNowSec >= expiresAtEpoch` → `status='expired'` + auto-`refresh`.

### 7.3 Render — `BoletoDetalleModal.tsx`

```ts
const useDynamic = !boleto.qrEstatico && (boleto.dynamicQr || !boleto.quemadoUUID);
const dyn = useDynamicQr({ tipo, boletoId: boleto.id, enabled: !!useDynamic });
```

- `qrEstatico === true` → QR plano con `quemadoUUID` (cortesía / PDV / ya quemado).
- dinámico → `<QRCodeCanvas value={dyn.qrText} />` + contador "rota en Ns".

`BoletoCardData` (en `BoletoCard.tsx`) lleva los campos extra del backend:
`dynamicQr?: QrSeed | null` y `qrEstatico?: boolean`.

---

## 8. Cuándo refrescar el QR (pendiente para producción)

El backend recomienda invalidar/refrescar el seed ante estos disparadores. Hoy solo está el
auto-refresh por expiración; faltan los listeners de push:

| Disparador | Acción | Helper |
|---|---|---|
| Pantalla abre con red | refetch si vida < 30 min | ya implementado en el hook |
| Transferencia recibida (push) | `clearSeed` + `refresh()` del boleto | `clearSeed(tipo, id)` |
| Transferencia enviada (push) | borrar cache del boleto enviado | `clearSeed(tipo, id)` |
| Boleto quemado (push) | borrar cache + marcar "Usado" | `clearSeed(tipo, id)` |
| Error 401/403 al render | `refresh()`; si vuelve a fallar → "Pide ayuda en taquilla" | `dyn.refresh()` |
| Logout | borrar todos | `clearAllSeeds()` (ya en `startLogout`) |

---

## 9. Endpoints consumidos (resumen)

| Método | Endpoint | Auth | Quién lo llama |
|---|---|---|---|
| POST | `/auth/otp/send` | x-api-key | `startSendOtp` |
| POST | `/auth/otp/resend` | x-api-key | `startResendOtp` |
| POST | `/auth/otp/validate` | x-api-key | `startValidateOtp` |
| PATCH | `/auth/otp/update` | + Bearer | `completarPerfilOTP` |
| GET | `/auth/get-reset-token` | + Bearer | `requestResetToken` |
| POST | `/auth/refresh-token` | x-api-key (sin Bearer) | interceptor response |
| GET | `/auth/check-status` | + Bearer | `checkAuthToken` |
| GET | `/dynamic-qr/seed?tipo&boletoId` | + Bearer | `fetchSeed` / `useDynamicQr` |
| GET | `/eventos/mis_eventos/:id` | + Bearer | `MisComprasPage` (trae `dynamicQr`/`qrEstatico`) |
