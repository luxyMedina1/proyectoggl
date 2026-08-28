# 08 — Code-splitting: que el navegador no descargue lo que no usa

## El concepto, desde cero

Cuando compilas, todo el JavaScript de la app se junta en archivos llamados **bundles**. Si hubiera
un solo bundle, entrar a `/eventos` descargaría también el checkout, el perfil, el mapa de CityPass y
el editor de conferencias.

**Code-splitting** es partir eso en trozos (**chunks**) y bajar sólo los que hacen falta.

Next hace bastante solo. Lo que este documento cubre es lo que **no** hace solo.

## Lo que ya es automático (no lo toques)

**1. División por ruta.** Cada `page.tsx` genera su chunk. Entrar a `/eventos` no descarga el código
de `/perfil`.

**2. Los Server Components no mandan JavaScript.** Un componente sin `'use client'` se ejecuta en el
servidor y al navegador sólo llega su HTML. **Este es el mecanismo de reducción de bundle más potente
que tiene Next**, y es la razón por la que el [doc 01](./01-servidor-primero.md) va antes que éste.
Migrar una página a servidor hace más por el peso que cualquier `next/dynamic`.

**3. `react-icons` y `date-fns` ya vienen optimizados.** Next trae una lista de paquetes a los que
aplica `optimizePackageImports` por defecto, y **`react-icons/*` y `date-fns` están en ella**. Cuando
escribes:

```tsx
import { TbTicket } from 'react-icons/tb';
```

Next reescribe el import para traer sólo ese icono, no los 2.000 del set. **No agregues estos
paquetes a `experimental.optimizePackageImports`** — ya están, y hay ejemplos por internet que dicen
lo contrario porque son de versiones viejas.

## `next/dynamic`: cargar bajo demanda

`next/dynamic` difiere la descarga de un componente cliente hasta que se necesita.

```tsx
import dynamic from 'next/dynamic';

const ModalPesado = dynamic(() => import('./ModalPesado'));
```

Tres casos de uso distintos:

```tsx
'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';

// A) Chunk aparte, pero se carga siempre
const Galeria = dynamic(() => import('./Galeria'));

// B) Sólo si el usuario lo abre — el mejor caso
const ModalTransferir = dynamic(() => import('./ModalTransferir'));

// C) Sólo en navegador, nunca en servidor
const Mapa = dynamic(() => import('./Mapa'), { ssr: false });

export default function Pagina() {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Galeria />
      <button onClick={() => setAbierto(true)}>Transferir</button>
      {/* El JS del modal no se descarga hasta este clic */}
      {abierto && <ModalTransferir onClose={() => setAbierto(false)} />}
    </>
  );
}
```

Con `loading` puedes dar un fallback mientras baja el chunk:

```tsx
const Mapa = dynamic(() => import('./Mapa'), {
  ssr: false,
  loading: () => <div className="h-96 animate-pulse bg-gray-200 rounded" />,
});
```

### ⚠️ `ssr: false` sólo funciona en Client Components

En App Router, `ssr: false` **no se puede usar dentro de un Server Component**. Si lo necesitas, el
archivo que hace el `dynamic()` tiene que tener `'use client'`.

Cuándo hace falta `ssr: false`: cuando la librería toca `window` o `document` **al importarse**, no al
renderizarse. Ahí el import en el servidor revienta antes de que puedas comprobar nada.

## El ejemplo que ya está bien hecho en el repo

`publicUi/pages/CityPassPaquetePage.tsx` es el único `next/dynamic` del proyecto, y está correcto —
incluido el comentario que explica el porqué:

```tsx
// leaflet toca `window` al importarse: sin ssr:false, el primer render en el servidor truena.
const MapaAtracciones = dynamic(
  () => import('../components/citypass/MapaAtracciones').then((m) => m.MapaAtracciones),
  { ssr: false },
);
```

Fíjate en `.then((m) => m.MapaAtracciones)`: eso es para componentes con **export nombrado**. Si es
`export default`, no hace falta.

**Úsalo de plantilla.** Es exactamente el patrón que hay que replicar en los demás casos.

## Candidatos concretos en este repo

Por peso estimado y facilidad, de mayor a menor ganancia:

| Librería | Dónde | Qué hacer |
|---|---|---|
| **`mammoth`** | 3 páginas de legales | Parser de `.docx` completo, para renderizar un documento que cambia una vez al año. Como mínimo `dynamic`; lo correcto es convertirlo en el servidor. |
| **`moment`** | `eventos/page.tsx`, `HomePage.tsx` | No es splitting: es **borrarlo**. Ver abajo. |
| **`html2canvas`** | 2 páginas de conferencias | Sólo se usa al pulsar «descargar boleto». Import dinámico dentro del handler. |
| **`leaflet` + `react-leaflet`** | `MapaAtracciones` | Ya está resuelto. Verifica que no se importe desde otro sitio sin `dynamic`. |
| **`sweetalert2`** | 34 archivos | El más difícil por número de sitios. Ver abajo. |
| **`qrcode.react`** | Detalle de boleto | Sólo aparece al abrir el modal del boleto. |
| **`swiper`** | Detalle de evento, home | Carrusel. Suele estar visible al cargar, así que la ganancia es menor. Evalúa. |

