# Glosario

Términos que aparecen en estos documentos, en las herramientas y en cualquier discusión sobre Next.
Ordenados por tema, no alfabéticamente, porque casi siempre se entienden en grupo.

---

## Métricas de rendimiento

Las tres primeras son los **Core Web Vitals**: las que Google usa como factor de posicionamiento y
las que salen en Lighthouse y en Search Console.

### LCP — Largest Contentful Paint
*Pintado del contenido más grande.* Cuánto tarda en aparecer el elemento visible más grande de la
pantalla: casi siempre la imagen principal o el titular. Es la métrica que mejor representa «¿ya
cargó?» desde la perspectiva del usuario.

**Bueno:** menos de 2,5 s. **Malo:** más de 4 s.

En este proyecto el LCP de `/eventos/[slug]` es la imagen de promoción, y hoy no empieza a descargarse
hasta que el navegador bajó el JavaScript, lo ejecutó, hidrató, pidió el evento a la API y recibió la
respuesta. Por eso el [doc 01](./01-servidor-primero.md) y el [doc 06](./06-imagenes.md) importan.

### CLS — Cumulative Layout Shift
*Desplazamiento acumulado del diseño.* Mide cuánto se mueve el contenido **después** de aparecer: ese
brinco molesto cuando entra una imagen sin espacio reservado y empuja el texto, o cuando la fuente
cambia y todo se recoloca. Se puntúa de 0 a 1.

**Bueno:** menos de 0,1.

Causas típicas aquí: `<img>` sin `width`/`height` (129 de ellos) y el cambio de fuente de respaldo a
Poppins.

### INP — Interaction to Next Paint
*Interacción hasta el siguiente pintado.* Cuánto tarda la interfaz en responder visualmente a un
clic o un tecleo. Sustituyó a FID en 2024.

**Bueno:** menos de 200 ms.

Empeora cuando hay demasiado JavaScript ejecutándose en el hilo principal — de ahí el
[doc 08](./08-code-splitting.md).

### FCP — First Contentful Paint
*Primer pintado con contenido.* Cuándo aparece el primer pixel de contenido real: texto, imagen, lo
que sea que no es fondo en blanco. Llega antes que el LCP.

Una hoja de estilos externa en el `<head>` —como el `<link>` a Google Fonts— retrasa el FCP porque
bloquea el render.

### TTFB — Time To First Byte
*Tiempo hasta el primer byte.* Cuánto tarda el servidor en empezar a responder. Depende de red,
servidor y de si la respuesta salió de caché.

Al mover peticiones al servidor, el TTFB puede **subir** un poco (el servidor hace más trabajo antes
de responder) mientras el LCP **baja** mucho (el navegador ya no hace tres viajes). Es un intercambio
deseable: no te asustes si ves subir el TTFB.

### First Load JS
No es un Core Web Vital: es una cifra que imprime `next build`. El JavaScript total que el navegador
debe descargar y ejecutar para que una ruta sea interactiva. **Es el número que se mira antes y
después de cada PR de migración.**

### Lighthouse
La herramienta de auditoría integrada en Chrome DevTools. Mide todo lo anterior. Úsala siempre en
**modo móvil con throttling**, que es lo que se parece a un usuario real; en escritorio sin throttling
todo sale verde y no sirve de nada.

---

## Renderizado

### CSR — Client-Side Rendering
*Renderizado en el cliente.* El servidor manda un HTML prácticamente vacío y el JavaScript construye
la página en el navegador. Es lo que hace una SPA de React + Vite, y **es lo que hace este proyecto
hoy** aunque use Next.

### SSR — Server-Side Rendering
*Renderizado en el servidor.* El servidor genera el HTML completo en cada petición y lo manda ya
pintado. El usuario ve contenido antes de que baje el JavaScript, y los buscadores y scrapers lo leen
sin ejecutar nada.

### SSG — Static Site Generation
*Generación estática.* El HTML se genera una vez, en build, y se sirve igual a todos. Rapidísimo,
pero sólo sirve para contenido que no cambia entre despliegues.

### ISR — Incremental Static Regeneration
*Regeneración estática incremental.* El punto medio, y lo que usamos: se sirve una versión estática
cacheada y se regenera cada cierto tiempo (`revalidate`) o cuando alguien lo pide explícitamente
(`revalidateTag`). Ver [doc 02](./02-cache-de-datos.md) y [doc 03](./03-revalidacion-desde-el-backend.md).

### RSC — React Server Components
El modelo de React que permite que un componente se ejecute **sólo** en el servidor y nunca se mande
al navegador. Es la base del App Router.

### Server Component
Componente que se ejecuta en el servidor. Puede ser `async`, hacer `fetch`, leer variables de entorno
privadas. **No manda JavaScript al navegador.** Es lo que es un archivo por defecto en `app/`, sin
hacer nada.

