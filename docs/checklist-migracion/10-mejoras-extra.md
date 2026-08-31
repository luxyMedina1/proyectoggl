# 10 — Mejoras extra

Hallazgos de pasadas posteriores, cuando ya estaban resueltos los puntos críticos de la migración.
**Ninguno bloquea nada**: son mejoras que ahora tienen sentido porque el terreno ya está firme.

Ordenados por relación ganancia / esfuerzo dentro de cada bloque. Los números salen de contar el
repo en el commit `d9849e9`; si no cuadran, vuelve a contar.

Índice rápido de lo más rentable:

| | Mejora | Esfuerzo |
|---|---|---|
| 🥇 | [Datos estructurados `Event` (JSON-LD)](#1-datos-estructurados-de-evento-json-ld) | 1 día |
| 🥈 | [`notFound()` para slugs inválidos](#2-slugs-inválidos-devuelven-200-soft-404) | 2 h |
| 🥉 | [CityPass en el sitemap](#4-el-sitemap-no-incluye-citypass) | 2 h · código listo |
| | [Cabeceras de seguridad](#7-no-hay-ninguna-cabecera-de-seguridad) | 3 h |
| | [Pasar la cabecera del evento al cliente](#pendiente-de-la-auditoría) | medio día |

> **Nada de esto está implementado.** Son tareas con el código escrito para que lo peguen y adapten.

---

## A. SEO y descubrimiento

### 1. Datos estructurados de evento (JSON-LD)

**Es la mayor ganancia de SEO que queda, y es específica de este negocio.**

Google tiene un tipo de resultado enriquecido para eventos: muestra fecha, hora, recinto, ciudad,
rango de precios y si hay boletos disponibles, directamente en la página de resultados y en Google
Events. Para conseguirlo hay que emitir un bloque JSON-LD con el schema
[`Event`](https://schema.org/Event). **Hoy no hay ninguno en todo el repo.**

Va en el Server Component, donde ya tenemos el evento resuelto:

```tsx
// app/(site)/eventos/[slug]/page.tsx
export default async function Page({ params }: Props) {
  const { slug } = await params;
  const evento = await getEvento(slug);

  // Se emite como <script>, no con dangerouslySetInnerHTML sobre HTML:
  // JSON.stringify escapa el contenido, así que no hay vector de inyección.
  const jsonLd = evento && {
    "@context": "https://schema.org",
    "@type": "Event",
    name: evento.nombre,
    startDate: evento.fecha,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    image: evento.imagenPromocion ? [evento.imagenPromocion] : undefined,
    description: textoPlano(evento.descripcion),
    location: {
      "@type": "Place",
      name: evento.recinto?.nombre,
      address: {
        "@type": "PostalAddress",
        streetAddress: evento.recinto?.direccion,
        addressLocality: evento.ciudad?.nombre,
        addressCountry: "MX",
      },
    },
    performer: evento.artista?.nombre
      ? { "@type": "PerformingGroup", name: evento.artista.nombre }
      : undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "MXN",
      lowPrice: evento.precioBase,
      // Se calcula, NUNCA se pone fijo: el payload cacheado puede traer
      // disponibilidad de hasta 5 min atrás. Ver doc 02 → El caso especial.
      // Si esto no se puede garantizar fresco, es mejor omitir `availability`
      // que afirmar InStock: un evento agotado anunciado como disponible es
      // motivo de penalización manual.
      availability: hayDisponibilidad
        ? "https://schema.org/InStock"
        : "https://schema.org/SoldOut",
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/eventos/${slug}`,
    },
  };

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <EventoDetalleView />
    </>
  );
}
```

Notas:

- **Los campos tienen que reflejar la realidad.** Anunciar `InStock` en un evento agotado es motivo de
  penalización manual por parte de Google, no solo de perder el resultado enriquecido.
- Verificar con la **Prueba de resultados enriquecidos** de Google y con el validador de
  schema.org. Ambos aceptan pegar una URL.
- Para eventos multifecha, cada función es su propio `Event` con su `startDate`.

Aplica igual a `citypass/[slug]` (`Product` u `Offer`) y a las páginas de conferencia.

### 2. Slugs inválidos devuelven 200 (soft 404)

**Ninguna ruta del proyecto llama a `notFound()`.** Cero ocurrencias.

Cuando un slug no existe, `buildMetadataEvento` ya lo detecta y devuelve `{}` — bien hecho — pero la
página sigue respondiendo **200 con contenido vacío**. Google llama a eso *soft 404*: gasta
presupuesto de rastreo en la URL, la puede indexar vacía, y en Search Console aparece como error.

Pasa con eventos despublicados, slugs viejos que circulan en QR y enlaces mal copiados — o sea,
constantemente.

```tsx
import { notFound } from "next/navigation";

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const evento = await getEvento(slug);

  if (!evento) notFound();   // → 404 real + app/not-found.tsx

  return <EventoDetalleView slug={slug} />;
}
```

`app/not-found.tsx` ya existe, así que la página de error está resuelta. Solo falta lanzar.

### 3. Las rutas de evento no se prerenderizan

En la salida de `next build`, `/eventos/[slug]` sale marcada como `ƒ (Dynamic)`: se renderiza en cada
petición. Con `generateStaticParams` los eventos activos se prerenderizarían en build y se servirían
desde caché, revalidando por tiempo o por tag.

```tsx
export async function generateStaticParams() {
  const { eventosFiltrados = [] } = await getListaEventos();
  // Solo los que más tráfico reciben; el resto sigue siendo dinámico
  // bajo demanda (dynamicParams está en true por defecto).
  return eventosFiltrados
    .slice(0, 50)
    .map((e) => ({ slug: buildEventoSlug(e) }));
}
```

Beneficio doble: el crawler recibe HTML de caché, y el primer visitante de un evento popular no paga
el render. El endpoint de revalidación (doc 03) ya sabe invalidarlos por tag.

> Ojo: con `generateStaticParams`, `getListaEventos()` corre en build. Si el backend no responde
> durante el deploy, el build se queda sin rutas prerenderizadas — no falla, pero pierde el
> beneficio. Igual que `getSiteConfig`, conviene un `catch` que devuelva `[]`.

### 4. El sitemap no incluye CityPass

`app/sitemap.ts` tiene **cero menciones de citypass**. Las páginas públicas de ciudad y de paquete no
se le declaran a Google, aunque son contenido comercial indexable.

**Primero, un malentendido que conviene despejar:** el sitemap **ya es dinámico**. `app/sitemap.ts` no
es un archivo estático que haya que regenerar en cada deploy — es una función de servidor que consulta
el backend y se recalcula con `revalidate = 3600`. Lo único que falta es que consulte también CityPass.

La parte no obvia es el filtro. **No basta con listar todas las ciudades**: el landing público
responde `configurada: false` cuando la ciudad existe pero no tiene CityPass montado. Declarar
`/citypass/durango` sin CityPass configurado le da al crawler una página vacía, que Google cuenta como
soft 404 — el mismo problema del punto 2, autoinfligido.

Igual con los paquetes: sólo deberían entrar los que tienen `disponibleVenta: true`. Uno fuera de su
ventana de venta es una página que existe y no convierte.

#### Qué agregar a `app/sitemap.ts`

Los endpoints y los tipos ya existen, así que es sumar una función y llamarla:

```ts
import { slugify } from "@/utils/slugify";

// El landing responde `configurada: false` cuando la ciudad no tiene CityPass
// montado. Esa bandera decide si la URL entra al sitemap.
interface PaqueteLanding {
  nombre: string;
  disponibleVenta: boolean;
}

type Landing =
  | { configurada: false }
  | { configurada: true; paquetes?: PaqueteLanding[] };

// Mismo patrón que getEventos(): fetch directo (no la instancia axios, sus
// interceptores leen localStorage/window) y devolver vacío ante cualquier fallo.
const apiGet = async <T,>(path: string, tags: string[]): Promise<T | null> => {
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      headers: { "x-api-key": process.env.NEXT_PUBLIC_API_KEY ?? "" },
      cache: "force-cache",
      next: { revalidate: 3600, tags },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
};

const rutasCityPass = async (): Promise<MetadataRoute.Sitemap> => {
  const ciudades = await apiGet<{ id: number; nombre: string }[]>(
    "/ciudades/get_all_ciudades",
    ["ciudades"],
  );
  if (!ciudades?.length) return [];

  const porCiudad = await Promise.all(
    ciudades.map(async (ciudad) => {
      const ciudadSlug = slugify(ciudad.nombre);
      if (!ciudadSlug) return [];

      const landing = await apiGet<Landing>(
        `/citypass/publico/landing?ciudadId=${ciudad.id}`,
        ["ciudades", `citypass:${ciudadSlug}`],
      );

      // Ciudad sin CityPass, o backend sin responder: no se declara nada.
      if (!landing?.configurada) return [];

      return [
        {
          url: `${SITE_URL}/citypass/${ciudadSlug}`,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        },
        ...(landing.paquetes ?? [])
          .filter((p) => p.disponibleVenta && slugify(p.nombre))
          .map((paquete) => ({
            url: `${SITE_URL}/citypass/${ciudadSlug}/paquete/${slugify(paquete.nombre)}`,
            changeFrequency: "weekly" as const,
            priority: 0.6,
          })),
      ];
    }),
  );

  return porCiudad.flat();
};
```

Y en la función `sitemap()`, las dos fuentes en paralelo porque no dependen entre sí:

```ts
const [eventos, citypass] = await Promise.all([
  getEventos().then(construirRutasEventos),
  rutasCityPass(),
]);

return [...estaticas, ...eventos, ...citypass];
```

Detalles que importan:

- **La ruta se arma con `slugify(ciudad.nombre)` y `slugify(paquete.nombre)`**, que es exactamente lo
  que hace la UI en `publicUi/pages/CityPassPage.tsx:86`. Si divergen, el sitemap declara URLs que
  devuelven 404.
- **Es N+1** (una petición por ciudad), pero corre una vez por hora en el servidor y las llamadas van
  en paralelo. Con decenas de ciudades está bien; con cientos, conviene pedirle al backend un endpoint
  que liste las ciudades con CityPass configurado de una sola vez.
- **Cada landing lleva su tag `citypass:<slug>`**, ya presente en la allowlist de
  `app/api/revalidate/route.ts`, así que el backend puede invalidar una ciudad sin tocar las demás.

Verificar después con `npm run build` (la ruta debe salir como `○ /sitemap.xml` con revalidación de
1 h) y abriendo `http://localhost:3000/sitemap.xml` para confirmar que sólo aparecen las ciudades que
de verdad tienen CityPass.

### 5. Las cuatro páginas de legales están en el sitemap y no tienen contenido

Contradicción concreta: `sitemap.ts` declara las cuatro rutas de `/legales/*`, pero su contenido se
genera **en el navegador** — `await import("mammoth")` descarga un `.docx` y lo convierte dentro de un
`useEffect`. Cuando el crawler llega, no hay nada que indexar.

Convertir el `.docx` en el servidor con `revalidate: 86400` y el tag `legales` resuelve tres cosas a la
vez: el SEO de esas páginas, saca el parser de OOXML del bundle del navegador, y elimina uno de los
tres `dangerouslySetInnerHTML` sin sanitizar.

### 6. El sitemap no está paginado

Un `sitemap.xml` admite **50.000 URLs**. Hoy no es problema, pero como se emite una entrada por
función y otra por página de información, el conteo crece más rápido que el número de eventos. Si
llega a acercarse, hay que partirlo con `generateSitemaps`.

Es una nota para el futuro, no una tarea.

---

## B. Seguridad

### 7. No hay ninguna cabecera de seguridad

`next.config.ts` no define `headers()`. En un sitio que procesa pagos, al menos estas cuatro:

```ts
// next.config.ts
async headers() {
  return [
    {
      source: "/:path*",
      headers: [
        // Impide que el sitio se cargue en un <iframe> ajeno. En un flujo de
        // compra, esto es lo que bloquea el clickjacking: superponer un iframe
        // invisible del checkout sobre otra página.
        { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // Ninguna página necesita cámara, micrófono ni geolocalización.
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
      ],
    },
  ];
}
```

**Sobre una CSP completa (`script-src`, `style-src`…):** es lo correcto, pero hay que hacerlo con
cuidado y por etapas. El sitio carga los SDK de Google y Apple, `sweetalert2` inyecta estilos, y
`next/script` necesita nonces. Una CSP mal puesta rompe el login en producción sin dar señal en local.
El camino: empezar con `Content-Security-Policy-Report-Only`, recoger violaciones una o dos semanas, y
solo entonces pasar a modo bloqueo.

### 8. `/api/revalidate` no tiene límite de peticiones

El secreto compartido evita que un tercero invalide el caché, pero **no evita que lo sondee**: cada
POST con secreto incorrecto se procesa y responde. Cuesta nada intentarlo en bucle.

Añadir un límite por IP —10 peticiones por minuto es de sobra para lo que hace— cierra tanto el sondeo
del secreto como el riesgo de que un backend con un bug en su lógica de reintentos dispare
revalidaciones en masa.

### 9. `window.location.href` para navegación interna (6 sitios)

ESLint lo marca con `@next/next/no-location-assign-relative-destination`. Provoca una recarga completa
del documento: se pierde el estado del router, el caché del cliente y cualquier transición.

El más relevante es `api/apiApplication.ts:164` — el redirect a `/auth/login` cuando falla el refresh
del token. Ahí es defendible: se quiere justamente tirar todo el estado tras perder la sesión. Vale
la pena revisar los otros cinco, sobre todo `abonos/…:2374` y `EventoDetalleView.tsx:458`, que están
en flujos de compra donde una recarga puede costar una venta.

---

## C. Calidad de código

### 10. 26 errores bloquean el React Compiler

Next 16 soporta el **React Compiler**, que memoiza componentes automáticamente y elimina la necesidad
de escribir `useMemo` y `useCallback` a mano. En un proyecto con archivos de 2.000 líneas que
re-renderizan mucho, es la mejora de rendimiento con mayor alcance que queda — y no requiere tocar
componentes uno por uno.

Lo que lo impide: **26 errores de `react-hooks/immutability`**, todos de la misma forma —

```
Cannot access variable before it is declared
`handleSectionClick` is accessed before it is declared
```

Es un problema de zona muerta temporal (TDZ): un `useEffect` o un callback referencia un
`const handleAlgo = () => {}` **declarado más abajo en el archivo**. En runtime funciona, porque el
efecto corre después del render — pero el compilador no puede razonar sobre el orden y se rinde.

Concentrados en tres archivos: `abonos/[slug]/…/page.tsx` (6), `EventoDetalleView.tsx` (varios) y
`formConferenciaPage.tsx`. Se arregla moviendo las declaraciones arriba de su primer uso.

Después:

```bash
npm i -D babel-plugin-react-compiler
```

```ts
// next.config.ts
reactCompiler: true,
```

**En ese orden.** Activar el compilador con los 26 errores presentes no da beneficio: salta esos
componentes, que son justo los que más lo necesitan.

### 11. 27 × `setState` dentro de un efecto

`react-hooks/set-state-in-effect`. Cada uno provoca un render extra en cada carga: React pinta,
corre el efecto, cambia el estado, vuelve a pintar.

**Buena noticia:** muchos desaparecen solos al pasar los datos iniciales desde el servidor
(ver [doc 01](./01-servidor-primero.md)). El patrón `useState(null)` + `useEffect(() => setX(datos))`
se colapsa en `useState(datosDelServidor)`. No los persigas por separado: hazlo como parte de esa
migración.

### 12. 219 usos de `any`

El 73 % de los 301 errores de lint. No es solo higiene: los tipos `any` más peligrosos están en los
payloads de reserva y pago (`reservarAbono(abonoId, payload: any)`, `comprarAbono(payload: any)`),
donde un campo mal escrito no falla en compilación — falla como un 400 del backend a mitad de una
compra, o peor, como un cargo con el monto equivocado.

No hace falta una campaña. La regla práctica: **al tocar un archivo por cualquier otra razón, tipa lo
que atraviesas.** Y empieza por los DTOs de pago, que ya tienen tipos parciales en `types/`.

### 13. Falta un `key` en una lista

`eventos/pages/conferencias/DetalleConferencia.tsx:71` — `Missing "key" prop for element in iterator`.

Es un bug real, no estilo: sin `key`, React reconcilia por posición y puede reutilizar el nodo
equivocado cuando la lista cambia de orden o de tamaño. Se manifiesta como contenido que no se
actualiza o estado que salta de fila. Arreglo de un minuto.

### 14. 85 `console.log` en 27 archivos

Van a producción tal cual. Dos motivos para limpiarlos:

- **Privacidad**: hay que revisar cuáles imprimen respuestas del backend. Un `console.log(response)`
  en un flujo de compra deja datos de reserva en la consola del navegador del usuario.
- **Ruido**: cuando algo falla de verdad, el error útil se pierde entre logs de depuración.

Los `console.error` de los `catch` **se quedan**: esos sí sirven. Lo que sobra son los `console.log`
de desarrollo, como el `'No hay SVG disponible'` de `EventoDetalleView`.

Se puede automatizar con `compiler.removeConsole` en `next.config.ts`, dejando `error` fuera:

```ts
compiler: {
  removeConsole: process.env.NODE_ENV === "production"
    ? { exclude: ["error", "warn"] }
    : false,
},
```

Eso resuelve el ruido en producción de inmediato; la revisión de privacidad conviene hacerla igual.

---

## D. Accesibilidad

### 15. El mapa de asientos no es operable sin ratón

El SVG del recinto se inyecta con `dangerouslySetInnerHTML` y los manejadores se enganchan a las
secciones por `mouseenter`/`click`. Eso significa que **comprar un boleto numerado con teclado o con
lector de pantalla no es posible**.

No es un arreglo pequeño ni hay que rehacer el SVG. La salida razonable es ofrecer un camino
alternativo equivalente: una lista de secciones con precio y disponibilidad, navegable por teclado,
que haga lo mismo que el clic en el mapa. `ListaPreciosCategorias` ya existe y está cerca de eso.

Además de ser lo correcto, en varias jurisdicciones la venta al público tiene requisitos de
accesibilidad.

### 16. `alt` incompleto y pocos `aria-label`

47 `alt=""` (algunos legítimos para imágenes decorativas, otros no) y **2 `<img>` sin `alt` en
absoluto** —`jsx-a11y/alt-text` los marca—, uno en `abonos/…:2461`.

Y 38 `aria-label` para toda la aplicación es poco, considerando cuántos botones son solo un icono de
`react-icons` sin texto. Un botón cuyo contenido accesible es "" no se puede anunciar.

Regla al migrar a `next/image` (doc 06): `alt` descriptivo si la imagen aporta información,
`alt=""` **explícito** si es decorativa. Nunca omitirlo.

### 17. Tres `onClick` en `div` / `span`

No reciben foco ni responden a Enter o Espacio. Si es un control, es un `<button>`; si es navegación,
es un `<Link>`.

---

## E. Dependencias y tooling

### 18. Paquetes de tipos en `dependencies`

`@types/dompurify` y `@types/leaflet` están en `dependencies`, no en `devDependencies`. Los tipos no
existen en runtime.

Y `@types/dompurify` además **es redundante y potencialmente conflictivo**: DOMPurify 3.x trae sus
propios tipos (`"types": "./dist/purify.cjs.d.ts"` en su `package.json`). El paquete de
DefinitelyTyped es de la época de la 2.x.

```bash
npm uninstall @types/dompurify
npm i -D @types/leaflet   # lo reinstala como devDependency
```

### 19. Vulnerabilidad alta en `undici` — solo en desarrollo

`npm audit` reporta 1 vulnerabilidad alta. Cadena real:

```
taquillavip-next → jsdom@29.1.1 → undici@7.28.0
```

`jsdom` es una **devDependency** que solo usan los tests. **No llega al bundle ni al servidor de
producción.** No es urgente; se cierra actualizando `jsdom` cuando publiquen una versión con `undici`
parcheado. Conviene anotarlo para que nadie se asuste con el `npm audit` ni corra
`npm audit fix --force`, que podría romper la configuración de tests.

### 20. Prettier corre sin configuración

Hay evidencia de que Prettier pasó sobre el repo (comillas normalizadas, líneas reflowadas), pero no
existe `.prettierrc` ni `.prettierignore`. Sin config, cada máquina usa sus defaults o los del editor,
y los diffs se llenan de reformateo que nadie pidió — que es lo que hace ilegible un `git blame`.

Un `.prettierrc` de cuatro líneas y un `.prettierignore` que excluya `.next/`, `public/` y
`package-lock.json`.

### 21. El hook de pre-push existe pero es opt-in

`.githooks/pre-push` ya corre `typecheck` + `test` antes de cada push, y con buen criterio: deja el
build fuera porque tarda minutos y de eso se encarga CI.

El detalle es que **hay que activarlo a mano en cada clon**:

```bash
git config core.hooksPath .githooks
```

Nadie que clone el repo lo tiene activo hasta que lee el README y lo hace. No es un problema grave
—CI sigue gateando—, pero se puede automatizar con un script `prepare` en `package.json`, que npm
ejecuta solo después de `npm install`:

```json
"prepare": "git config core.hooksPath .githooks || true"
```

El `|| true` evita que falle en entornos sin git (contenedores de CI, por ejemplo).

### 22. Desajuste de variables de entorno en CI

Los dos CI —`.github/workflows/ci.yml` y `.gitlab-ci.yml`— definen `URL_BACKEND`, pero **ningún
archivo del proyecto lee esa variable**: el código usa `NEXT_PUBLIC_URL_BACKEND`. Y en ambos faltan
`NEXT_PUBLIC_TITLE_APP` y `NEXT_PUBLIC_TIMEZONE`.

Hoy no rompe porque todo tiene fallback, pero significa que **el build de CI no ejercita la misma
configuración que producción**. Y cuando se adopte la `API_KEY` server-only (ver `.env.example`), este
desajuste se vuelve un fallo silencioso: CI verde, producción sin llave.

Alinear el bloque `env` de los dos workflows con `.env.example`, que es ahora la fuente de verdad.

---

## F. Caché sin aprovechar

### 24. El fallback `/api/v1` no funciona en el servidor

Los cuatro consumidores de servidor comparten este helper:

```ts
const apiBase = (): string => {
  const url = process.env.NEXT_PUBLIC_URL_BACKEND;
  return url ? `${url}/api/v1` : "/api/v1";   // ← el fallback
};
```

En el navegador una ruta relativa funciona. **En el servidor, `fetch` exige URL absoluta.** Si falta
la variable, cada llamada lanza:

```
TypeError: Failed to parse URL from /api/v1/configuraciones/detail/1
```

Sale en el log del build, una vez por ruta prerenderizada. El `try/catch` lo captura, así que el build
pasa y el sitio arranca — **con la marca por defecto y el sitemap vacío, sin que nada falle de forma
visible**. Es el peor modo de fallo: silencioso y con apariencia de éxito.

Dos salidas, y la primera es mejor:

```ts
// Fallar al arrancar, no servir un sitio mal configurado durante horas.
const apiBase = (): string => {
  const url = process.env.NEXT_PUBLIC_URL_BACKEND;
  if (!url) throw new Error("Falta NEXT_PUBLIC_URL_BACKEND");
  return `${url}/api/v1`;
};
```

O dejar el fallback sólo para el cliente (`api/apiApplication.ts`, donde una ruta relativa sí es
válida) y exigir la variable en el código de servidor.

Se cruza con el punto 22: los dos CI corren el build **sin** `NEXT_PUBLIC_URL_BACKEND`, así que hoy
CI está ejercitando exactamente esta ruta de error y pasando en verde.

---

### 23. Faltan endpoints por cachear

La tabla del [doc 02](./02-cache-de-datos.md) lista siete candidatos. Implementados hay dos:
`config:sitio` y `eventos:lista`.

Sin cachear todavía, todos desde el navegador:

| Dato | Dónde se pide hoy | TTL propuesto | Tag |
|---|---|---|---|
| Ciudades | `useCiudadesStore`, en el layout de `(site)` | 24 h | `ciudades` |
| Paquetes de CityPass | `useCityPassStore` | 1 h | `citypass:<ciudad>` |
| Documentos de legales | `mammoth` en el navegador | 24 h | `legales` |

El de **ciudades** es el más claro: se pide en el layout, así que ocurre en **todas** las páginas del
grupo `(site)`, devuelve lo mismo para todos y cambia unas cuantas veces al año. Los tags ya están en
la allowlist de `app/api/revalidate/route.ts`, así que el backend puede invalidarlos desde el primer
día.

---

## Pendiente de la auditoría

Sigue vigente y sigue siendo el mejor cambio por esfuerzo:

**Pasarle a `EventoDetalleView` la cabecera del evento que el servidor ya trajo.** Hoy
`app/(site)/eventos/[slug]/page.tsx:16` renderiza `<EventoDetalleView />` sin props, así que el
navegador vuelve a resolver el slug y a pedir el detalle aunque `generateMetadata` acabe de hacerlo.

> ⚠️ **No pases el objeto `evento` completo.** `/eventos/:id/detalle` trae
> `secciones[].asientosDisponibles` en el mismo payload, y ese fetch está cacheado 5 minutos. Un mapa
> de asientos servido de caché vende el mismo asiento dos veces.
>
> Pasa un subconjunto **explícito** —`nombre`, `fecha`, `imagenPromocion`, `recinto`, `ciudad`,
> `descripcion`— y deja que el cliente pida la disponibilidad al montar con `no-store`. El detalle del
> patrón está en [doc 02 → El caso especial](./02-cache-de-datos.md#el-caso-especial-eventosiddetalle).

Con eso se elimina el primer salto de la cascada (resolver el slug), la cabecera y la imagen entran en
el HTML inicial —que es donde está la ganancia de LCP—, y de paso se resuelven varios de los 27
`set-state-in-effect` del punto 11. La disponibilidad sigue siendo tan fresca como hoy.

---

## Orden sugerido

Nada de esto es urgente. Si hay que elegir:

1. **`notFound()` en las rutas de evento** (punto 2) — 2 h, cierra una fuga de SEO que crece con cada evento despublicado.
2. **CityPass en el sitemap** (punto 4) — 2 h, el código está listo para pegar y sólo depende de endpoints que ya existen.
3. **Pasar la cabecera del evento al cliente** ([pendiente de la auditoría](#pendiente-de-la-auditoría)) — medio día, la mejor ganancia de rendimiento. **Subconjunto explícito, nunca el objeto completo.**
4. **Cabeceras de seguridad** (punto 7, sin CSP completa todavía) — 3 h, y `frame-ancestors` protege el checkout.
5. **JSON-LD `Event`** (punto 1) — 1 día, la mayor ganancia de SEO que queda.
6. **`removeConsole` + el `key` faltante + los `@types` mal ubicados** (puntos 14, 13, 18) — 1 h en total, todo mecánico.
7. **El fallback `/api/v1` y el env de CI** (puntos 24 y 22) — juntos, porque son el mismo problema visto de dos lados. Antes de adoptar `API_KEY` server-only.
8. **Los 26 errores de TDZ, y luego `reactCompiler: true`** (punto 10) — la mejora de rendimiento de mayor alcance.
9. **Cachear ciudades y legales** (punto 23) — cierra la tabla del doc 02.
10. **Accesibilidad del mapa de asientos** (punto 15) — proyecto propio, pero conviene ponerle fecha.

---

## Nota sobre este documento

Todo lo de aquí está **sin implementar a propósito**: son tareas del equipo, no cambios ya hechos. Los
bloques de código son para pegar y adaptar, no copias de algo que ya esté en el repo.

Las dos únicas cosas que sí se tocaron fuera de `docs/` son `.env.example` y su excepción en
`.gitignore`, porque el archivo se pidió explícitamente y no existía.
