# Reporte — Frente B: OG de `/eventos`, revisión de B1 y barrido de `no-explicit-any`

**Fecha:** 2026-09-10
**Proyecto:** `garza` (frontend v3, Next 16 App Router)
**Rama:** `migracion-v2-v3`
**Repo:** `github.com/luxyMedina1/proyectoggl` (remoto `origin`)
**Base:** `45a1d76` (`resiliencia de red + logo de respaldo + docs de la migracion`)
**Reparto:** el trabajo se dividió en dos frentes; este reporte cubre **el frente B**
(A = bump de Next + verificación del pipeline; B = contenido del OG + deuda de lint + QA de
promociones).

**Estado del build (en cada commit, no solo al final):**

- `npx tsc --noEmit` → ✅ limpio
- `npm run build` → ✅ 26 páginas prerenderizadas; `/eventos` sigue `○ (Static)`
- `npx vitest run --pool=threads` → ✅ **135/135** en 18 archivos
- `npm run lint` → **68 errores + 146 warnings** (arrancó en 237 + 157)

**Todo commiteado y pusheado** a `origin/migracion-v2-v3` (`45a1d76..356fea7`, 11 commits).

---

## 1. Resumen ejecutivo

| Frente | Descripción | Estado |
|--------|-------------|--------|
| **B1** OG del sitio raíz muestra la marca | Revisión de código: `app/layout.tsx` + `opengraph-image.tsx` ya usan `config.nombreMarca` y el logo. Lo pendiente es de deploy del túnel. | ✅ código OK / ⏳ deploy |
| **B (extra)** OG de `/eventos` | La tarjeta al compartir mostraba `title="Eventos"` + banner de un evento suelto. Ahora muestra la **marca** en `og:title`/`twitter:title` y hereda la imagen OG de respaldo. | ✅ |
| **B2** Quitar `any` | Barrido por lotes y por carpeta. `no-explicit-any` **187 → 34**; lint total **237 → 68 errores**. Los 4 flujos de checkout, `useEventosStore`, `sitemap`, hooks de conferencia y `useGoogleAuth` quedan limpios. | ✅ (queda cola) |
| **B3** QA de promociones en navegador | Helper `utils/promociones.ts` con 75/75 pruebas; los 4 flujos buildean y sus rutas responden 200. El click-through manual sigue pendiente (necesita datos de promo en backend + pago real). | ⏳ pendiente |

**Números que se recontaron** (no se estimaron):

| Métrica | Antes | Después |
|---|---|---|
| `npm run lint` — errores | 237 | **68** |
| `npm run lint` — warnings | 157 | **146** |
| `@typescript-eslint/no-explicit-any` | 187 | **34** |
| pruebas | 135/135 | 135/135 |
| páginas / rutas / `<img>` | 34 / 39 / 111 | sin cambios |

El README (gotcha de lint + línea de "Última revisión" + resumen de números) se actualizó en el
mismo rango de commits (coordinación B2: "B actualiza el README por la deuda de lint").

---

## 2. Qué se hizo, commit por commit

### 2.1 `1c9b022` — OG de `/eventos` con marca en título e imagen

**Archivo:** `app/(site)/eventos/page.tsx` (+ README + `docs/commits-nuevos/05`).

Problema (de la captura que motivó la tarea): al pegar `…/eventos` en un chat, la tarjeta salía
con título **"Eventos"** y la imagen del **primer evento** del listado (`imagenOgDestacada`). Si el
listado venía vacío, la tarjeta salía sin imagen.

- `generateMetadata` deja de calcular `imagenOgDestacada` (se borró el helper). El `<title>` del
  documento sigue siendo `"Eventos"` (sirve para SEO y la pestaña), pero `openGraph.title` y
  `twitter.title` pasan a ser el **nombre de marca** (`config.nombreMarca`, fallback
  `NEXT_PUBLIC_TITLE_APP`).
