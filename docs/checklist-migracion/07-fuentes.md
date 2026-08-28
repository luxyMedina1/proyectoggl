# 07 — Fuentes con `next/font`

## Qué está pasando hoy

`app/layout.tsx` carga Poppins con un `<link>` a Google Fonts, en el `<head>`:

```tsx
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link
  href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;...;1,900&display=swap"
  rel="stylesheet"
/>
```

Eso pide **18 variantes**: nueve pesos (100 a 900) por dos estilos (normal e itálica).

## Por qué es un problema

**1. Bloquea el render.** Una hoja de estilos en el `<head>` es *render-blocking*: el navegador no
pinta nada hasta descargarla. Y aquí no es una descarga: son dos.

```
navegador → fonts.googleapis.com   (DNS + TLS + descarga del CSS)
navegador → fonts.gstatic.com      (DNS + TLS + descarga de cada .woff2)
```

Los `preconnect` ayudan con el handshake, pero siguen siendo dos dominios externos en la ruta crítica
del **FCP** (ver [glosario](./glosario.md)).

**2. Se descargan variantes que nadie usa.** Conté los pesos que de verdad aparecen en el código:

| Peso | Clase Tailwind | Usos reales |
|------|----------------|-------------|
| 300 | `font-light` | 25 |
| 400 | `font-normal` | 32 |
| 500 | `font-medium` | 199 |
| 600 | `font-semibold` | 261 |
| 700 | `font-bold` | 125 |
| 800 | `font-extrabold` | 4 |
| 900 | `font-black` | 1 |
| **100, 200** | — | **0** |
| **itálica (cualquier peso)** | `italic` | **1** |

Se cargan 18 variantes para usar 5 de verdad. Los pesos 100 y 200 no se usan nunca, y hay **un solo
`italic` en todo el repo** — las nueve variantes itálicas existen para eso.

**3. No hay control del `font-display`.** Con `&display=swap` el navegador pinta primero con la
fuente de respaldo y luego cambia a Poppins. Ese cambio mueve el texto (**FOUT**), y como la fuente
de respaldo tiene métricas distintas, empuja el layout y suma **CLS**.

**4. Privacidad.** Cada visitante hace una petición a un dominio de Google. En algunas
jurisdicciones europeas eso ha sido problema legal.

## Qué hace `next/font`

`next/font/google` **descarga la fuente en build y la sirve desde tu propio dominio**. En tiempo de
ejecución el navegador no habla con Google en absoluto.

Además calcula automáticamente una **fuente de respaldo con métricas ajustadas**: mientras Poppins
carga, el texto se pinta con una fuente del sistema escalada para ocupar *exactamente el mismo
espacio*. Cuando entra Poppins, no se mueve nada. Eso lleva el CLS por fuentes a cero.

## El cambio

```tsx
// app/layout.tsx
import { Poppins } from 'next/font/google';

// Se declara UNA vez, a nivel de módulo. Nunca dentro del componente:
// Next necesita analizarlo en build para descargar los archivos.
const poppins = Poppins({
  subsets: ['latin'],           // sin esto, se bajarían griego, cirílico, vietnamita…
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins',   // expone la fuente como variable CSS
});

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${poppins.variable} h-full`}>
      {/* Se van los tres <link> y con ellos el <head> manual entero */}
      <body className="min-h-full flex flex-col antialiased font-sans">
        {/* ... */}
      </body>
    </html>
  );
}
```

De 18 variantes a 5, servidas desde tu dominio, sin bloquear el render y sin salto de layout.

Sobre los pesos 800 y 900: son 5 usos en todo el repo. O los agregas a la lista (cada peso extra son
unos pocos KB), o cambias esos cinco `font-extrabold`/`font-black` por `font-bold`. Yo cambiaría los
cinco usos, pero es decisión de diseño, no técnica.

### `variable` vs `className`

Dos formas de aplicarla:

- **`poppins.className`** — aplica la fuente directamente a ese elemento. Simple, pero no se integra
  con Tailwind.
- **`poppins.variable`** — define `--font-poppins` en el elemento. Es la que quieres aquí, porque
  permite que Tailwind y el SCSS existente la consuman.

## Conectarlo con Tailwind v4

Este proyecto usa Tailwind v4 (`@tailwindcss/postcss`), donde el tema se configura **en CSS**, no en
`tailwind.config.js`:

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --font-sans: var(--font-poppins), ui-sans-serif, system-ui, sans-serif;
}
```

Con eso, `font-sans` de Tailwind ya es Poppins y no hace falta tocar nada más.

## Dos archivos que hay que limpiar

Hoy la fuente está escrita a mano en dos sitios, y si no se cambian van a pisar la variable:

```css
/* app/globals.css:44 */
font-family: "Poppins", Arial, Helvetica, sans-serif;
```

```scss
/* styles/legacy.scss:2 */
font-family: "Poppins", serif;   /* ← además el fallback es serif, que es un bug: si
                                     Poppins no carga, el sitio sale en Times New Roman */
```

Los dos pasan a:

```css
font-family: var(--font-poppins), ui-sans-serif, system-ui, sans-serif;
```

**Esto importa más de lo que parece.** `next/font` genera un nombre de familia con hash
(`__Poppins_abc123`), no `"Poppins"`. Si el CSS pide `"Poppins"` por nombre, el navegador busca una
fuente instalada localmente con ese nombre: la encuentra en la máquina del diseñador que la tiene
instalada, y no la encuentra en la de nadie más. Es un bug que sólo se ve fuera de tu equipo.

## Errores comunes

**Declararla dentro del componente.**

```tsx
// ❌ No compila
export default function Layout() {
  const poppins = Poppins({ subsets: ['latin'] });
}
```

Next analiza estas llamadas en tiempo de build para saber qué descargar. Tiene que estar en el ámbito
del módulo, con argumentos literales — no variables, no valores calculados.

**Olvidar `subsets`.** Sin él Next avisa; con `['latin']` te ahorras griego, cirílico y vietnamita.
Si algún día hay contenido con acentos poco comunes, `latin-ext`.

**Pedir todos los pesos por si acaso.** Es exactamente lo que pasa hoy. Cada peso es un archivo.

**Usar una fuente distinta por componente.** Cada llamada a `Poppins({...})` con opciones distintas
genera archivos distintos. Declárala una vez en el layout raíz.

## Verificar

**1. Que no hay peticiones a Google.** DevTools → Network, recarga con caché deshabilitado, filtra por
`google`. **Cero resultados.** Si aparece algo, quedó un `<link>` suelto.

**2. Que las fuentes se sirven desde tu dominio.** Filtra por `font`: deberías ver `.woff2` bajo
`/_next/static/media/`.

**3. Que se aplica.** Inspecciona un `<p>` → Computed → `font-family`. Debe decir algo como
`__Poppins_abc123`, no `Poppins` a secas ni `Arial`.

**4. Que el CLS bajó.** Lighthouse antes y después. También desaparece el parpadeo de fuente al
recargar.

## Si algún día hace falta una fuente propia

Para un `.woff2` que no está en Google Fonts (una tipografía de marca, por ejemplo):

```tsx
import localFont from 'next/font/local';

const marca = localFont({
  src: [
    { path: './fuentes/Marca-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fuentes/Marca-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-marca',
  display: 'swap',
});
```

Mismas ventajas: auto-hospedada, con métricas de respaldo, sin peticiones externas.