### `mammoth`: mejor que dinámico, quitarlo del navegador

```tsx
// Hoy: el navegador del usuario baja un parser de OOXML para leer un .docx
import mammoth from 'mammoth';
```

Opción rápida — `dynamic` dentro del efecto:

```tsx
useEffect(() => {
  const cargar = async () => {
    if (!config?.terminosYCondiciones) return;
    const { default: mammoth } = await import('mammoth');   // sólo si hace falta
    const res = await fetch(config.terminosYCondiciones);
    const { value } = await mammoth.convertToHtml({ arrayBuffer: await res.arrayBuffer() });
    setHtmlContent(value);
  };
  cargar();
}, [config?.terminosYCondiciones]);
```

Opción correcta — convertirlo en el servidor y servir HTML ya listo. `mammoth` desaparece del bundle
del navegador, y de paso esas tres páginas pasan a ser indexables por Google (hoy su contenido no
existe hasta que el navegador ejecuta el parser). Combínalo con el caché del
[doc 02](./02-cache-de-datos.md): `revalidate: 86400`, tag `legales`.

### `html2canvas`: importar dentro del handler

No hace falta `next/dynamic` para una librería que no es un componente. Un `import()` normal basta:

```tsx
const descargarBoleto = async () => {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(ref.current!);
  // ...
};
```

El chunk se descarga en el primer clic. El 95 % de los usuarios nunca lo baja.

### `sweetalert2`: 34 archivos, hazlo con un wrapper

No vale la pena tocar 34 sitios. Crea un módulo intermedio y cambia los imports:

```ts
// utils/alertas.ts
type OpcionesSwal = Parameters<typeof import('sweetalert2')['default']['fire']>[0];

export const alerta = async (opciones: OpcionesSwal) => {
  const { default: Swal } = await import('sweetalert2');
  return Swal.fire(opciones);
};
```

```tsx
// En cada archivo: cambiar el import y añadir await
- import Swal from 'sweetalert2';
+ import { alerta } from '@/utils/alertas';

- Swal.fire({ title: 'Error', icon: 'error' });
+ await alerta({ title: 'Error', icon: 'error' });
```

Se puede hacer con buscar-y-reemplazar. Un solo PR, mecánico, y saca `sweetalert2` de todos los
chunks iniciales.

## `moment`: esto no es splitting, es borrar

El repo tiene **tres** librerías de fechas:

- `moment` — la más pesada (~70 KB gzip con locales), en mantenimiento desde 2020
- `dayjs` — ligera
- `date-fns` + `date-fns-tz` — la que usa `utils/dateHelpers.ts`, tree-shakeable, ya optimizada por Next

`moment` y `dayjs` se usan en **los mismos dos archivos**: `app/(site)/eventos/page.tsx` y
`publicUi/pages/HomePage.tsx`.

Migra esos dos a `date-fns` y desinstala las otras dos. Es la ganancia de bundle más grande por
esfuerzo de todo este documento, y no requiere entender nada de Next.

```bash
npm uninstall moment dayjs
```

`utils/dateHelpers.ts` ya respeta `NEXT_PUBLIC_TIMEZONE`, así que además ganas consistencia de zona
horaria — que en venta de boletos no es un detalle menor.

## Cómo medir

**1. `next build`** imprime una tabla con **First Load JS** por ruta: el JavaScript que el navegador
tiene que descargar y ejecutar antes de que la página sea interactiva. Es el número a bajar.

```
Route (app)                          Size     First Load JS
┌ ○ /                                 142 B          87.3 kB
├ ● /eventos/[slug]                  48.2 kB          312 kB   ← este
```

Guarda la tabla antes de empezar. Sin punto de partida no sabes si mejoraste.

**2. `@next/bundle-analyzer`** para ver *qué* pesa:

```bash
npm i -D @next/bundle-analyzer
```

```ts
// next.config.ts
import bundleAnalyzer from '@next/bundle-analyzer';

const withAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

export default withAnalyzer(nextConfig);
```

```bash
ANALYZE=true npm run build
```

Abre un mapa de rectángulos donde el tamaño es el peso real. Si ves un bloque enorme llamado
`moment` o `mammoth`, ahí está tu siguiente PR.

**3. DevTools → Network, filtro JS**, con throttling «Fast 3G». Es lo que siente un usuario en
celular, que es la mayoría del tráfico de venta de boletos.

## En qué orden

1. **Borrar `moment` y `dayjs`.** Máxima ganancia, cero riesgo, no requiere saber Next.
2. **Migrar páginas a Server Components** ([doc 01](./01-servidor-primero.md)). Es lo que más pesa.
3. **`mammoth` al servidor.**
4. **`html2canvas` y `qrcode.react` con `import()` en el handler.**
5. **El wrapper de `sweetalert2`.**
6. **Medir otra vez** y decidir si vale la pena seguir.

No hagas 4 y 5 antes de 2: migrar una página a servidor puede eliminar el problema por completo, y
entonces el `dynamic` que escribiste sobra.