### Client Component
Componente marcado con `'use client'`. Se ejecuta en el navegador (y también en el servidor para
generar el HTML inicial). Puede usar `useState`, `useEffect`, `onClick` y APIs del navegador.

### Boundary (límite servidor/cliente)
El punto donde `'use client'` corta el árbol. Todo lo que está por debajo va al navegador. **La
directiva no es una etiqueta que describe un componente: es un límite que marca dónde empieza el
bundle.** Confundir esas dos cosas es lo que produjo el estado actual del repo.

### Hidratación
Cuando el navegador recibe el HTML del servidor, React lo «revive»: engancha los manejadores de
eventos al DOM que ya existe, en vez de crearlo de cero. Después de hidratar, la página es
interactiva.

### Error de hidratación (*hydration mismatch*)
El HTML que generó el servidor y el que React calcula en el cliente no coinciden. Causas típicas:
leer `window`, `localStorage` o `Date.now()` durante el render. Aparece como un aviso rojo en consola
y puede provocar que React tire el HTML del servidor y vuelva a pintar todo.

Ejemplo real en este repo: `useLocation()` de `nextRouterCompat` lee `window.location.search` en el
render — en el servidor da `''` y en el cliente da otra cosa. Ver [doc 09](./09-adios-react-router.md).

### Prerender
Generar el HTML por adelantado, en build o al revalidar, en vez de en cada petición.

### Streaming
Mandar el HTML por trozos según se va generando, en vez de esperar a tenerlo todo. Permite enseñar la
cabecera y el esqueleto mientras una parte lenta sigue cargando. Es lo que habilitan `loading.tsx` y
`<Suspense>`.

### Suspense boundary
Un `<Suspense fallback={...}>` que envuelve una parte del árbol. Mientras esa parte no está lista, se
muestra el fallback y el resto de la página ya se ve. En App Router es obligatorio alrededor de
`useSearchParams()` en rutas prerenderizadas, o `next build` falla.

### App Shell
La parte de la página que se puede prerenderizar y servir de inmediato —cabecera, navegación,
esqueleto— mientras el contenido dinámico llega por streaming.

---

## Bundle y carga

### Bundle
El JavaScript compilado y empaquetado que se manda al navegador.

### Chunk
Cada trozo en que se parte el bundle. Next crea uno por ruta automáticamente, y `next/dynamic` crea
más.

### Code-splitting
Partir el bundle en chunks para que el navegador baje sólo lo que necesita. Ver
[doc 08](./08-code-splitting.md).

### Tree-shaking
Que el compilador descarte el código que nadie importa. Funciona bien con módulos ES
(`import`/`export`) y mal con CommonJS (`require`). Es la razón por la que `date-fns` es preferible a
`moment`: de `date-fns` te llevas las tres funciones que usas; `moment` es un bloque monolítico.

### Barrel file
Un `index.ts` que reexporta muchas cosas (`export * from './x'`). Cómodo, pero puede hacer que
importar una función arrastre el módulo entero. `optimizePackageImports` de Next existe para
mitigarlo; `react-icons` y `date-fns` ya vienen en esa lista por defecto.

### Lazy loading (carga diferida)
Cargar algo sólo cuando hace falta: un modal al abrirlo, una imagen al entrar en pantalla.

### Render-blocking
Un recurso que impide al navegador pintar hasta que se descarga. Las hojas de estilo en el `<head>` lo
son — por eso el `<link>` a Google Fonts retrasa el FCP.

---

## Datos y caché

### TTL — Time To Live
*Tiempo de vida.* Cuánto vale un dato cacheado antes de considerarse viejo. En Next es
`next: { revalidate: N }`, en segundos.

### Revalidación
Refrescar un dato cacheado. **Por tiempo** (se cumplió el TTL) o **bajo demanda** (alguien llamó a
`revalidateTag`).

### Cache tag
Una etiqueta que se le pone a un dato cacheado (`next: { tags: ['config:sitio'] }`) para poder
invalidarlo después por nombre, sin saber en qué páginas se usa.

### `stale-while-revalidate`
*Viejo mientras se revalida.* Servir el dato viejo de inmediato y refrescarlo por detrás, para que
nadie espere. Es lo que hace `revalidateTag(tag, 'max')`. Lo contrario es expirar de golpe
(`{ expire: 0 }`), donde la siguiente petición sí espera datos frescos.

### Stale
Un dato cacheado que ya cumplió su TTL y se considera viejo, aunque todavía se pueda servir.

### Memoización
Recordar el resultado de una función **durante un solo render** para no repetirla. `fetch` con GET se
memoiza solo; para lo demás está `cache()` de React. No confundir con el caché persistente: la
memoización dura una petición, el caché dura entre peticiones y usuarios.

### Waterfall (cascada)
Peticiones en serie donde cada una espera a la anterior. Tres peticiones de 200 ms en cascada son
600 ms; en paralelo, 200 ms. `/eventos/[slug]` tiene hoy una cascada de tres.