- La imagen se **hereda explícitamente del `parent`** (`(await parent).openGraph?.images`, patrón
  de la doc de Next). Se descubrió al probar con `next start` que **esta versión de Next NO
  reinyecta la imagen de archivo del segmento raíz** (`app/opengraph-image.tsx`) cuando la página
  declara su propio bloque `openGraph` sin `images`: `/eventos` quedaba sin `og:image` del todo.
- Verificado sobre la build de producción (`curl` al HTML): `og:title` = `Taquilla Vip`,
  `og:image` = `/opengraph-image` (1200×630, logo sobre degradado).

### 2.2 `ddcfccd` — autofix trivial + tipar `utils/ogEvento.ts`

**`eslint --fix`** (15 errores + 1 warning, todos seguros):

- `let` → `const` (`prefer-const`) donde la variable nunca se reasigna.
- `id: Number` → `id: number` (`no-wrapper-object-types`) en las interfaces `Conferencia` de
  `RegistroConferencia` y los hooks de conferencia.
- Una directiva `eslint-disable-next-line react-hooks/exhaustive-deps` ya muerta en
  `InfoEventoView.tsx` (el efecto tenía sus deps completas; se quitó la línea y el hueco).

**`utils/ogEvento.ts`** — fuera los 4 `any`:

- `apiGet` pasa a genérico: `apiGet<T = unknown>(path, tags): Promise<T>` (mismo patrón que ya
  usaba `app/sitemap.ts`).
- Tres interfaces para las respuestas del backend que el módulo consume:
  - `RespuestaSlugEvento` — `GET /eventos/slug/:slug`
  - `RespuestaListaEventos` — `GET /eventos/get_all_select`
  - `EventoDetalle` — `GET /eventos/:id/detalle`, acotada a lo que leen las `<meta>` y el cascarón
    de la página de evento (`recinto`/`ciudad` reutilizan `Recinto`/`Ciudad` de
    `app/(site)/eventos/[slug]/cabeceraEvento.ts`); el resto del DTO queda en un index signature
    `[clave: string]: unknown`.
- `getEvento(): Promise<EventoDetalle | null>`, `getListaEventos(): Promise<EventoListaSlug[]>`.
- `app/(site)/eventos/page.tsx`: `getEventosHome` deja de devolver `any[]`.

### 2.3 `4c4f3dd` — `useEventosStore` + hooks de conferencia + tipos compartidos

**`utils/apiError.ts` (nuevo):** helpers para leer el error que propaga axios.

| Export | Qué |
|---|---|
| `CuerpoErrorApi` | forma de `error.response.data` (`message?`, `noDisponibles?`, `completo?`, index signature) |
| `cuerpoDeErrorApi(error): CuerpoErrorApi \| undefined` | narrowing sin lanzar |
| `statusDeErrorApi(error): number \| undefined` | status HTTP |
| `mensajeDeErrorApi(error, fallback): string` | `message` del backend o el fallback |

Sustituye al `catch (error: any)` + `error.response.data.message` que estaba repetido en ~19
archivos.

**`types/Conferencia.ts` (nuevo):** `ConferenciaDetalle` + sub-tipos (`Patrocinador`,
`ContactoConferencia`, `Expositor`, `RedesSocialesConferencia`, `BeneficioConferencia`,
`SesionConferencia`, `DiaPrograma`), inferidos del uso real en las páginas de conferencia
(`patrocinador.logo`, `contacto.puesto`, `speaker.orden`, etc.).

**Cambios:**

- `hooks/useEventosStore.tsx` — 6 `any` fuera: `getDetalleEventoSecciones(funcion?: string | number
  | null)`, `setAbonoBuilderState(state: unknown)`, y 4 `catch` con los helpers nuevos
  (`reservarAbono` conserva su retorno de `cuerpo` cuando hay `noDisponibles`/`completo === false`).
  Los `catch` que no usaban `error` pasaron a `catch {}`.
