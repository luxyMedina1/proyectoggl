# QR dinámico (TOTP) — referencia frontend

Cómo el front genera el QR que rota cada 30s y cómo replicarlo. Implementa el contrato de
`taquillavipbackend-v2/docs/dynamic-qr/mobile-integration.md` adaptado a web.

Archivos:
- `src/utils/dynamicQr.ts` — tipos, cache, crypto y **cómputo del código** (el núcleo).
- `src/hooks/useDynamicQr.ts` — hook React que orquesta fetch + rotación + estados.
- `src/eventos/pages/perfil/components/BoletoDetalleModal.tsx` — render del QR.

---

## 0. Idea en una frase

El server emite un **seed** (un `secret` + metadatos). App y server calculan el **mismo**
HMAC-SHA256 sobre un mensaje que incluye una **ventana de tiempo** `ts` que cambia cada 30s.
El QR muestra `ts` + el OTP resultante; el validador recalcula con su propio reloj y compara.
Como el QR depende del tiempo, caduca solo → no sirve un screenshot viejo.

```
seed (secret, serverEpoch, ...)  ──►  cada segundo:  ts = hora_servidor / 30
                                                       otp = HMAC(secret, MSG(ts))
                                                       qrText = "tqv1.evento.publicId.ts.otp"
```

---

## 1. El seed — qué llega del backend

`GET /api/v1/dynamic-qr/seed?tipo=<asiento|pase>&boletoId=<id>` (con Bearer + x-api-key):

```ts
export interface QrSeed {
    schemeVersion: 'tqv1';   // literal, va dentro del QR
    qrPublicId: string;      // UUID OPACO para el QR (NO es el id interno del boleto)
    tipo: QrTipo;            // 'asiento' | 'pase'
    ownerId: string;         // UUID del dueño actual (entra en la firma)
    eventoId: number;
    funcionId: number | null;
    secret: string;          // base64, 32 bytes — la llave HMAC
    version: number;         // versión del secret (entra en la firma)
    timeStepSec: number;     // 30 → ancho de la ventana
    acceptedSkew: number;    // ± ventanas que el server tolera
    otpBytes: number;        // 10 → cuántos bytes del HMAC se usan
    serverEpoch: number;     // epoch (s) del server al emitir → el ANCLA de tiempo
    expiresAtEpoch: number;  // epoch (s) en que el seed deja de servir
}
```

Lo guardamos en cache añadiendo **el instante local exacto en que llegó**:

```ts
export interface CachedSeed extends QrSeed {
    fetchedAtLocalMs: number; // Date.now() al recibir el seed
}
```

`fetchedAtLocalMs` es la pieza clave del anclaje de reloj (sección 3).

---

## 2. El cómputo del código — `computeQr` (lo importante)

```ts
export const computeQr = async (seed: CachedSeed, nowMs: number = Date.now()): Promise<ComputedQr> => {
    const serverNow = serverNowSec(seed, nowMs);            // 1. hora del servidor, anclada
    const ts = Math.floor(serverNow / seed.timeStepSec);    // 2. ventana de tiempo (entero)

    const msg = `tqv1|${seed.version}|${seed.qrPublicId}|${seed.ownerId}|${seed.eventoId}|${ts}`; // 3
    const keyBytes = base64ToBytes(seed.secret);            // 4. secret base64 → 32 bytes
    const macBytes = await hmacSha256(keyBytes, utf8(msg)); // 5. HMAC-SHA256 → 32 bytes
    const otp = bytesToBase64Url(macBytes.slice(0, seed.otpBytes)); // 6. primeros N bytes → b64url

    const qrText = `${seed.schemeVersion}.${seed.eventoId}.${seed.qrPublicId}.${ts}.${otp}`; // 7
    const nextRotation = (ts + 1) * seed.timeStepSec;
    const secondsLeft = Math.max(0, Math.ceil(nextRotation - serverNow));   // 8. cuánto falta para rotar
    return { qrText, ts, secondsLeft };
};
```

Paso a paso:

### Paso 1 — `serverNow`: la hora correcta

```ts
export const serverNowSec = (seed: CachedSeed, nowMs: number = Date.now()): number => {
    const elapsedSec = (nowMs - seed.fetchedAtLocalMs) / 1000;
    return seed.serverEpoch + elapsedSec;
};
```

**Nunca usamos `Date.now()` crudo para el `ts`.** El reloj del dispositivo puede estar mal
puesto (manual, adelantado, atrasado). En vez de la hora *absoluta* del device, usamos:

```
serverNow = serverEpoch (hora del server al fetch) + tiempo transcurrido desde el fetch
```

`elapsed = (Date.now() - fetchedAtLocalMs)/1000` solo mide **cuánto tiempo pasó**, que es
confiable aunque la hora absoluta del device esté mal. Así el `ts` queda alineado con el del
server. Es algebraicamente igual a `Date.now()/1000 + (serverEpoch - fetchedAtLocalEpoch)`,
pero deja claro que el ancla es la hora del servidor.

> ⚠️ Por esto `serverEpoch` y `fetchedAtLocalMs` deben capturarse **en el mismo instante**
> (al hacer el `fetch`). Si usaras un `serverEpoch` viejo con un `fetchedAtLocalMs` tomado
> mucho después, el ancla se contamina y el server rechaza el QR con
> *"QR expirado fuera de ventana válida"*. (Bug que tuvimos: el seed embebido en
> `/eventos/mis_eventos` traía un `serverEpoch` viejo → 180s de desfase.)

### Paso 2 — `ts`: la ventana de tiempo

```ts
const ts = Math.floor(serverNow / timeStepSec); // p.ej. floor(1764273090 / 30) = 58809103
```

`ts` es un entero que **solo cambia cada `timeStepSec` (30s)**. Es el corazón del "TOTP":
durante 30s `ts` es constante → el OTP es constante → el QR no cambia; al cruzar el múltiplo
de 30, `ts` incrementa en 1 y todo se recalcula.

> Debe ser un entero ~5×10⁷ (epoch en **segundos** / 30). Si por error mandas `Date.now()`
> en **ms** (~1.7×10¹²) o un epoch con timezone, el delta es enorme → siempre fuera de ventana.

### Paso 3 — `MSG`: el mensaje firmado

```ts
const msg = `tqv1|${version}|${qrPublicId}|${ownerId}|${eventoId}|${ts}`;
```

Es exactamente la cadena que el server reconstruye para verificar. **El orden y los campos
deben coincidir byte a byte** con el backend. Incluye:
- `version` y `qrPublicId` → identifican el secret/boleto.
- `ownerId` → si el boleto se transfiere, cambia el dueño y la firma vieja deja de validar
  (fuerza reseed).
- `eventoId` → ata el QR a su evento.
- `ts` → la ventana de tiempo (lo que lo hace rotar).

### Paso 4 — `secret` base64 → bytes

```ts
export const base64ToBytes = (b64: string): Uint8Array => {
    const bin = atob(b64);                       // base64 → binary string
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;                                  // 32 bytes — la llave HMAC
};
```

El `secret` viene en base64; HMAC necesita los **bytes crudos** (32). No re-encodear ni
tratarlo como UTF-8.

### Paso 5 — HMAC-SHA256 (Web Crypto)

```ts
export const hmacSha256 = async (keyBytes: Uint8Array, msg: Uint8Array): Promise<Uint8Array> => {
    const key = await crypto.subtle.importKey(
        'raw', keyBytes as BufferSource,
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, msg as BufferSource);
    return new Uint8Array(sig);                  // 32 bytes
};
```

Usamos la **Web Crypto API nativa** del navegador (`crypto.subtle`) — sin librerías
externas. En mobile (Expo) la doc del backend sugiere `js-sha256` o `hash-wasm`; el algoritmo
es idéntico, solo cambia la librería.

### Paso 6 — truncar a `otpBytes` y base64url

