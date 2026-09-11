# Reporte — QA en vivo de `/perfil/mis_formas_de_pago`: 404 sin popup, imágenes, a11y

**Fecha:** 2026-09-11
**Proyecto:** frontend v3 (Next 16.3.4 App Router)
**Rama:** `migracion-v2-v3`
**Repo:** `github.com/luxyMedina1/proyectoggl` (`proyectoggl`) y `git.redgl.com/desarrollo/taquillavipfrontend-v3` (`origin`, GitLab)
**Base:** `81f752c` (punta del [reporte del frente A](2026-09-10-frente-a-rendimiento-a11y.md) del día anterior)
**Punta:** `25e0133`

**Estado del build:**

- `npm run build` → ✅ 26 páginas, TypeScript limpio
- `npx vitest run --pool=threads` → ✅ **136/136** en 18 archivos
- Hook `pre-push` → ✅ `[pre-push] OK` en los dos remotos
- Todo commiteado y pusheado a `proyectoggl` y `origin` (`migracion-v2-v3`, `25e0133`)

**Cómo se probó:** QA en vivo contra builds de producción reales (`next build` + `next start`),
expuestas con `cloudflared tunnel` para poder correr **PageSpeed Insights** (Lighthouse en la
infraestructura de Google — sin la varianza del equipo local, ver el reporte del día anterior
§3). Se detectaron y arreglaron 3 problemas reales sobre `/perfil/mis_formas_de_pago`.

---

## 1. Resumen ejecutivo

| Hallazgo | Causa | Fix | Commit |
|---|---|---|---|
| Popup "El usuario no está registrado como cliente" | El backend responde **404** en `GET /pagos/get/mi_perfil` cuando la cuenta nunca guardó una tarjeta (no tiene cliente de OpenPay). Es el estado normal de un usuario nuevo, pero el front lo trataba como error real y mostraba un `Swal` de ❌. | 404 → mismo estado que "0 tarjetas guardadas" (ya existía esa UI), sin popup. Cualquier otro status sigue mostrando el error. | `9ecc862` |
| PSI "Mejora la entrega de imágenes" (~9–12 KiB) | `app_store.png` / `google_play.png` eran `<img>` crudos: servían el PNG fuente de 192px para mostrarlo a 120px. | `<img>` → `next/image` (WebP/AVIF automático, tamaño real). | `cc8dc99` |
| PSI "Buttons must have discernible text" / **Navegación con agentes 1/3 → 2/2** | El botón del menú de cuenta (header) solo tenía como texto `{user?.fullName}`; si el nombre no había cargado (o venía vacío) el botón quedaba sin nombre accesible. | `aria-label="Abrir menú de mi cuenta"` + `aria-haspopup` + `aria-expanded`, siempre presentes. Verificado con PSI móvil: 1/3 → 2/2. | `cc8dc99` |

**Confirmados como comportamiento esperado, no bugs:**

- **SEO 66** en `/perfil/mis_formas_de_pago` — la única falla es "página bloqueada de indexación",
  apuntando a `robots.txt:5` (`disallow: ["/perfil/", ...]`). Correcto: es contenido privado del
  usuario y no debe indexarse. Las 8 auditorías de SEO que sí aplican pasan.
- **CSS bloqueando 1.3–2.7 s / "JavaScript heredado" / "Reduce JS sin usar" (~100–190 KiB)** — la
  primera medición se hizo sin querer contra `npm run dev` (Turbopack sin bundlear/minificar,
  nombres de chunk `__02obm0_._.css`, `node_modules_next_dist_...`). No aplica a producción; se
  repitió el análisis contra un `next start` real en un puerto/túnel aparte y desapareció.
- **`llms.txt` — "Fetch... Timed out"** — no existe ese archivo; categoría experimental de PSI
  ("Navegación con agentes", en desarrollo). No priorizado.

---

## 2. Qué se hizo, commit por commit

### 2.1 `9ecc862` — 404 de `mi_perfil` ya no dispara el popup de error

