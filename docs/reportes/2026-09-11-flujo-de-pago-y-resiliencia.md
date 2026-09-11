# Reporte — No perder el flujo de pago al registrar cliente OpenPay, boundary de errores y cabeceras de seguridad

**Fecha:** 2026-09-11
**Proyecto:** frontend v3 (Next 16.3.4 App Router)
**Rama:** `migracion-v2-v3`
**Repo:** `github.com/luxyMedina1/proyectoggl` (`proyectoggl`)
**Base:** `2b31a4a` (punta del [reporte anterior de hoy](2026-09-11-perfil-formas-de-pago.md))

**Estado del build:**

- `npm run build` → ✅ 26 páginas, TypeScript limpio
- `npx vitest run --pool=threads --no-file-parallelism` → ✅ **136/136** en 18 archivos
- Cabeceras de seguridad nuevas verificadas en vivo con `curl` contra un `next start`

---

## 1. Resumen ejecutivo

| Tarea | Descripción | Estado |
|---|---|---|
| **No perder el flujo de pago** | 4 flujos de checkout registraban el cliente de OpenPay a ciegas: cualquier error (no solo "no registrado") disparaba un intento de alta, y si ese intento también fallaba no había control — la excepción escapaba con la reserva **ya hecha**, dejando al usuario con el lugar bloqueado y sin forma de pagar. | ✅ |
| **Boundary de errores** | La app no tenía `error.tsx` ni `global-error.tsx` — un error sin capturar en cualquier página mostraba la pantalla cruda de Next. | ✅ |
| **HSTS + COOP** | Cabeceras de seguridad que faltaban (señaladas por PageSpeed Insights). | ✅ |

---

## 2. No perder el flujo de pago (el pedido del día: *"que no se pierda el flujo"*)

### El bug, verificado en los 4 archivos

Mismo patrón copiado en `EventoDetalleView.tsx`, `eventos/[slug]/[seccionId]/[seccion]/page.tsx`,
`abonos/[slug]/[seccionId]/[seccion]/page.tsx` y `formConferenciaPage.tsx` — los 4 puntos donde el
front intenta preparar el pago justo **después** de reservar el asiento/lugar con éxito:

```js
try {
  const has_user = await apiApplication.get("/pagos/get/mi_perfil");
  setOpenId(has_user.data.idOpenpay);
  // ...
} catch (error) {
  const resp = await apiApplication.post("/pagos/save/usuario"); // sin try/catch propio
  setOpenId(resp.data.idOpenpay);
}
```

Dos problemas:

1. **Cualquier error** de `GET /pagos/get/mi_perfil` (red, timeout, 500 del backend — no solo el 404
   de "usuario sin cliente OpenPay") disparaba el intento de alta de cliente.
2. El `POST /pagos/save/usuario` de respaldo **no tenía su propio manejo de error**. Si también
   fallaba, la excepción escapaba sin control. Como la reserva del asiento/lugar **ya se había hecho
   con éxito unas líneas antes**, el resultado era: reserva bloqueada, `openId` nunca se estableció,
   el paso de pago quedaba roto, y el mensaje que veía el usuario era el genérico de "error al
   reservar" — engañoso, porque la reserva sí funcionó. Eso es "perder el flujo": no había manera de
   reintentar sin perder el lugar.

### El fix (mismo patrón en los 4 archivos)

- Solo se intenta dar de alta al cliente cuando el error es **404 de verdad** (`statusDeErrorApi(error) === 404`,
  el helper de `utils/apiError.ts`). Cualquier otro status solo se loguea.
- El `POST` de alta ahora tiene su propio `try/catch`: si falla, se avisa con un mensaje preciso y
  **la reserva sigue en pie** —*"Tu [asiento/reserva] ya está [reservado/hecha], pero no pudimos
  preparar tu método de pago. Intenta de nuevo en unos segundos."*— en vez del genérico que sugería
  que la reserva había fallado.
- De paso se limpiaron dos `console.log` de depuración (`console.log(has_user)`,
  `console.log("No tiene open id crearlo...")`) que quedaron en dos de los archivos.

### Archivos

