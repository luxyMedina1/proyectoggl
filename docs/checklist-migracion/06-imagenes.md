# 06 — Imágenes con `next/image`

## Por qué existe este componente

Un `<img src="...">` normal hace una sola cosa: descarga ese archivo exacto y lo pinta. Si el
backend subió un JPG de 3000 px y el usuario lo ve en un celular a 350 px, el celular descarga los
3000 px completos y luego los encoge.

`next/image` renderiza un `<img>` real, pero además:

- **Redimensiona en el servidor.** Genera varias versiones y le manda a cada dispositivo la que le
  toca, con `srcset` (ver [glosario](./glosario.md)).
- **Convierte a formatos modernos** (WebP, AVIF), que pesan bastante menos que JPG o PNG con la misma
  calidad visual.
- **Reserva el espacio antes de cargar**, lo que evita el salto de layout (**CLS**) — ese brinco que
  da la página cuando entra una imagen y empuja el texto hacia abajo.
- **Carga diferida** de lo que está fuera de pantalla.
- **Cachea el resultado** para que la conversión se haga una vez, no por visitante.

Nada de eso lo hace un `<img>`. Hoy el repo tiene **129 `<img>` y cero `next/image`**.

## Paso 0 — `remotePatterns` (sin esto el build falla)

Next no optimiza imágenes de cualquier dominio: sería un servicio gratuito de procesamiento para
quien pase una URL. Hay que declarar los hosts permitidos **antes** de migrar el primer componente.

Primero averigua de dónde vienen. Abre el sitio, inspecciona una imagen de evento y copia el dominio
de `evento.imagenPromocion`, o pregúntale al backend:

```bash
# Otra forma: mira qué host devuelve la API
curl -s "$URL_BACKEND/api/v1/configuraciones/detail/1" | grep -o 'https://[^"]*' | head
```

```ts
// next.config.ts
import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  outputFileTracingRoot: path.join(__dirname),

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.tudominio.com',   // ← el host real del backend
        pathname: '/**',                 // cualquier ruta de ese host
      },
      // Si las imágenes viven en S3 o similar, una entrada por bucket:
      // { protocol: 'https', hostname: 's3.amazonaws.com', pathname: '/mi-bucket/**' },
    ],
  },
};

export default nextConfig;
```

Sé lo más específico que puedas en `pathname`. `hostname: '**'` funciona y es exactamente lo que no
hay que hacer.

## La migración básica

```tsx
// ANTES
<img src={evento.imagenPromocion} alt={evento.nombre} className="w-full rounded" />

// DESPUÉS
import Image from 'next/image';

<Image
  src={evento.imagenPromocion}
  alt={evento.nombre}
  width={800}
  height={450}
  className="w-full h-auto rounded"
/>
```

**`width` y `height` son obligatorios** (salvo con `fill`, ver abajo). No son el tamaño en pantalla:
son la **proporción** que Next usa para reservar el espacio. El tamaño real lo pone el CSS. Por eso
`className="w-full h-auto"` sigue mandando.

Si no sabes las dimensiones exactas, pon la proporción correcta: `width={800} height={450}` para 16:9
funciona igual que `1600×900`.

## `fill` — cuando el contenedor manda

Para imágenes que llenan un contenedor de tamaño desconocido (tarjetas, carruseles, banners):

```tsx
<div className="relative aspect-video w-full overflow-hidden rounded">
  <Image
    src={evento.imagenPromocion}
    alt={evento.nombre}
    fill
    sizes="(max-width: 768px) 100vw, 33vw"
    className="object-cover"
  />
</div>
```

Tres requisitos, y si falta uno la imagen desaparece o se sale:

1. El contenedor necesita `position: relative` (`relative` en Tailwind).
2. El contenedor necesita altura propia: `aspect-video`, `aspect-square`, `h-64`…
3. `object-cover` u `object-contain` en la imagen, no en el div.

## `sizes` — el que todo el mundo olvida

`sizes` le dice al navegador **qué ancho va a ocupar la imagen en pantalla**, para que elija la
versión correcta del `srcset`. Sin él, con `fill` el navegador asume `100vw` y se descarga la imagen
más grande aunque se pinte en una tarjeta de 300 px.

Se escribe en el orden en que se leen los breakpoints:

```tsx
// Grid de eventos: 1 columna en móvil, 2 en tablet, 3 en escritorio
sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"

// Hero a ancho completo siempre
sizes="100vw"

// Avatar de tamaño fijo
sizes="48px"
```

Regla práctica: **si usas `fill`, pon `sizes`.** Siempre.

