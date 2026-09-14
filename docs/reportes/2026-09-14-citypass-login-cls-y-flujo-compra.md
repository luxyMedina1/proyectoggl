# Reporte — CityPass sin login forzado, CLS del loader, y el flujo de compra que se perdía

**Fecha:** 2026-09-14
**Proyecto:** frontend v3 (Next 16.3.4 App Router)
**Rama:** `migracion-v2-v3`
**Repo:** `git.redgl.com/desarrollo/taquillavipfrontend-v3` (`origin`, GitLab)
**Base:** `ddaa8c0` (punta al cierre de este reporte)

**Estado del build:**

- `npm run typecheck` → ✅ limpio (corrido 4 veces durante la sesión, tras cada cambio)
- `npx vitest run --pool=threads` → ✅ **152/152** en 21 archivos (corrido 3 veces)
- `npm run build` → ✅ build de producción sin errores (corrido 3 veces)
- Verificado en vivo con Lighthouse contra `next start` (build real), no contra `next dev`
- Commiteado y pusheado a `origin` (GitLab) — el hook `pre-push` (typecheck + tests + auditoría de
  imágenes) corrió solo en cada push y pasó

---

## 1. Resumen ejecutivo

| Tarea | Estado |
|---|---|
| Bajar y revisar los cambios de Lucy del día (CityPass sin login forzado, like sin navegar, perfil inline) | ✅ integrados, verificados junto con el resto |
| Medir rendimiento real (no el de `next dev`, que engaña) | ✅ hecho contra build de producción — el sitio ya rinde bien |
| CLS de CityPass (landing, paquete, checkout): el footer saltaba al cargar | ✅ arreglado — CLS 0.318 → 0.087 |
| El modal de "completar perfil" quedaba encimado con la página de fondo y cortaba la compra a medio camino | ✅ arreglado |
| Un merge viejo que apareció en el fork de Lucy en GitHub | ⚠️ revisado y **descartado a propósito** — habría revertido el fix de CLS sin traer nada nuevo |

---

## 2. Cambios de Lucy del día, bajados e integrados

Cuatro commits, todos en la misma línea de trabajo — sacar el login forzado de la navegación y
dejarlo solo donde de verdad hace falta (comprar, reservar, dar like):

| Commit | Qué hace |
|---|---|
| `defbf59` | El botón CityPass del header navegaba directo a `/citypass/[ciudad]` sin pedir login — antes exigía sesión solo para *mirar* el catálogo público |
| `9a035a3` | Actualiza los tests de `SiteLayout` al nuevo flujo sin login previo |
| `4717877` | El botón de "like" en `/explorar` abre el modal de login en vez de navegar a `/auth/login` (mismo patrón que comprar) |
| `acc153b` | Si el perfil queda incompleto justo después de loguearse *desde el modal*, ahora pide los datos que faltan **dentro del mismo modal**, sin navegar — para no perder la página (compra, selección de asientos) donde estaba el usuario |

Verificado que las 4 compilan y pasan tests junto con el resto del código antes de seguir.

---

## 3. Rendimiento real vs. lo que parecía

Se pidió mejorar el rendimiento después de ver un reporte de PageSpeed con 48/100. La causa no era
el código: **el reporte corría contra `next dev`** (sin minificar, con el cliente de HMR), que nunca
va a puntuar bien sin importar qué se arregle. Contra una build de producción real (`next build &&
next start`), medido con Lighthouse:

| Ruta | Rendimiento | LCP | CLS | Nota |
|---|---|---|---|---|
| `/eventos` | 95 | 1.1 s | 0.005 | primera pasada dio 76 — el caché de imágenes de Next estaba frío (transcodea a AVIF/WebP la primera vez que se pide cada imagen); en la segunda visita ya es rápido |
| `/explorar` | 92 | 1.8 s | 0.004 | — |
| `/citypass/durango` | 82 → 83 | ~2.2 s | **0.318 → 0.087** | el CLS era el bug real, ver §4 |
| `/perfil/mis_formas_de_pago` | 90 | 2.0 s | 0.015 | redirige a `/auth/login` sin sesión (SEO 66 y accesibilidad 91 ahí, sin investigar más — no era el foco) |

**Conclusión:** el sitio ya rinde bien en producción. Lo único real que había para arreglar era el
CLS de CityPass (§4). El resto del hallazgo de "48/100" era un artefacto de medir el entorno
equivocado — se le explicó al usuario y se le dieron túneles de Cloudflare apuntando a una build de
producción real para que pudiera volver a medir y confirmarlo él mismo.

---

## 4. CLS de CityPass — el footer saltaba al cargar

### El bug

`publicUi/components/Loader.tsx` es `position: fixed` — o sea, **0 de alto en el flujo del
documento**. Tres páginas lo devolvían solas mientras cargaban datos:

```jsx
if (loading) return <Loader />;
```

Mientras tanto, la página es efectivamente header + footer pegados (el loader no ocupa espacio). Al
resolver los datos, el contenido real (`min-h-screen`) empuja el footer de golpe ~600px hacia abajo.
Es **el mismo bug** que Lucy ya había diagnosticado y arreglado en `/eventos` el 10 de septiembre
(`8f96427`), sin portar a estas tres páginas:

- `publicUi/pages/CityPassPage.tsx`
- `publicUi/pages/CityPassPaquetePage.tsx`
- `publicUi/pages/CityPassCheckoutPage.tsx`

### El fix (commit `b530353`)

El `if (loading) return <Loader/>` ahora reserva el mismo `min-h-screen` que el contenido resuelto,
para que el relevo *cargando → contenido* no salte:

```jsx
if (loading) {
  return (
    <div className="min-h-screen bg-gray-50" aria-hidden="true">
      <Loader />
    </div>
  );
}
```

Medido en `/citypass/durango` (build de producción, Lighthouse desktop, dos corridas): **CLS 0.318 →
0.087**, estable — dentro del presupuesto del repo (`lighthouserc.json`, máx. 0.1).

`CityPassTerminarCompra.tsx` (la cuarta página que usa el mismo `Loader`) se revisó y **no** tiene
este bug: ahí el `Loader` se renderiza *junto* al contenido (`{loading && <Loader/>}`), no en
reemplazo de todo el árbol, así que el contenedor exterior nunca colapsa a 0.

---

## 5. El modal de "completar perfil" cortaba el flujo de compra

### El bug

El fix de Lucy de esta mañana (`acc153b`, §2) hizo que el modal de login complete el perfil *dentro
de sí mismo*, sin navegar, precisamente para no perder la página de compra donde estaba el usuario.
Pero `components/AppGate.tsx` tiene su **propio** `useEffect`, completamente aparte, que redirige a
`/auth/completar_perfil` en cuanto detecta `perfilCompleto === false` — sin saber que el modal ya lo
estaba resolviendo:

```jsx
useEffect(() => {
  if (status === "authenticated" && user && user.perfilCompleto === false
      && pathname !== "/auth/completar_perfil") {
    router.replace("/auth/completar_perfil");
  }
}, [status, user, pathname, router]);
```

Resultado, capturado en pantalla por el usuario: el modal se abre bien (paso "Completa tu perfil"),
y **al mismo tiempo** AppGate manda la página de fondo a `/auth/completar_perfil` — las dos pantallas
encimadas. Y aunque el usuario completara el paso del modal, la navegación de fondo ya había ocurrido
y la página de compra original (evento, selección de asientos) quedaba perdida de todos modos — el
problema que `acc153b` se proponía resolver seguía sin resolverse del todo.

### El fix (commit `ddaa8c0`)

`context/AuthModalContext.tsx` ahora expone si el modal está abierto (`estaAbierto`).
`components/AppGate.tsx` no dispara su propia redirección mientras es así:

```jsx
}, [status, user, pathname, router, modalAbierto]);
// ...
user.perfilCompleto === false &&
pathname !== "/auth/completar_perfil" &&
!modalAbierto
```

Si el usuario cierra el modal sin completar el perfil, AppGate retoma el control normal en el
siguiente render (comportamiento sin cambios para ese caso).

No se pudo probar el flujo de OTP real en el navegador (necesita un código real por SMS/WhatsApp),
pero se verificó leyendo el trazado completo de estado entre `AuthModalContext`, `LoginForm` y
`AppGate`, y el fix ataca exactamente la causa encontrada.

---

## 6. Un merge viejo en el fork de Lucy — revisado y descartado

Al bajar cambios de nuevo más tarde, `proyectoggl/migracion-v2-v3` mostraba varias docenas de
commits "nuevos". Antes de integrarlos a ciegas se comparó el árbol de archivos final contra el de
esta rama: **eran idénticos salvo 4 archivos**, y en esos 4 la versión de Lucy era la **anterior** al
fix de CLS del §4 (README + las 3 páginas de CityPass). Es decir, esos commits no traían nada nuevo —
era un merge de su lado con una rama vieja (`origin/main`, historial del 28-30 de agosto) hecho
*antes* de que su fork bajara el último push a GitLab. Mergearlo habría revertido el fix de CLS sin
aportar nada a cambio.

**Decisión:** no se integró. No hay nada pendiente de "extraer" de ahí — es ruido de historial, no
trabajo nuevo.

---

## 7. Verificación

| Check | Resultado |
|---|---|
| `npm run typecheck` | ✅ limpio, corrido tras cada cambio |
| `npx vitest run --pool=threads` | ✅ 152/152 en 21 archivos |
| `npm run build` | ✅ sin errores |
| Lighthouse contra `next start` (producción real) | ✅ ver tabla del §3 |
| Hook `pre-push` (typecheck + tests + auditoría de imágenes) | ✅ pasó en los 2 pushes de hoy |
| Push a `origin` (GitLab) | ✅ `b530353` y `ddaa8c0` |

## 8. Pendiente / fuera de alcance de hoy

- Confirmar visualmente en el navegador el flujo completo de "reservar sin sesión → completar OTP →
  perfil incompleto → modal pide los datos → se retoma la compra" — bloqueado por necesitar un
  código OTP real (SMS/WhatsApp) que este entorno no puede generar.
- La auditoría de imágenes (informativa, no gatea) sigue marcando 46 `<img>` sin dimensiones en 27
  archivos — deuda ya documentada en el doc 06, sin cambios hoy.
- Si Lucy pushea de nuevo *después* de haber bajado el estado actual de GitLab, ahí sí puede traer
  trabajo nuevo real para integrar.