- Los **5 hooks `useConferencia*`** tenían el MISMO `interface Conferencia { …: any[] }` copiado
  **byte a byte** (incluso el nombre del export no coincide con el del archivo). Ahora importan
  `ConferenciaDetalle` del tipo compartido. `RegistroConferencia.tsx` igual, + `catch` con helper.
- Nota: no se consolidaron los 5 hooks en uno solo (fuera de alcance de "quitar `any`"; hay que
  revisar los sitios de import).

### 2.4 `0e1e438` — `sitemap`, `useGoogleAuth` y 8 `catch` más

- **`app/sitemap.ts`** — `EventoSitemap = EventoListaSlug & { actualizadoEn?: string | null }` en
  vez de `any[]`; el callback de funciones pasa a `FuncionSlugInput`.
- **`hooks/useGoogleAuth.ts`** — tipos mínimos de Google Identity Services
  (`GisCredentialResponse`, `GisIdConfig`, `GisPromptNotification` con el campo interno no
  documentado `j`) en vez de los 10 `any` del `declare global`. El hook **no está importado en
  ningún lado todavía**, así que el riesgo es nulo.
- **`forgot/page.tsx`, `CambiarPassword.tsx`, los 4 `TerminarCompra*Conferencia*`** —
  `catch (error: any)` + `error.response.data.message` → `catch (error)` + `mensajeDeErrorApi()`.
- **`MiPerfil.tsx` (×3), `MisFormasDePago.tsx`** — igual con `cuerpoDeErrorApi()`, manteniendo el
  fallback a `error.message` (ahora tras `error instanceof Error`).

### 2.5 `e0c337d` — README + doc 05 (B1 revisado)

- README: figura de lint `217`, apunta a `apiError.ts` / `Conferencia.ts`.
- `docs/commits-nuevos/05-rendimiento-lcp-next.md`: se marcó como hecho el 🔴 "El OG de fallback
  usa solo texto" (ya usa el logo desde `45a1d76`) y se documentó que **el OG del sitio raíz está
  OK en código** — lo pendiente de B1 es de deploy del túnel (§ 4).

### 2.6 `d8a94fa` — tipar `formConferenciaPage.tsx` (11 de 12 `any`)

- `promocionesAplicanDirecto` / `promosAplicables` → `useState<Promocion[]>`.
- `interface Secciones` gana `seccionAdicional?: number | null`; los callbacks que recibían
  `seccion: any` (filtro de adicionales, `handleClickSeccionAdicional`) pasan a `Secciones`.
- `handleModalClose` / `handleCancelarCompra` → `ReactMouseEvent`;
  `handleBoletosChange` → `ReactChangeEvent<HTMLInputElement>`.
- 4 `catch (error: any)` → `catch (error)` + `cuerpoDeErrorApi` / `mensajeDeErrorApi` (incluye el
  chequeo de `cuerpoDeErrorApi(error)?.isPromoError`).
- El `any` restante (`Window.OpenPay`) se resolvió en `15bfa0b`.

### 2.7 `15bfa0b` — centralizar el tipo de `Window.OpenPay`

`declare global { interface Window { OpenPay: any } }` estaba copiado en los **4 flujos de
checkout**. Ahora vive una sola vez en **`types/openpay.d.ts`** como `OpenPaySDK`
(`setId` / `setApiKey` / `setSandboxMode` / `deviceData.setup` — todo lo que el front llama de
verdad) y los 4 archivos borran su bloque duplicado. −4 `any`.

### 2.8 `9bd560f` — tipar `EventoDetalleView.tsx` (26 `any`)

- `interface Funcion` (id/nombre/fecha/aperturaPuertas/finalEvento); `Evento.funciones` y el
  estado `funciones` → `Funcion[]`.
- `seleccionesAbono` → `SeleccionAsientoFuncion[]` (`types/Abono`); promo state → `Promocion[]`.
- `Categorias.precios` era `[]` (`never[]`) → `number[]`; el `map`/`sort` de categorías deja de
  anotar `any` y se apoya en el tipo.