| Archivo | Contexto |
|---|---|
| `app/(site)/eventos/[slug]/EventoDetalleView.tsx` | Checkout de evento (entrada general) |
| `app/(site)/eventos/[slug]/[seccionId]/[seccion]/page.tsx` | Checkout de evento por-asientos |
| `app/(site)/abonos/[slug]/[seccionId]/[seccion]/page.tsx` | Checkout de abono por-asientos |
| `eventos/pages/formConferenciaPage.tsx` | Checkout de conferencia (Cosmotech) |

---

## 3. Boundary de errores (no existía ninguno)

- **`app/error.tsx`** (nuevo): envuelve todo `page.tsx`/`layout.tsx` anidado bajo la raíz — incluye
  los 4 flujos de checkout de arriba. Usa la prop **`retry`** (no `reset` — estable desde Next
  16.3.0, se verificó contra `node_modules/next/dist/docs` antes de escribirlo, por la advertencia
  de `AGENTS.md` de que esta versión de Next tiene convenciones propias). Reintenta re-renderizar el
  segmento sin recargar toda la página: si el error fue transitorio, el usuario no pierde su lugar
  en el flujo. Mensaje explícito de que la reserva no se pierde.
- **`app/global-error.tsx`** (nuevo): cubre el caso que `error.tsx` NO cubre por diseño de
  Next — un error en el propio `app/layout.tsx`. Declara su propio `<html>`/`<body>` con estilos en
  línea (no hereda `globals.css` ni el theme de marca, porque layout.tsx es justo lo que falló).
- Ambos solo hacen `console.error` por ahora — **no hay servicio de monitoreo de errores configurado
  en el repo** (ni Sentry ni equivalente). Sin uno, estos errores quedan solo en la consola del
  navegador de cada usuario. Queda como pendiente de decisión de producto (ver doc anterior).

---

## 4. Cabeceras de seguridad — HSTS + COOP

`next.config.ts`, sección `headers()`. Señaladas como faltantes por PageSpeed Insights
("Confianza y seguridad"). Se verificó antes de añadirlas que no rompen nada existente:

- **`Strict-Transport-Security: max-age=15552000; includeSubDomains`** — sin `preload` (someter el
  dominio a la lista de precarga de los navegadores es efectivamente irreversible). El navegador
  ignora esta cabecera si la respuesta no llega por HTTPS, así que no afecta `next dev` en HTTP.
- **`Cross-Origin-Opener-Policy: same-origin`** — se revisaron los 3 `window.open(...)` del repo
  (wallet de boletos, compartir en `/explorar`, enlaces a Maps): ninguno depende de `window.opener`
  de vuelta, así que aislar la ventana no los afecta.

`next.config.test.ts` se actualizó (la prueba contaba exactamente 4 cabeceras; ahora son 6, con
aserciones nuevas para las dos).

**Deliberadamente fuera de alcance:** CSP completa (`script-src`) y Trusted Types. Ahora es más
viable que antes de hoy —los SDK de Google/Apple ya se quitaron (`3e12dee`, ver el reporte de
ayer)— pero queda Meta Pixel + OpenPay + `sweetalert2`/`next/script`, que necesitan nonces/allowlist
bien armados. Un allowlist mal armado rompe pagos o tracking en silencio; necesita probarse en vivo
antes de subir, no es un cambio de "una línea segura" como HSTS/COOP.

---

## 5. Verificación

| Check | Resultado |
|---|---|
| `npm run build` | ✅ 26/26 páginas, TypeScript limpio |
| `npx vitest run --pool=threads --no-file-parallelism` | ✅ 136/136 (18 archivos) |
| `curl` contra `next start` local | ✅ `Strict-Transport-Security` y `Cross-Origin-Opener-Policy` presentes en la respuesta |

## 6. Pendiente / fuera de alcance de hoy

- **CSP completa / Trusted Types** — necesita pruebas en vivo contra Meta Pixel y OpenPay antes de
  subir (ver §4).
- **Monitoreo de errores** (Sentry o similar) — decisión de producto, no configurado (ver §3).
- **Limpieza de `useGoogleAuth` y los métodos oauth muertos de `useAuthStore`** — ya anotado por
  Lucy al quitar los SDK ayer, sigue pendiente.
- El resto de pendientes de rendimiento/migración sigue igual que en los reportes anteriores.