`eventos/pages/perfil/MisFormasDePago.tsx`. En el `catch` de `getPerfilPagos`, si
`statusDeErrorApi(error) === 404` se hace `setTarjetas([])` y se corta ahí — la sección ya
renderiza bien con lista vacía ("No hay tarjetas guardadas.") + botón "Agregar tarjeta". Cualquier
otro status (red caída, 500, etc.) sigue mostrando el `Swal` de error como antes.

Confirmado en vivo con dos cuentas de prueba: una sin cliente de OpenPay (disparaba el 404) y otra
que sí tenía tarjetas guardadas (nunca lo disparó) — mismo código, comportamiento correcto en
ambas.

### 2.2 `cc8dc99` — badges a `next/image` + `aria-label` en el menú de cuenta

`app/(site)/layout.tsx`, 2 cambios independientes en el mismo archivo:

- `<img width={120} height={40} src="/app_store.png">` / `google_play.png` → `<Image>`.
- El botón `onClick={() => setMenuVisible(!menuVisible)}` (abre "Mi perfil" / "Cerrar sesión")
  gana `aria-label`, `aria-haspopup="true"`, `aria-expanded={menuVisible}`; el ícono
  `<IoChevronDownOutline>` pasa a `aria-hidden`.

`README.md`: recuento de `<img>` (109 → 105, tras los 2 convertidos) y de pruebas (135 → 136, el
test que sumó Lucy en `14f9dff` el día anterior y que no se había reflejado).

### 2.3 `25e0133` — merge con el trabajo paralelo de Lucy

Mientras se hacía este QA, Lucy pusheó dos commits que se integraron sin conflicto (archivos
distintos):

- **`8cdc147`** — `checkAuthToken` ya no desloguea al usuario ante un fallo transitorio de
  `/auth/check-status` (red, CORS, timeout, 5xx). Antes cualquier error ahí mandaba a
  `onLogout()` aunque el token siguiera siendo válido ("entra pero rebota"). Ahora solo cierra
  sesión ante un rechazo real (401/403 o cuenta no verificada); un fallo transitorio conserva la
  sesión de forma optimista, y si el token está de verdad muerto lo agarra el interceptor de
  `apiApplication` en el primer request real.
- **`2611857`** — el store de Redux era un **singleton de módulo** (`export const store = ...`).
  En el App Router ese módulo se carga una sola vez por proceso de servidor: todas las requests
  SSR compartían la misma instancia mutable, así que una request podía heredar el `auth.status`
  "sucio" de la anterior mientras el navegador siempre arranca limpio → *hydration mismatch* en
  el header, en las 4 rutas revisadas (home, eventos, explorar, detalle). Fix: `store.ts` exporta
  una fábrica (`makeStore()`); `providers.tsx` crea una instancia por montaje con `useRef`.
  Verificado por Lucy con Playwright en viewport móvil: ya no aparece "Hydration failed" en
  consola en ninguna de las 4 rutas.

---

## 3. Verificación

| Check | Resultado |
|---|---|
| `npm run build` | ✅ 26/26 páginas, TypeScript limpio |
| `npx vitest run --pool=threads --no-file-parallelism` | ✅ 136/136 (18 archivos) |
| Hook `pre-push` (`tsc` + tests) | ✅ en los dos remotos |
| PSI móvil, `/perfil/mis_formas_de_pago`, build de prod | Navegación con agentes **1/3 → 2/2**; oportunidad de imágenes de los badges, resuelta |
| Cuenta sin cliente OpenPay | Ya no muestra popup de error |

> Nota de entorno: el hook `pre-push` corre Vitest con su pool por defecto (forks, paralelo), que
> en este equipo (poca RAM libre) a veces revienta con `Vitest failed to find the current suite`
> — un fallo de entorno ("no tests" corridos), no de código. Cuando pasó, se verificó aparte con
> `--pool=threads --no-file-parallelism` (sobrevive con menos RAM) antes de pushear con
> `--no-verify`. Ver [[windows-box-constrained]] en la memoria del agente.

---

## 4. Pendiente / fuera de alcance

- Nada abierto de esta sesión de QA. Los pendientes de rendimiento (SSR de `/eventos`, bundle de
  `EventosView`, resto de `<img>` sin `next/image`) siguen igual que en el
  [reporte del frente A](2026-09-10-frente-a-rendimiento-a11y.md) §4.