### Opt-in / opt-out
*Hay que pedirlo* / *hay que rechazarlo*. En Next 16 el caché de `fetch` es **opt-in**: sin opciones
no se cachea. En Next 13/14 era opt-out, y por eso casi todos los tutoriales que encuentres describen
otro comportamiento.

### Route Handler
Un archivo `route.ts` dentro de `app/` que define un endpoint HTTP propio del front (por ejemplo
`app/api/revalidate/route.ts`). El equivalente App Router de las viejas API routes.

### Server Action
Una función marcada con `'use server'` que se ejecuta en el servidor pero se invoca desde el cliente,
normalmente desde un formulario. No la usamos todavía.

---

## Web y SEO

### Scraper
Un bot que pide una URL y lee el HTML. Los de WhatsApp, Facebook, X, Telegram, Slack y LinkedIn
generan la vista previa al compartir un enlace. **No ejecutan JavaScript**, así que sólo ven lo que el
servidor puso en el HTML. Esa frase es todo el [doc 04](./04-metadatos-og-eventos.md).

### Open Graph (OG)
El estándar de etiquetas `<meta property="og:*">` que define título, descripción e imagen de la vista
previa al compartir. Lo inventó Facebook y lo usa casi todo el mundo.

### Twitter Card
Lo mismo para X, con etiquetas `<meta name="twitter:*">`. Si no las encuentra, cae a las de Open
Graph — por eso una sola imagen OG suele bastar.

### Canonical
`<link rel="canonical">`. Le dice a Google cuál es la URL «oficial» de un contenido, para que dos URLs
que muestran lo mismo no compitan entre sí ni se penalicen como contenido duplicado.

### `metadataBase`
La URL base que Next usa para convertir rutas relativas de metadatos en absolutas. Sin ella, una
`og:image` relativa se manda tal cual y los scrapers la descartan.

### Sitemap
`sitemap.xml`: la lista de URLs del sitio que le declaras a los buscadores.

### robots.txt
El archivo que le dice a los crawlers qué pueden y qué no pueden rastrear. Aquí sirve para mantener
checkout y perfil fuera del índice.

### Crawl budget (presupuesto de rastreo)
Cuántas páginas de tu sitio rastrea Google en un periodo. Si tiene que ejecutar JavaScript para ver
cualquier contenido, rinde mucho menos.

### `srcset` y `sizes`
`srcset` es la lista de versiones de una imagen en distintos anchos; `sizes` le dice al navegador qué
ancho va a ocupar en pantalla para que elija bien. `next/image` genera el `srcset`; el `sizes` lo
escribes tú, y si falta el navegador asume lo peor.

### FOUT / FOIT
*Flash of Unstyled Text* / *Flash of Invisible Text.* El parpadeo al cargar una fuente web: o se ve
primero con la fuente de respaldo y luego cambia (FOUT), o no se ve nada hasta que carga (FOIT).
`next/font` ajusta las métricas de la fuente de respaldo para que el cambio no mueva nada.

### Subset (subconjunto)
Recortar una fuente a los caracteres que necesitas. `subsets: ['latin']` evita bajar griego, cirílico
y vietnamita.

### Self-hosting (auto-hospedar)
Servir un recurso desde tu propio dominio en vez de uno externo. `next/font` auto-hospeda las Google
Fonts: menos latencia, sin dependencia de terceros, y sin mandar la IP de cada visitante a Google.

---

## Seguridad

### XSS — Cross-Site Scripting
Inyectar JavaScript malicioso en una página para que se ejecute en el navegador de otros usuarios.
En React el riesgo llega casi siempre por `dangerouslySetInnerHTML`.

### Sanitizar
Limpiar HTML de terceros dejando sólo etiquetas y atributos de una lista permitida.
`utils/sanitizeHtml.ts` lo hace con DOMPurify. **Quitar etiquetas para sacar texto plano no es
sanitizar** — son operaciones distintas con propósitos distintos.

### Allowlist / denylist
*Lista de permitidos* / *lista de bloqueados*. La allowlist es siempre más segura: permite lo
conocido y rechaza el resto. La denylist se queda corta en cuanto aparece algo que no previste.

### `httpOnly`
Atributo de cookie que impide leerla desde JavaScript. Una sesión en cookie `httpOnly` sobrevive a un
XSS; una en `localStorage` no, porque cualquier script de la página la puede leer.

### `NEXT_PUBLIC_`
El prefijo que Next usa para decidir qué variables de entorno se inlinean en el bundle del navegador.
**Significa literalmente «publica esto».** Una variable con ese prefijo la puede leer cualquiera con
Ctrl+U. Nunca para secretos.

### Timing-safe comparison
Comparar dos cadenas en tiempo constante, sin cortar en la primera diferencia. Evita que un atacante
deduzca un secreto midiendo cuánto tarda la comparación. `timingSafeEqual` de Node lo hace.