## ⚠️ `priority` está deprecado en Next 16

Esta es la trampa número uno para quien llega nuevo, porque **todos los tutoriales dicen
`priority`** y en Next 16 ya no es lo correcto.

```tsx
// ❌ Deprecado desde Next 16
<Image src={hero} alt="" priority />

// ✅ Para la imagen principal (la del LCP)
<Image src={hero} alt="" loading="eager" fetchPriority="high" />
```

Existe también `preload={true}`, que inserta un `<link rel="preload">` en el `<head>`. La propia
documentación de Next recomienda que **en la mayoría de casos uses `loading="eager"` o
`fetchPriority="high"` en su lugar**, y explícitamente desaconseja `preload` cuando varias imágenes
podrían ser el LCP según el tamaño de pantalla — que es justo el caso de un carrusel.

Aplícalo **a una sola imagen por página**: la más grande visible sin hacer scroll. En
`eventos/[slug]` es la imagen de promoción del evento. Marcar diez imágenes como prioritarias
equivale a no marcar ninguna.

## `quality` — ojo con el valor por defecto

Desde Next 16, `images.qualities` vale `[75]` por defecto y **el prop `quality` sólo acepta valores
de esa lista**. Si escribes `quality={80}` sin declararlo, falla:

```ts
// next.config.ts — sólo si de verdad necesitas otro valor
images: {
  qualities: [75, 90],   // ahora quality={90} es válido
  remotePatterns: [ /* ... */ ],
}
```

En la práctica 75 está bien para casi todo. Sube a 90 sólo donde se note.

## `placeholder="blur"` — el difuminado mientras carga

Para imágenes locales importadas, sale gratis:

```tsx
import banner from '@/public/login_banner.webp';

<Image src={banner} alt="" placeholder="blur" />
// width, height y blurDataURL los deduce Next del archivo
```

Para imágenes remotas hay que dar el `blurDataURL` a mano (un data URI diminuto). Si el backend no lo
genera, no vale la pena: usa un color de fondo en el contenedor.

El repo ya tiene `public/blur_pattern.webp` y `blur_pattern_2.webp`, que probablemente se usan para
esto a mano.

## Cuándo NO usar `next/image`

No todo tiene que migrar. Deja `<img>` o usa `unoptimized` cuando:

- **El SVG del recinto** (`eventos/[slug]/page.tsx:863`). Es un SVG interactivo inyectado con
  `dangerouslySetInnerHTML`; el optimizador no aplica.
- **Data URIs y blobs** — QR generados en el navegador, capturas de `html2canvas`. No hay nada que
  optimizar y el optimizador no los acepta.
- **Iconos SVG de `react-icons`.** Ya son componentes; `next/image` no pinta nada ahí.
- **Logos de bancos y tarjetas** (`visa.png`, `BBVA.png`…) si ya pesan poco. Migrarlos no hace daño,
  pero no es prioridad.

## Orden de migración en este repo

Por impacto, no por número de archivos:

| Orden | Dónde | Por qué |
|---|---|---|
| 1 | Imagen de evento en `app/(site)/eventos/[slug]/page.tsx` | Es el **LCP** de la página con más tráfico |
| 2 | Tarjetas de `app/(site)/eventos/page.tsx` (5 `<img>`) | Listado, muchas imágenes a la vez, `fill` + `sizes` |
| 3 | Logo en `app/(site)/layout.tsx` | Sale en todas las páginas |
| 4 | `eventos/pages/formConferenciaPage.tsx` (15 `<img>`) | El archivo con más |
| 5 | El resto | Cuando toque el archivo por otra cosa |

**No hagas un PR de 129 imágenes.** Uno por zona, verificando que nada se descuadra.

## Cómo verificar que funcionó

**1. Que se ve igual.** El error más común al migrar es que la imagen se estira o desaparece: casi
siempre es un contenedor sin `relative` o sin altura cuando se usa `fill`.

**2. Que se sirve optimizada.** En DevTools → Network, filtra por imágenes. Deberías ver peticiones a
`/_next/image?url=...&w=...&q=75` y el tipo `webp` en vez de `jpeg`.

**3. Que el LCP bajó.** DevTools → Lighthouse, modo móvil. El **LCP** es la métrica que mide esto
(ver [glosario](./glosario.md)); antes y después en la misma página.

**4. Que no hay salto de layout.** En Lighthouse, **CLS** debería estar en 0 o muy cerca. Si sube, a
alguna imagen le faltan `width`/`height` o el contenedor no reserva altura.
