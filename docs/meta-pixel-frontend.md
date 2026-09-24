# Meta Pixel + Conversions API — referencia frontend

Cómo el front reporta a Meta con **varios pixels a la vez** y cómo se coordina con la
Conversions API del backend para que cada venta se cuente **una sola vez**.

Archivos:
- `src/utils/metaPixel.ts` — capa base sin React: carga del snippet, registro de pixels,
  `trackSingle`, cookies de atribución. **El núcleo.**
- `src/hooks/useMetaPixel.ts` — hook-as-service: `useMetaPixel()` y `usePixelsDeEvento()`.
- `src/api/apiApplication.ts` — interceptores: inyecta la atribución al salir, dispara los
  eventos de conversión al volver.
- `src/context/ColorContext.tsx` — activa los pixels de la marca al bootear.

Contrato de la API: [`docs/api/13-meta-ads.md`](./api/13-meta-ads.md).
Version movil: [`docs/meta-pixel-mobile-expo.md`](./meta-pixel-mobile-expo.md).

---

## 0. Las dos ideas en una frase cada una

**Multi-pixel.** En una misma pantalla conviven los pixels de la marca (todo el sitio) y los
del promotor del evento que se está viendo. Por eso **nunca** se llama `fbq('track', ...)`:
esa forma le manda el evento a *todos* los pixels inicializados, y el promotor del evento A
terminaría viendo las ventas del evento B. Todo sale por `fbq('trackSingle', pixelId, ...)`.

**Deduplicación.** Cada conversión se le manda a Meta dos veces — una del navegador (Pixel) y
otra del servidor (CAPI) — con el **mismo `event_id`**. Meta las une. El Pixel solo se lo
bloquea el adblocker; CAPI no se lo bloquea nadie. Juntos cubren lo que ninguno cubre solo.

```
navegador ──Pixel──►  Meta
                       │ mismo event_id → 1 conversión
servidor  ──CAPI───►  Meta
```

---

## 1. De dónde salen los pixels

Hay dos orígenes y se **suman**:

| Origen | Endpoint | Vive | Se activa en |
|---|---|---|---|
| **Marca** | `GET /configuraciones/detail/1` → `metaPixels` | toda la sesión | `ColorContext.tsx` |
| **Evento** | `GET /eventos/:id/detalle` → `metaPixels` | mientras la página esté montada | `usePixelsDeEvento()` |

Los del evento se **reemplazan** en cada navegación. Es lo que impide que al pasar del evento
A al B le sigamos reportando al promotor de A. `usePixelsDeEvento` lo hace con el cleanup del
`useEffect`, así que no hay que acordarse de limpiarlos a mano.

`normalizarPixelIds` acepta `["123456"]` o `[{ pixelId: "123456" }]` y descarta lo que no sea
un ID numérico válido — un pixel mal capturado en el admin no rompe la página.

**Si no hay pixels configurados, el snippet de `fbevents.js` ni siquiera se descarga.** No se
paga el costo de red por nada.

---

## 2. Quién dispara qué

Este es el reparto que hay que tener claro:

| Evento | Lo dispara | Dónde |
|---|---|---|
| `PageView` | front | `App.tsx`, en cada cambio de `pathname` (es SPA) |
| `ViewContent` | front | `detalleEventoPage.tsx`, al cargar el evento |
| `AddToCart` | front | `SeccionAsientoPage.tsx`, al seleccionar un asiento |
| `InitiateCheckout` | **backend** | respuesta de los `/reservar*` |
| `Purchase` | **backend** | respuesta de los `/pagos/check/cargo*` |
| `CompleteRegistration` | **backend** | respuesta de los flujos gratuitos |

### Por qué las conversiones las dicta el backend

Los eventos de intención (arriba) nacen en el navegador y no tienen valor monetario, así que
el front los puede disparar solo. Los de conversión no:

1. **El monto tiene que coincidir.** Si el front calcula el `value` por su cuenta y el back
   calcula el suyo para CAPI, tarde o temprano difieren (promociones, cargos por servicio,
   redondeos) y Meta reporta dos valores distintos para la misma venta.
2. **El front no sabe si de verdad se pagó.** Con 3D Secure el usuario vuelve del banco a la
   página de confirmación sin más contexto que un `transaccionId` en el query string. Quien
   sabe si el cargo quedó pagado es el backend.
3. **Un solo lugar decide.** Si mañana cambia qué evento se manda por un boleto gratis, se
   cambia en el back y el front no se entera.

---

## 3. El viaje de ida — atribución (request interceptor)

`apiApplication.ts` le agrega un campo `meta` al body de las peticiones que lo necesitan:

```jsonc
{
  "...": "el payload normal",
  "meta": {
    "eventId": "9f8e7d6c-...",       // UUID v4, generado aquí
    "fbp": "fb.1.1735689600.12345",  // cookie _fbp (la crea el pixel)
    "fbc": "fb.1.1735689600.IwAR..", // cookie _fbc (solo si llegó con ?fbclid=)
    "eventSourceUrl": "https://marca.com/eventos/tuff-riders"
  }
}
```

Rutas afectadas (`RUTAS_ATRIBUCION_META`):

- `/eventos/:id/reservar`, `/reservar_generales`, `/reservarInvitado`, `/abonos/:id/reservar`
- `/pagos/make/*` y `/pagos/check/*` — incluye abono, conferencia y citypass
- `/eventos/:id/gratis`

