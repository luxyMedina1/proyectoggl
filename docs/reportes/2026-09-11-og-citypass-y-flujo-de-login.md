# Reporte — OG de CityPass sin imagen propia, y cómo funciona el checkout con/sin sesión

**Fecha:** 2026-09-11
**Proyecto:** frontend v3 (Next 16.3.4 App Router)
**Rama:** `migracion-v2-v3`
**Repo:** `github.com/luxyMedina1/proyectoggl` (`proyectoggl`) y `git.redgl.com/desarrollo/taquillavipfrontend-v3` (`origin`, GitLab)
**Base:** `4d73310` (punta al cierre de este reporte)

**Estado del build:**

- `npm run build` → ✅ 26 páginas, TypeScript limpio
- `npx vitest run --pool=threads --no-file-parallelism` → ✅ **153/153** en 21 archivos
- Fix de OG verificado en vivo con `curl` contra un `next start`, antes y después
- Commiteado y pusheado a `proyectoggl` y `origin` (`migracion-v2-v3`, `4d73310`)

---

## 1. Resumen ejecutivo

| Tarea | Descripción | Estado |
|---|---|---|
| **OG de CityPass sin imagen propia** | `og:image`/`twitter:image` desaparecían en 2 de los 3 estados posibles de `/citypass/[slug]` — verificado contra el backend real, donde hoy es el caso de producción. | ✅ arreglado |
| **Cómo funciona el checkout con/sin sesión** | Se investigó y documentó el comportamiento real (no había pregunta de código, sino de entender el flujo). Se encontró que la compra como invitado está **desactivada a propósito** en los 4 checkouts. | 📄 documentado, sin cambio de código |

---

## 2. OG de CityPass — la imagen de marca no se heredaba

### El bug

`app/(site)/citypass/[slug]/page.tsx` declara su propio bloque `openGraph`/`twitter` en `generateMetadata`. Next.js **no reinyecta** la imagen de archivo del segmento raíz (`app/opengraph-image.tsx`) cuando un hijo declara su propio `openGraph` — los campos anidados del padre quedan sobreescritos por el último segmento que los declare (documentado en los docs de Next). Esto afectaba a **2 de los 3 estados** posibles de la página:

| Estado | `og:image` antes | `og:image` después |
|---|---|---|
| Slug que no es ninguna ciudad | hereda la marca (no declara `openGraph` propio) | sin cambio |
| **Ciudad sin CityPass configurado** | ❌ ninguna | ✅ logo de marca |
| Ciudad con CityPass, hero sin imagen | ❌ ninguna | ✅ logo de marca |
| Ciudad con CityPass y hero con imagen | ✅ imagen del hero | sin cambio |

### Verificado contra el backend real, no solo en teoría

Hoy solo existe una ciudad (`Durango`) y **no tiene CityPass activo** — es decir, el caso "sin imagen" era el estado real de producción en este momento. Se confirmó con `curl` contra un build de producción:

```
Antes:  og:title=CityPass Durango, og:description=..., (sin etiqueta og:image)
Después: og:title=CityPass Durango, og:description=..., og:image=.../opengraph-image
```

### El fix

Mismo patrón ya probado en `app/(site)/eventos/page.tsx`: heredar `(await parent).openGraph?.images` (segundo parámetro `parent: ResolvingMetadata` de `generateMetadata`) y usarlo como *fallback* en vez de `undefined` cuando no hay imagen propia que anunciar.

`app/(site)/citypass/[slug]/page.test.tsx`: los 2 tests que esperaban `images: undefined` ahora esperan la imagen heredada (con un `parent` mockeado); se sumó un 5º test para el caso "CityPass configurado pero sin imagen en el hero", que no tenía cobertura.

---

## 3. Cómo funciona el checkout con sesión y sin sesión (investigación, sin cambio de código)

Se pidió entender el comportamiento real al pagar, con y sin sesión iniciada. Hallazgos, verificados
leyendo `app/(site)/eventos/[slug]/EventoDetalleView.tsx` (representativo de los 4 checkouts):

### Con sesión

1. Se reserva el asiento/lugar.
2. Corre la lógica de registro de cliente OpenPay (arreglada ayer, ver el
   [reporte de flujo de pago](2026-09-11-flujo-de-pago-y-resiliencia.md)).
3. Se llega al paso de pago con tarjetas guardadas o formulario de tarjeta nueva.

### Sin sesión

El checkout **exige iniciar sesión** — no hay compra como invitado activa hoy:

```js
if (!user) {
  const ok = await requestLogin();   // abre el modal de login, ES OBLIGATORIO
  if (ok) setReservaPendiente(true);
  return false;                      // esta llamada no reserva nada
}
```

`requestLogin()` (`context/AuthModalContext.tsx`) no navega a otra página: pone el modal de
`LoginForm` como overlay y devuelve una `Promise<boolean>` que queda pendiente hasta que el modal se
cierra — `true` si el usuario se autenticó (`onAuthenticated` → `cerrar(true)`), `false` si lo cerró
sin loguearse. Como el componente de la página nunca se desmonta, la selección de asientos y los
datos del formulario que ya se habían elegido **no se pierden** mientras el modal está abierto.

Si el login sale bien, un `useEffect` que vigila `[reservaPendiente, user]` reintenta
`handleReservarAsientos()` automáticamente en cuanto `user` deja de ser `null`, y avanza el `step` al
pago si la segunda reserva sí sale — sin que el usuario tenga que volver a hacer clic en nada.

### Hallazgo: la compra como invitado está desactivada a propósito

En el código hay un marcador explícito:

```js
// 📌 [INVITADO DESHABILITADO]
// if (usuarioInvitado) { ...validaciones de nombre/correo del invitado... }
```

Validaciones y parte de la lógica de invitado (`usuarioInvitado`, `nombre_invitado`,
`correo_invitado`) siguen en el código de los 4 checkouts, comentadas o sin activar — no borradas —
sugiriendo que se desactivó a propósito con intención de reactivarla más adelante, no que sea un
descuido de un solo archivo. Es consistente en los 4 flujos revisados (evento, evento por-asientos,
abono por-asientos, conferencia).

**Pendiente de decisión de producto:** ¿reactivar la compra como invitado, o queda así (cuenta
obligatoria) como está hoy? No se tocó nada de esto — es solo el diagnóstico.

---

## 4. Verificación

| Check | Resultado |
|---|---|
| `npm run build` | ✅ 26/26 páginas, TypeScript limpio |
| `npx vitest run --pool=threads --no-file-parallelism` | ✅ 153/153 (21 archivos) |
| `curl` contra `next start`, `/citypass/durango` | ✅ `og:image`/`twitter:image` presentes tras el fix |

## 5. Pendiente / fuera de alcance de hoy

- **Reactivar (o no) la compra como invitado** — decisión de producto, no de código (ver §3).
- El resto de pendientes sigue igual que en los reportes anteriores de la semana.
