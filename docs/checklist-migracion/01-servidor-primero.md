# 01 — Servidor primero: cómo dejar de usar `'use client'`

## Lo que `'use client'` significa de verdad

La confusión que causó el estado actual del repo es esta: `'use client'` parece decir _«este
componente es interactivo»_. No es eso.

> `'use client'` marca **el punto donde empieza el bundle del navegador**.

Todo lo que ese archivo importe —y todo lo que esos archivos importen, recursivamente— se empaqueta y
se manda al navegador. Es un límite, no una etiqueta.

Poner `'use client'` en `page.tsx` es poner ese límite en la raíz del árbol. Debajo de la raíz no
queda nada, así que **la página entera se vuelve cliente**: no puede exportar `generateMetadata`, no
puede hacer fetch en el servidor, no puede leer variables de entorno privadas, y no manda ni un
carácter de contenido en el HTML inicial.

**La regla es una sola: `'use client'` va en las hojas, no en las raíces.**

## ¿De verdad lo necesita?

Sólo hay cuatro razones legítimas. Si ninguna aplica, el archivo no lleva la directiva:

1. `useState`, `useReducer` o cualquier estado de React.
2. Manejadores de eventos: `onClick`, `onChange`, `onSubmit`.
3. `useEffect` o cualquier hook de ciclo de vida.
4. APIs del navegador: `window`, `document`, `localStorage`, `navigator`.

Lo que **no** es razón para `'use client'`:

- Que el componente reciba props. Los Server Components reciben props.
- Que renderice una lista. Los Server Components renderizan listas.
- Que use `react-icons`. Un icono es un `<svg>`; en un Server Component se renderiza en el servidor y
  **no manda JavaScript al navegador**. Migrar un icono a servidor es ganancia neta.
- Que use Tailwind, `clsx`, o cualquier cosa de CSS. El CSS no tiene nada que ver con este límite.
- Que use `<Link>` de `next/link`. Funciona en servidor.
- Que llame a `formatDate` o `formatearDinero`. Son funciones puras.

## El patrón: cáscara de servidor + isla de cliente

```
app/(site)/eventos/[slug]/
├── page.tsx                 ← Server Component: metadata, fetch, params
└── DetalleEventoClient.tsx  ← 'use client': el componente actual, tal cual
```

`page.tsx` hace tres cosas y nada más: resolver `params`, traer los datos, y pasarlos como props.
El componente cliente sigue siendo el mismo archivo de 1.987 líneas — **no hay que reescribirlo**.

```tsx
// app/(site)/eventos/[slug]/page.tsx
import type { Metadata } from "next";
import { getEvento } from "@/lib/data/eventos";
import DetalleEventoClient from "./DetalleEventoClient";

export async function generateMetadata({
  params,
}: PageProps<"/eventos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const evento = await getEvento(slug);
  return { title: evento?.nombre ?? "Evento no disponible" };
  // versión completa con Open Graph en docs/04-metadatos-og-eventos.md
}

export default async function Page({ params }: PageProps<"/eventos/[slug]">) {
  const { slug } = await params;

  // Misma llamada que en generateMetadata. No se duplica la petición:
  // ver "Memoización" en docs/02-cache-de-datos.md.
  const evento = await getEvento(slug);

  return <DetalleEventoClient slug={slug} eventoInicial={evento} />;
}
```

> **`params` y `searchParams` son promesas.** Desde Next 15 hay que hacerles `await`. En Server
> Components se resuelve con `await`; los tipos `PageProps<'/ruta'>` y `LayoutProps<'/ruta'>` los
> genera Next a partir del árbol de rutas y ya están activos en este repo (`app/layout.tsx` usa
> `LayoutProps<"/">`). Úsalos en lugar de escribir el tipo a mano.

## Receta para partir una página existente

Seis pasos, sin reescribir lógica. Un PR por ruta.

**1. Renombrar, preservando el historial de git**

```bash
git mv "app/(site)/eventos/[slug]/page.tsx" \
       "app/(site)/eventos/[slug]/DetalleEventoClient.tsx"
```

Usa `git mv`, no copiar y pegar: si no, git ve un archivo borrado y otro nuevo y `git blame` se pierde
en 2.000 líneas.

**2. Cambiar el export por uno nombrado**

En `DetalleEventoClient.tsx`, el `export default function DetalleEventoPage()` pasa a recibir props:

```tsx
"use client"; // se queda: este archivo sí es cliente

export default function DetalleEventoClient({
  slug,
  eventoInicial,
}: {
  slug: string;
  eventoInicial: Evento | null;
}) {
  // ...
}
```

**3. Sembrar el estado con los props en vez de con `useEffect`**

Este es el único cambio de lógica, y es el que da la ganancia. El patrón actual:

```tsx
// ANTES — tres saltos de red en serie, todos después de hidratar
const [resuelto, setResuelto] = useState<EventoResuelto | null>(null);
const [evento, setEvento] = useState<Evento | null>(null);

useEffect(() => {
  resolverSlugEvento(slug).then(setResuelto); // salto 1
}, [slug]);

useEffect(() => {
  if (resuelto?.eventoId) {
    getDetalleEventos(resuelto.eventoId).then(setEvento); // salto 2
  }
}, [resuelto]);
```

```tsx
// DESPUÉS — el servidor ya lo trajo; el navegador arranca con datos
const [evento, setEvento] = useState<Evento | null>(eventoInicial);
```

Los `useEffect` que sólo servían para la carga inicial se borran. Los que responden a interacción del
usuario (cambiar de función, seleccionar sección) se quedan igual.

**4. Crear el `page.tsx` de servidor**

El de arriba. Sin `'use client'`, sin hooks.

**5. Borrar `usePageMeta`**

Cuando `page.tsx` es servidor, `generateMetadata` es la fuente de verdad de `<title>` y los `og:*`.
`hooks/usePageMeta.ts` y `utils/documentMeta.ts` dejan de hacer falta en esa ruta. **No los borres
del repo hasta que las cuatro rutas de contenido estén migradas**, porque las demás siguen
dependiendo de ellos.

**6. Verificar que el límite se movió**

```bash
npm run build
```

Busca la ruta en la tabla de salida y mira **First Load JS**. Si no bajó, el límite no se movió:
probablemente `page.tsx` sigue importando algo que arrastra `'use client'`.

## Qué puede cruzar el límite servidor → cliente

Los props que un Server Component pasa a un Client Component se serializan. Si mandas algo que no se
puede serializar, el error aparece en runtime y a veces sólo en producción.

**Sí cruzan:** `string`, `number`, `boolean`, `null`, `undefined`, objetos planos, arrays, `Date`,
`Map`, `Set`, `TypedArray`, `ArrayBuffer`, elementos de React (como `children`), y Server Actions.

**No cruzan:** funciones normales, instancias de clase, `Symbol`, `WeakMap`, `WeakSet`, **instancias
de `URL`**.

Dos que muerden en este proyecto:

- **Los objetos de axios no cruzan.** `error` de un `catch` de axios es una instancia de clase. Si
  quieres pasar el error al cliente, pasa `{ mensaje: string }`.
- **`new URL(...)` no cruza.** Pasa el string.

## Cómo NO propagar el límite

### Providers: reciben `children` y no contaminan

Un provider cliente que envuelve `children` **no convierte a sus children en clientes**. React
context no existe en Server Components, así que el provider tiene que ser cliente — pero los hijos
que le pasa un layout de servidor siguen renderizándose en el servidor.

Por eso `app/providers.tsx` puede seguir siendo `'use client'` sin problema, y por eso
`app/layout.tsx` es un Server Component aunque renderice `<Providers>`.

### El caso `ColorContext`: config del servidor, contexto en el cliente

Hoy `context/ColorContext.tsx` pide `/configuraciones/detail/1` en un `useEffect`. De esa respuesta
dependen el logo, los cinco colores de marca, el título y los pixels — así que **todo el chrome del
sitio espera un fetch del navegador**, y el usuario ve el salto de colores por defecto a colores de
marca en cada carga.

El provider puede seguir siendo cliente. Lo que cambia es de dónde le llegan los datos:

```tsx
// app/layout.tsx  (Server Component, sin 'use client')
import { getSiteConfig } from "@/lib/config/getSiteConfig";
import { Providers } from "./providers";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { config, colors } = await getSiteConfig(); // cacheado, ver doc 02

  return (
    <html
      lang="es"
      className="h-full"
      // Los colores entran en el HTML inicial: se va el salto visual.
      style={
        {
          "--color-emphasis": colors.emphasis,
          "--color-accent-base": colors.accentBase,
          "--color-accent-light": colors.accentLight,
          "--color-neutral": colors.neutral,
          "--color-darker": colors.darker,
        } as React.CSSProperties
      }
    >
      <body className="min-h-full flex flex-col antialiased">
        <Providers configInicial={config} coloresIniciales={colors}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

```tsx
// context/ColorContext.tsx  — sigue siendo 'use client'
export const ColorConfigProvider = ({
  children,
  configInicial,
  coloresIniciales,
}: {
  children: ReactNode;
  configInicial: ConfigResponse | null;
  coloresIniciales: Colors;
}) => {
  // Nace con datos. Ya no hay useState(DEFAULT_COLORS) + useEffect(loadConfig).
  const [config, setConfig] = useState(configInicial);
  const [colors, setColors] = useState(coloresIniciales);

  // applyColorsToDocument() se puede borrar: el servidor ya puso las CSS vars
  // en <html style>. reloadConfig() se queda si algo lo necesita en runtime.
  // ...
};
```

Ganancias: se va una petición de la ruta crítica de **todas** las páginas, se va el salto de color, y
`getSiteConfig()` puede usar una API key que no viaja al navegador.

`src/lib/config/getSiteConfig.ts` ya existe en el repo y hace casi esto. Está en el árbol muerto
`src/` (que `tsconfig.json` excluye), así que hay que moverlo a `lib/config/` para que compile.

### Componentes que sólo son cliente por una parte pequeña

Si un componente de 200 líneas es cliente por un botón, extrae el botón:

```tsx
// EventoHeader.tsx — Server Component, no manda JS
export function EventoHeader({ evento }: { evento: Evento }) {
  return (
    <header>
      <h1>{evento.nombre}</h1>
      <p>{formatDate(evento.fecha, "d 'de' MMMM")}</p>
      <BotonCompartir url={`/eventos/${evento.slug}`} /> {/* la única isla */}
    </header>
  );
}
```

## Anti-patrones a vigilar en este repo

### `'use client'` en un archivo de utilidades

Si `utils/algo.ts` lleva la directiva, **todo el que lo importe se vuelve cliente**. Es la forma más
fácil de deshacer el trabajo de una migración sin darse cuenta.

Caso concreto: `utils/nextRouterCompat.tsx` es `'use client'`. Cualquier `page.tsx` de servidor que lo
importe se rompe. **No lo uses en código nuevo** — usa `next/link` y `next/navigation` directamente.

### Hooks que devuelven objetos literales nuevos en cada render

```tsx
// hooks/useEventosStore.tsx — el patrón actual
export const useEventosStore = () => {
  const getListaEventos = async () => {
    /* ... */
  };
  return { getListaEventos /* ...18 funciones más */ }; // objeto nuevo cada render
};
```

Cada render crea funciones nuevas, así que cualquier `useEffect` que las liste como dependencia
corre en bucle. Por eso hay tres `eslint-disable react-hooks/exhaustive-deps` en
`app/(site)/layout.tsx`: **la regla estaba señalando este problema, no dando un falso positivo.**

Al migrar, estas funciones no necesitan ser un hook. No usan estado ni contexto: son fetches.
Conviértelas en funciones sueltas en `lib/data/`:

```ts
// lib/data/eventos.ts — sin hook, usable desde servidor y cliente
export async function getDetalleEvento(id: string) {
  /* ... */
}
```

Desde un Server Component se llaman directo. Desde un Client Component, igual que ahora. Y se van los
`eslint-disable`.

### `dangerouslySetInnerHTML` con datos del backend

Hay tres sin sanitizar en el repo (`eventos/[slug]/page.tsx:863` y `:1440`, y las tres páginas de
legales). `utils/sanitizeHtml.ts` ya existe y está bien hecho: úsalo.

Ojo al migrar: `richTextToPlainText()` usa `document.createElement`, así que **no corre en el
servidor**. Si la necesitas en `generateMetadata`, hace falta una versión sin DOM
(ver [doc 04](./04-metadatos-og-eventos.md)).

## Orden sugerido de migración

Las cuatro rutas de contenido primero, porque son las que ganan OG y SEO:

1. `app/(site)/eventos/informacion/[slug]` — 228 líneas, la más pequeña. **Empieza aquí**: sirve para
   aprender el patrón con poco riesgo.
2. `app/(site)/eventos/[slug]` — 1.987 líneas. La de más tráfico.
3. `app/(site)/citypass/[slug]`
4. `app/(site)/abonos/[slug]/[seccionId]/[seccion]` — 2.493 líneas. La última, ya con el patrón
   rodado.

Las de perfil, checkout y transferencias **pueden quedarse cliente**: son privadas, no las indexa
nadie, no se comparten en redes, y necesitan el token que hoy vive en `localStorage`. Migrarlas
requiere primero mover la sesión a una cookie `httpOnly`, que es un proyecto aparte.

## Cómo medir que funcionó

```bash
npm run build
```

Mira **First Load JS** por ruta antes y después.

Para ver qué hay dentro del bundle:

```bash
npm i -D @next/bundle-analyzer
ANALYZE=true npm run build
```

Y la prueba que de verdad importa, porque es literalmente lo que ve un scraper y lo que ve Google
antes de ejecutar JavaScript:

```bash
curl -s http://localhost:3000/eventos/tuff-riders | grep -o "<title>.*</title>"
```

Si ahí aparece el nombre del evento, la migración de esa ruta funcionó. Si aparece «TaquillaVip», el
`'use client'` sigue en la raíz.

