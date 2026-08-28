# 04 — Metadatos y Open Graph para eventos

> Este es el documento al que apunta el comentario de cabecera de `utils/documentMeta.ts`.

## El problema

**Los scrapers de WhatsApp, Facebook, X, Telegram, Slack y LinkedIn no ejecutan JavaScript.** Piden el
HTML, leen las etiquetas `<meta>` que vengan en esa respuesta, y se van.

Hoy, el único `metadata` del proyecto está en `app/layout.tsx`, es estático, y **no tiene `images` ni
`metadataBase`**. Resultado concreto: cada evento compartido en WhatsApp muestra el mismo título
genérico «TaquillaVip», la misma descripción genérica, y ninguna imagen.

`hooks/usePageMeta.ts` inyecta las etiquetas correctas por DOM después de hidratar. Eso sirve para la
pestaña del navegador y para Google (que sí renderiza JS). **No sirve de nada al compartir**, y el
propio `utils/documentMeta.ts` lo dice en su cabecera.

## Por qué no es un arreglo pequeño

`metadata` y `generateMetadata` **sólo existen en Server Components**. Un archivo con `'use client'` no
los puede exportar — no es que se ignoren, es que no compilan.

32 de las 34 páginas abren con `'use client'`.

Por eso este documento depende del [doc 01](./01-servidor-primero.md): **primero hay que partir la
página en cáscara de servidor + isla de cliente.** No hay atajo.

## Paso 1 — Arreglar el layout raíz

Dos líneas que no cuestan nada y son prerrequisito de todo lo demás.

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  // Sin metadataBase, Next no puede absolutizar URLs relativas y los
  // scrapers descartan las og:image relativas en silencio.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),

  // Con template, cada página hija hereda el sufijo de marca y ya no
  // hace falta el hack de documentMeta.ts para el <title>.
  title: {
    default: TITLE_APP,
    template: `%s | ${TITLE_APP}`,
  },
  description: DESCRIPCION,
  icons: { icon: '/logo.svg' },
  openGraph: {
    type: 'website',
    siteName: TITLE_APP,
    title: TITLE_APP,
    description: DESCRIPCION,
  },
  twitter: { card: 'summary_large_image' },
};
```

Mejor aún: el título y la descripción de marca vienen del backend, así que en cuanto
`getSiteConfig()` esté en el servidor (ver [doc 02](./02-cache-de-datos.md)), esto pasa a ser un
`generateMetadata` y la marca queda correcta también para los scrapers.

## Paso 2 — Imagen OG de respaldo

Ahora mismo no hay **ninguna** imagen OG, ni genérica. Un solo archivo cubre Open Graph y Twitter a la
vez —Twitter cae a la de OG si no encuentra la suya— y arregla la mitad visible del problema sin tocar
un solo componente:

```
app/opengraph-image.png     ← 1200 × 630
```

Con eso, cualquier página compartida ya muestra una tarjeta con imagen. Si se prefiere generarla:

```tsx
// app/opengraph-image.tsx
import { ImageResponse } from 'next/og';   // de next/og, no de @vercel/og

export const alt = 'TaquillaVip';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ /* ... */ }}>TaquillaVip</div>
    ),
    size,
  );
}
```

No pongas `export const runtime = 'edge'` — el runtime Node.js por defecto es el correcto.

## Paso 3 — Metadatos por evento

El patrón completo. `DetalleEventoClient.tsx` es el archivo actual movido con `git mv`, sin cambios de
lógica más allá de sembrar el estado con los props.

```ts
// lib/data/eventos.ts
import { cache } from 'react';

export const getEvento = cache(async (slug: string) => {
  const res = await fetch(
    `${process.env.URL_BACKEND}/api/v1/eventos/slug/${encodeURIComponent(slug)}`,
    {
      headers: { 'x-api-key': process.env.API_KEY! },
      cache: 'force-cache',
      next: { revalidate: 300, tags: ['eventos:lista', `evento:${slug}`] },
    },
  );
  return res.ok ? res.json() : null;
});
```

```tsx
// app/(site)/eventos/[slug]/page.tsx
import type { Metadata } from 'next';
import { getEvento } from '@/lib/data/eventos';
import { textoPlano } from '@/utils/sanitizeHtml';
import { formatDate } from '@/utils/dateHelpers';
import DetalleEventoClient from './DetalleEventoClient';

export async function generateMetadata(
  { params }: PageProps<'/eventos/[slug]'>,
): Promise<Metadata> {
  const { slug } = await params;
  const evento = await getEvento(slug);

  // Evento inexistente o despublicado: título honesto, sin OG.
  if (!evento) return { title: 'Evento no disponible' };

  const titulo = evento.funcion?.nombre
    ? `${evento.nombre} — ${evento.funcion.nombre}`
    : evento.nombre;

  const descripcion =
    textoPlano(evento.descripcion, 200) ||
    [
      evento.fecha ? formatDate(evento.fecha, "d 'de' MMMM 'de' yyyy, hh:mm a") : '',
      evento.recinto?.nombre,
      evento.ciudad?.nombre,
    ].filter(Boolean).join(' · ');

  const imagen = evento.imagenPromocion;

  return {
    title: titulo,          // el template del layout le añade "| TaquillaVip"
    description: descripcion,
    alternates: { canonical: `/eventos/${slug}` },
    openGraph: {
      type: 'article',
      title: titulo,
      description: descripcion,
      url: `/eventos/${slug}`,   // relativa: metadataBase la absolutiza
      images: imagen
        ? [{ url: imagen, width: 1200, height: 630, alt: evento.nombre }]
        : undefined,             // undefined = hereda app/opengraph-image
    },
    twitter: {
      card: 'summary_large_image',
      title: titulo,
      description: descripcion,
      images: imagen ? [imagen] : undefined,
    },
  };
}