- callbacks `(f / seccion / categoria / a / b: any)` → `Funcion` / `Secciones` (gana
  `seccionAdicional?`) / inferido.
- handlers de evento → `React.MouseEvent` / `React.ChangeEvent`.
- `resdata: any` → `unknown`; `payload: any` → `Record<string, unknown>`.
- 6 `catch (error: any)` → `catch (error)` + helpers (incluye `isPromoError`).

### 2.9 `5521b62` — tipar `eventos/[slug]/[seccionId]/[seccion]/page.tsx` (22 `any`)

- estado `filas` → `Fila[]` (interfaz nueva); promo state → nuevo `PromoAplicaDirecto`
  (`Promocion` + banderas `promocionPaquetes/Pareja/Familia` + `porcentaje_original`).
- `truncar(valor: number)`, `validarDescuento(num_asientos: Asiento[])`, `resdata: unknown`,
  `payload: Record<string, unknown>`.
- `handleReservarAsientos(e: { preventDefault: () => void })` — cubre a la vez el `MouseEvent`
  real (`onClick`) y la llamada sintética del `useEffect`, a la que se le quita el `as any`.
- callbacks de categorías de promo → `PromoCategoria` (`utils/promociones`); `.find((f) => …)` de
  funciones → `Funcion`.
- 5 `catch (error: any)` → helpers (incl. `isPromoError`).
- `porcentaje = p.porcentaje_original ?? p.porcentaje` en el recálculo de paquetes:
  **equivalente en runtime** (el normalizador se llama aquí con `conPorcentajeOriginal = true`,
  así que `porcentaje_original` siempre está), pero sin `any` y sin romper el tipo.

### 2.10 `0952624` — tipar `abonos/[slug]/[seccionId]/[seccion]/page.tsx` (29 `any`)

Último de los 4 flujos de checkout. Tipos nuevos en el archivo: `Fila`, `Funcion`,
`PromoAplicaDirecto`, `SeleccionParcialAbono`, `AsientoNoDisponible`, `AbonoBuilderState`.

- estados `funciones` / `filas` / `promocionesAplicanDirecto` / `builderBackup` → esos tipos.
- `truncar(valor: number)`, `validarDescuento(num_asientos: Asiento[])`,
  `handleAsientosNoDisponibles(noDisponibles: AsientoNoDisponible[])`, `resdata: unknown`.
- `handleReservarAsientos(e: { preventDefault: () => void })` (idem, sin `as any`).
- callbacks de promo → `PromoCategoria`; `preciosAbonos.find` → `PrecioAbono`; los `.map`/`.forEach`
  de selecciones parciales → `SeleccionParcialAbono`.
- `(evento as any)?.evento?.limiteDeAsientos` → cast acotado
  (`evento as { evento?: { limiteDeAsientos?: number | null } } | null`).
- 4 `catch (error: any)` → helpers (incl. `isPromoError`).
- `asientosARenderizar` tipado `(Asiento & { badgeTexto?: string })[]`; `porcentaje_original ??
  porcentaje` como en 2.9.

### 2.11 `356fea7` — README: deuda de lint 158 → 68

---

## 3. Tipos y helpers nuevos (reutilizables)

| Archivo | Para qué |
|---|---|
| `utils/apiError.ts` | `cuerpoDeErrorApi` / `mensajeDeErrorApi` / `statusDeErrorApi`. Mató ~40 `catch (error: any)`. |
| `types/Conferencia.ts` | `ConferenciaDetalle` + sub-tipos. De-duplica el `interface Conferencia` que estaba en 6 archivos. |
| `types/openpay.d.ts` | `OpenPaySDK` global. Reemplaza 4 `declare global` idénticos. |
| `utils/ogEvento.ts` → `EventoDetalle` | forma acotada de `GET /eventos/:id/detalle`. |

Interfaces locales que se añadieron a los flujos de checkout (no compartidas, específicas de cada
archivo): `Funcion`, `Fila`, `PromoAplicaDirecto`, `SeleccionParcialAbono`, `AsientoNoDisponible`,
`AbonoBuilderState`.