```ts
const otp = bytesToBase64Url(macBytes.slice(0, otpBytes)); // primeros 10 bytes → ≈14 chars

export const bytesToBase64Url = (bytes: Uint8Array): string => {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin)
        .replace(/\+/g, '-')   // base64 → base64url
        .replace(/\//g, '_')
        .replace(/=+$/g, '');  // sin padding
};
```

No se usa el HMAC completo: solo los primeros `otpBytes` (10) bytes, codificados en
**base64url sin padding** (URL-safe, ~14 chars). Esto acorta el QR y es lo que el server
espera.

### Paso 7 — el texto del QR

```ts
const qrText = `${schemeVersion}.${eventoId}.${qrPublicId}.${ts}.${otp}`;
// "tqv1.123.3b853b29-c235-....ts.Oa9_xK2..."
```

Separado por puntos. El validador lo parsea, recalcula el OTP con su reloj y su copia del
secret, y compara dentro de `± acceptedSkew` ventanas.

### Paso 8 — `secondsLeft`: cuándo rota

```ts
const nextRotation = (ts + 1) * timeStepSec;            // inicio de la próxima ventana
const secondsLeft = Math.max(0, Math.ceil(nextRotation - serverNow));
```

Solo para la UI ("rota en Ns"). No entra en la firma.

---

## 3. El hook — `useDynamicQr`

Orquesta fetch del seed, cache, rotación cada segundo y estados de UI.

```ts
const { qrText, secondsLeft, status, error, refresh } = useDynamicQr({
    tipo,       // 'asiento' | 'pase'
    boletoId,   // EventoAsiento.id o PaseGeneral.id
    enabled,    // false para no arrancar (p. ej. boleto estático)
});
// status: 'idle' | 'loading' | 'ready' | 'expired' | 'error'
```

### Carga inicial del seed (con dedupe)

```ts
const doRefresh = async () => {
    if (inFlight.current) return inFlight.current;   // dedupe: un solo fetch en vuelo
    const p = (async () => {
        try {
            setStatus('loading');
            const cached = await fetchSeed(tipo, boletoId); // GET /dynamic-qr/seed + guarda cache
            setSeed(cached);
            setStatus('ready');
        } catch (e: any) {
            setError(e?.response?.data?.message ?? 'No se pudo obtener el QR');
            setStatus('error');
        } finally {
            inFlight.current = null;
        }
    })();
    inFlight.current = p;
    return p;
};

useEffect(() => {
    if (!enabled) return;
    const cached = loadSeed(tipo, boletoId);             // ¿hay cache válido?
    if (cached) {
        setSeed(cached);
        setStatus('ready');
        const remaining = cached.expiresAtEpoch - serverNowSec(cached);
        if (remaining < REFRESH_THRESHOLD_SEC) doRefresh(); // < 30 min → refresca en bg
        return;
    }
    doRefresh();                                          // sin cache → fetch
}, [tipo, boletoId, enabled]);
```

### Rotación cada segundo

```ts
useEffect(() => {
    if (!seed) return;
    let cancelled = false;
    const tick = async () => {
        const nowMs = Date.now();
        if (serverNowSec(seed, nowMs) >= seed.expiresAtEpoch) { // seed vencido
            setStatus('expired');
            setQrText(null);
            doRefresh();                                   // reseed online
            return;
        }
        const { qrText: text, secondsLeft: left } = await computeQr(seed, nowMs);
        if (cancelled) return;
        setQrText(text);
        setSecondsLeft(left);
    };
    tick();
    const id = setInterval(tick, 1000);  // cada 1s, NO cada 30s
    return () => { cancelled = true; clearInterval(id); };
}, [seed]);
```

> Recomputar cada **1s** (no cada `timeStepSec`) evita que, si el ms-clock está apenas
> desfasado, el usuario vea el QR un instante vencido entre frames. Recalcular cada segundo
> es barato y el `ts` solo cambia visualmente al cruzar la frontera de 30s.

---

## 4. Cache en `sessionStorage`