Va en el interceptor y no en cada componente **a propósito**: eventos, abonos, conferencias y
citypass pasan todos por la misma instancia de axios, así que ningún flujo se queda fuera ni
hay que acordarse de agregarlo al escribir uno nuevo. Los `FormData` se dejan intactos.

> ⚠️ **El backend tiene que aceptar `meta` antes de que esto salga a producción.** Si su
> `ValidationPipe` corre con `forbidNonWhitelisted: true`, un campo desconocido devuelve 400
> y **tumba el pago**. Es la única dependencia dura de orden de despliegue.

---

## 4. El viaje de vuelta — conversiones (response interceptor)

El backend responde con el mismo objeto `meta`, ahora diciéndole al front qué disparar:

```jsonc
{
  "...": "la respuesta normal",
  "meta": {
    "emitir": true,                       // sin esto no se dispara nada
    "evento": "Purchase",
    "eventId": "9f8e7d6c-...",            // EL MISMO que se mandó al make/cargo
    "pixelIds": ["111111111", "222222222"],
    "datos": { "currency": "MXN", "value": 1234.50, "content_ids": ["evento-123"] }
  }
}
```

`emitir: false` (o ausente) = no se dispara nada: o el cargo no quedó pagado, o ya se había
contado antes. **Nunca hay que interpretar el resto de la respuesta para decidir.**

El `eventId` es el que el front generó al iniciar el cargo, que el backend guardó en la
reserva. Es lo que hace que la fila del navegador y la del servidor colapsen en una sola
conversión en el Events Manager.

### La ruta larga: 3D Secure

```
1. usuario paga
   └─ POST /pagos/make/cargo  { ..., meta: { eventId: "abc", fbp, fbc } }
        └─ el back guarda "abc" en la reserva

2. redirect al banco  →  el usuario sale del sitio
                          (se pierde todo el estado en memoria del front)

3. vuelve a /terminar_compra/:reservaId/:esGeneral/:promocionId?id=<transaccionId>
   └─ POST /pagos/check/cargo/:transaccionId
        └─ el back cobra, manda el Purchase por CAPI con eventId "abc",
           y responde  meta: { emitir: true, evento: "Purchase", eventId: "abc", ... }
              └─ el interceptor dispara trackSingle con eventID "abc"  →  DEDUPLICADO ✅
```

Si el front generara un `event_id` nuevo en el paso 3, Meta contaría la compra **dos veces**.
Todo el diseño existe para evitar exactamente eso.

### Guardas contra duplicado

Tres capas, porque la página de confirmación es especialmente propensa a repetirse (el usuario
refresca, React remonta en `StrictMode`, hay reintentos):

1. `yaSeEmitio()` — `sessionStorage`, evita el disparo repetido del lado navegador.
2. El backend marca la reserva como ya reportada y no vuelve a mandar el evento por CAPI.
3. El `event_id` compartido — la red de seguridad final, del lado de Meta.

Es `sessionStorage` y no `localStorage` a propósito: si el usuario abre otra pestaña y compra
otra vez, eso **sí** es una conversión distinta.

---

## 5. Agregar un evento nuevo

**Si nace en el navegador** (intención, sin dinero): agrégalo a `useMetaPixel.ts` y llámalo
desde el componente. Nada más.

**Si es una conversión** (tiene `value`): no toques el front. Que el backend lo devuelva en
`meta` de la respuesta y el interceptor lo dispara solo. Si el nombre no es un evento estándar
de Meta, `metaPixel.ts` lo manda como `trackSingleCustom` automáticamente.

**Si es un endpoint de pago nuevo**: verifica que su URL caiga en `RUTAS_ATRIBUCION_META`. Los
patrones son regex y cubren los prefijos actuales, pero una ruta con otra forma se quedaría
sin `eventId` — y sin `eventId` no hay deduplicación.

---

## 6. Cómo se prueba

1. **Meta Pixel Helper** (extensión de Chrome) — debe listar *todos* los pixels activos en la
   página del evento: los de la marca **y** el del promotor.
2. **Events Manager → Test Events**, con el `metaTestEventCode` puesto en la config del back.
   Haz una compra completa: el `Purchase` debe salir con las dos fuentes — "Navegador" y
   "Servidor" — **colapsadas como un solo evento**. Si aparecen dos eventos separados, el
   `eventId` no está viajando: revisa la §4.
3. **Match Quality** del `Purchase`: arriba de 6/10. Si sale bajo, casi siempre falta el
   teléfono o el `_fbc`.
4. **Sin pixels configurados**: `fbevents.js` no debe aparecer en la pestaña Network.
5. **Con adblocker prendido**: la compra debe seguir llegando a Meta (por CAPI, con una sola
   fuente en vez de dos). Ese es justamente el caso que CAPI existe para cubrir.

---

## 7. Lo que este front NO hace

- **No manda el token de la Conversions API.** Todo lo que es `VITE_*` termina en el bundle
  público. El token vive solo en el backend, y `/configuraciones/detail/1` — que es un
  endpoint público — no debe devolverlo nunca.
- **No hashea datos personales.** El `user_data` (email, teléfono, nombre) lo arma y lo hashea
  el backend, que ya tiene esos datos sin pasar por el navegador.
- **No decide el `value` de una conversión.** Ver §2.