export default async function Page({ params }: PageProps<'/eventos/[slug]'>) {
  const { slug } = await params;

  // Misma llamada que arriba. cache() de React la ejecuta una sola vez
  // por render, así que no se duplica la petición al backend.
  const evento = await getEvento(slug);

  return <DetalleEventoClient slug={slug} eventoInicial={evento} />;
}
```

## Paso 4 — `textoPlano` isomorfo

`richTextToPlainText()` de `utils/sanitizeHtml.ts` usa `document.createElement`, así que **no corre en
el servidor** y no se puede usar en `generateMetadata`. Hace falta una versión sin DOM:

```ts
// utils/sanitizeHtml.ts — añadir junto a richTextToPlainText

const ENTIDADES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>',
  '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
};

/**
 * Texto plano a partir de HTML, sin depender del DOM.
 *
 * Sirve en servidor y en cliente, y es la que usa generateMetadata para
 * derivar la og:description de la descripción rich text del evento.
 *
 * OJO: esto NO es un sanitizador. Sólo quita etiquetas para producir texto.
 * Para pintar HTML sigue usando sanitizeRichText() con DOMPurify.
 */
export const textoPlano = (html?: string | null, maxLargo = 200): string => {
  if (!html) return '';

  const texto = html
    // Los bloques se convierten en espacio para que no se peguen palabras
    // entre párrafos: "<p>uno</p><p>dos</p>" → "uno dos", no "unodos".
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    // script y style con su contenido, antes de quitar etiquetas sueltas.
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;|&#\d+;/gi, (m) => ENTIDADES[m.toLowerCase()] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (texto.length <= maxLargo) return texto;
  return `${texto.slice(0, maxLargo - 1).trimEnd()}…`;
};
```

## Paso 5 — `sitemap.ts` y `robots.ts`

Van en `app/` y son dos archivos cortos. Sin ellos no se le declara nada al crawler: ni qué URLs
existen, ni cuáles no debería indexar.

```ts
// app/robots.ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/perfil/',
        '/auth/',
        '/terminar_compra',
        '/terminar_compra_abono',
        '/terminar_compra_conferencia',
        '/citypass/checkout/',
        '/citypass/terminar_compra/',
      ],
    },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
```

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next';
import { getListaEventos } from '@/lib/data/eventos';
import { buildEventoSlug } from '@/utils/eventoSlug';

// Se regenera cada hora; no se calcula en cada petición del crawler.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL!;

  const estaticas = ['', '/eventos', '/explorar', '/legales/terminos_y_condiciones']
    .map((ruta) => ({ url: `${base}${ruta}`, changeFrequency: 'weekly' as const }));

  const { eventosFiltrados = [] } = await getListaEventos();

  // Una entrada por función: cada fecha de un multifecha es una URL distinta.
  const eventos = eventosFiltrados.flatMap((evento) => {
    const funciones = evento.funciones?.length ? evento.funciones : [null];
    return funciones.map((funcion) => ({
      url: `${base}/eventos/${buildEventoSlug(evento, funcion)}`,
      lastModified: evento.actualizadoEn ? new Date(evento.actualizadoEn) : undefined,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));
  });

  return [...estaticas, ...eventos];
}
```

## Prerrequisitos

| Qué | Dónde | Estado |
|---|---|---|
| `GET /eventos/slug/:slug` | Backend | ⚠️ **Hoy responde 404.** Ver `TODO(slug)` en `hooks/useEventosStore.tsx` |
| `metadataBase` + `title.template` | `app/layout.tsx` | Dos líneas |
| `textoPlano()` isomorfo | `utils/sanitizeHtml.ts` | Paso 4 |
| `API_KEY` y `URL_BACKEND` sin `NEXT_PUBLIC_` | `.env` | Hoy la key va en el bundle del navegador |
| Partir la ruta en servidor + cliente | [doc 01](./01-servidor-primero.md) | El trabajo real |

> ⚠️ **Requiere backend**: sin `GET /eventos/slug/:slug`, `generateMetadata` tendría que descargar el
> listado completo de eventos para resolver un slug. Es posible y cacheable, pero caro y frágil.
> **Es la única dependencia externa de todo este plan: conviene pedirla ya.**

## Cómo verificar

**Esta es la única prueba válida:**

```bash
curl -s -A 'facebookexternalhit/1.1' https://taquillavip.com/eventos/tuff-riders \
  | grep -E 'og:|twitter:|<title>'
```

Las etiquetas tienen que estar **en esa respuesta**.

> **El inspector del navegador no sirve para validar OG.** Muestra el DOM después de hidratar, que
> incluye lo que `usePageMeta` inyectó — justo lo que el scraper nunca ve. Es la razón por la que un
> OG roto pasa la revisión manual sin que nadie lo note.

Después, para forzar el refresco de caché de cada plataforma:

- Facebook y WhatsApp comparten caché: el depurador de compartidos de Facebook, botón «Scrape Again».
- X: el validador de tarjetas.
- LinkedIn: el Post Inspector.
- Telegram: `@WebpageBot`.

WhatsApp cachea de forma agresiva y por URL. Si probaste una URL antes de que los metadatos
estuvieran, prueba con un parámetro distinto (`?v=2`) mientras validas.

## Qué se puede borrar al final

Cuando las cuatro rutas de contenido estén migradas:

- `hooks/usePageMeta.ts`
- `utils/documentMeta.ts`
- La llamada a `setMetaDeSitio()` en `context/ColorContext.tsx`

**No antes.** Mientras haya una ruta cliente que dependa de ellos, borrarlos deja esa ruta sin
`<title>`.