```ts
const STORAGE_PREFIX = 'qr_seed_v2:';                 // _v2 orfana entradas viejas
const storageKey = (tipo, boletoId) => `${STORAGE_PREFIX}${tipo}:${boletoId}`;

saveSeed(tipo, boletoId, seed)  // añade fetchedAtLocalMs = Date.now() y guarda
loadSeed(tipo, boletoId)        // lee CachedSeed | null
clearSeed(tipo, boletoId)       // borra una entrada
clearAllSeeds()                 // borra todas (v1 + v2) — se llama en logout
```

- Clave por **`boletoId` interno**, no por `qrPublicId` (este rota cuando rota el secret y
  dejaría entradas huérfanas).
- El cache es seguro de reusar: el offset (serverEpoch ↔ fetchedAtLocalMs) es invariante en
  el tiempo, así que un seed cacheado sigue calculando bien horas después.
- En web no hay SecureStore; vive en `sessionStorage` y muere al cerrar la pestaña. La doc
  del backend dice explícitamente: en web **no** se permite QR offline.

---

## 5. Render — `BoletoDetalleModal`

```ts
const tipo = esPaseGeneral ? 'pase' : 'asiento';
const useDynamic = !boleto.qrEstatico && (boleto.dynamicQr || !boleto.quemadoUUID);
const dyn = useDynamicQr({ tipo, boletoId: boleto.id, enabled: !!useDynamic });

const qrValue = useDynamic ? dyn.qrText : staticPayload;
```

Regla de decisión (la dicta el backend en `/eventos/mis_eventos/:id`):
- `qrEstatico === true` → QR plano con `quemadoUUID` (cortesía / punto de venta / ya quemado).
- si no → QR dinámico vía el hook, con contador "rota en {dyn.secondsLeft}s".

```tsx
{qrValue ? (
    <QRCodeCanvas value={qrValue} size={180} />
) : (
    /* estados: loading 'Generando QR…' · expired 'Renovando QR…' · error dyn.error */
)}
```

---

## 6. Replicar en otra pantalla (receta)

```tsx
import { useDynamicQr } from '../../hooks/useDynamicQr';
import { QRCodeCanvas } from 'qrcode.react';

function MiQR({ boletoId, esGeneral }: { boletoId: number; esGeneral: boolean }) {
    const { qrText, secondsLeft, status } = useDynamicQr({
        tipo: esGeneral ? 'pase' : 'asiento',
        boletoId,
    });

    if (status === 'loading') return <span>Generando QR…</span>;
    if (status === 'error')   return <span>Error al cargar el QR</span>;
    if (!qrText)              return <span>Renovando…</span>;

    return (
        <div>
            <QRCodeCanvas value={qrText} size={200} />
            <p>Rota en {secondsLeft}s</p>
        </div>
    );
}
```

Eso es todo: el hook se encarga de fetch, cache, anclaje de reloj y rotación.

---

## 7. Checklist de diagnóstico

Si el validador rechaza el QR:

| Síntoma (log del backend) | Causa probable | Revisar |
|---|---|---|
| `delta` constante de N ventanas (p. ej. 6 = 180s) | ancla contaminada / cache viejo | que `serverEpoch` y `fetchedAtLocalMs` se tomen juntos; subir `STORAGE_PREFIX`; recargar |
| `delta` grande y errático | usaste `Date.now()` en ms para `ts` | `ts = floor(serverNowSec/timeStepSec)`, en segundos |
| `Firma del QR inválida` | `MSG` mal armado o `secret` mal decodificado | orden/campos del `MSG`; `base64ToBytes` (no UTF-8) |
| `Dueño del boleto cambió` | hubo transferencia | `clearSeed` + `refresh()` |
| `Seed del QR expirado` | seed venció | refetch (el hook ya lo hace solo) |

El `ts` del front debe igualar el `currentStep` del server (±`acceptedSkew`). Si con un fetch
**limpio** (verifica en Network que llame `GET /dynamic-qr/seed` y no cache) sigue habiendo
desfase fijo, el problema es el reloj del **servidor** (NTP), porque el front ya ancla a
`serverEpoch`.