---

## 4. B1 — lo que queda (deploy, no front)

El código del OG raíz está correcto:

- `app/layout.tsx` (`generateMetadata`) usa `config.nombreMarca` (fallback
  `NEXT_PUBLIC_TITLE_APP`) en `title.default`, `og:title` y `og:site_name`.
- La imagen la aporta `app/opengraph-image.tsx`, que ya pinta el **logo de marca**
  (`config.logoMarca` → `config.logo`, extrayendo el PNG si el asset es SVG) sobre el degradado.
- En el peor caso (backend caído + sin `NEXT_PUBLIC_TITLE_APP`) el título raíz cae a
  `"TaquillaVip"`, **nunca a `"Eventos"`** — ese `"Eventos"` de la captura era el literal de
  `/eventos`, ya corregido en `1c9b022`.

Pendiente en el deploy del túnel de Cloudflare:

1. Setear `NEXT_PUBLIC_SITE_URL` al dominio del túnel y `NEXT_PUBLIC_TITLE_APP`
   (ambas ya documentadas en `.env.example`).
2. Confirmar qué devuelve `config:sitio` (`/configuraciones/detail/1`) en ese entorno:
   `nombreMarca`, `descripcion`, `logoMarca`.
3. Validar con el debugger de FB / WhatsApp / Telegram contra la build de producción — el scraper
   cachea, puede necesitar re-scrape.

---

## 5. B3 — QA de promociones: lo que falta

- **Hecho / verificado:** `utils/promociones.ts` con **75/75** pruebas property-based
  (`PORCENTAJE` / `CANTIDAD` / `RESTA`, por-boletos y por-asientos, selección de mejor promo,
  bordes). Los 4 flujos compilan y buildean; las rutas de evento responden 200.
- **Pendiente (necesita persona + backend con datos de promo + pago real):**
  - QA manual de los 4 checkouts con una promoción aplicada.
  - QA específico de descuentos **por-asiento** en el mapa (lo que quedó de la migración v2→v3).
  - Bordes: promo expirada, sin stock, combinación de promos.

---

## 6. Cola de `no-explicit-any` (34 restantes)

Todos sueltos y de bajo riesgo (ninguno en lógica de venta):

| Archivo | `any` |
|---|---|
| `app/(site)/eventos/informacion/[slug]/InfoEventoView.tsx` | 9 |
| `app/(site)/eventos/EventosView.tsx` | 3 |
| `eventos/pages/conferencias/ProgramaConferencia.tsx` | 3 |
| `publicUi/pages/CityPassCheckoutPage.tsx` | 3 |
| `eventos/pages/conferencias/HotelesConferencia.tsx` | 2 |
| tarjetas de conferencia (`({ x }: any)` en props), `DetalleConferencia`, `RecintoConferencia`, `SpeakersConferencia`, `ColorContext`, `useAuthStore`, 2 × `terminar_compra*` | 1 c/u |

`CityPassCheckoutPage.tsx` usa `OpenPay` sin `window.` (posible `declare const` propio) — revisar
si le sirve `types/openpay.d.ts` o necesita su ajuste.

---

## 7. Coordinación con el frente A

- **`app/` / `opengraph-image.tsx`:** A hace el bump de Next y verifica el pipeline; B tocó el
  **contenido** del OG (`app/(site)/eventos/page.tsx`) y los 4 flujos de checkout. Si A rebasa
  sobre B, los choques probables son en `app/(site)/eventos/` y en los `[seccion]/page.tsx`.
- **`README.md`:** B lo actualizó por la deuda de lint (68) y por el OG de `/eventos`. Si A lo
  toca por la versión de Next, el segundo en mergear reconcilia esa parte.
- **`docs/commits-nuevos/05`:** B marcó como hechos los ítems de OG (raíz + `/eventos`).
- **Línea "Última revisión" del README:** B la dejó en `2026-09-10`.
