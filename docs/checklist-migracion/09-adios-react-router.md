# 09 — Retirar `nextRouterCompat` (el puente de React Router)

## Qué es y por qué existe

`utils/nextRouterCompat.tsx` es un **shim**: reimplementa la API de React Router (`Link`, `NavLink`,
`useNavigate`, `useLocation`, `useParams`, `useSearchParams`, `Navigate`, `Outlet`) por encima del
router de Next.

Fue la decisión correcta durante la migración. Sin él habría habido que reescribir la navegación de
33 archivos el mismo día que se cambió de Vite a Next, y el riesgo de romper algo era enorme. El shim
permitió mover el proyecto de plataforma **sin tocar** esos archivos.

Ese trabajo ya está hecho. Ahora es deuda, y tiene fecha de caducidad porque **tres de sus funciones
están sutilmente rotas**.

## Los tres bugs

### 1. `useLocation` y `useSearchParams` no son reactivos

```tsx
// utils/nextRouterCompat.tsx
export function useLocation() {
  const pathname = usePathname();
  const search = typeof window !== 'undefined' ? window.location.search : '';
  //             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^ leído durante el render
  return { pathname, search, /* ... */ };
}
```

`window.location.search` se lee **durante el render**, y React no lo observa. Cambia la query string
sin cambiar el `pathname` —`?funcion=3` → `?funcion=7`— y el componente **no se vuelve a renderizar**:
sigue mostrando los datos de la función anterior.

Un `usePathname()` de Next sí es reactivo, así que el bug sólo aparece cuando cambia la query y no la
ruta. Es decir: se manifiesta en los filtros de `/explorar`, en el selector de función de un evento
multifecha, y en los pasos de checkout. Justo donde más duele.

Peor todavía: durante el render en el servidor `window` no existe, así que `search` sale `''`. El
primer render del servidor y el del cliente no coinciden → **error de hidratación** (ver
[glosario](./glosario.md)).

### 2. `Navigate` navega durante el render

```tsx
export function Navigate({ to, replace = false }) {
  const navigate = useNavigate();
  navigate(to, { replace });   // ← efecto secundario en fase de render
  return null;
}
```

Los renders de React tienen que ser puros: calcular UI y nada más. Aquí se dispara una navegación
mientras React está renderizando. En React 19 con StrictMode los renders se ejecutan **dos veces** en
desarrollo, así que esto navega dos veces, y puede meter dos entradas en el historial o pelearse con
el router a mitad de una transición.

### 3. `Outlet` devuelve `null`

```tsx
export function Outlet() {
  return null;
}
```

En React Router, `<Outlet />` es donde se pinta la ruta hija. En App Router eso lo hace `children` de
un `layout.tsx`. El shim devuelve `null` — **cualquier ruta que todavía dependa de `Outlet` renderiza
vacío, sin error ni advertencia en consola**. Un fallo silencioso.

Hoy sólo lo usa `publicUi/components/ProtectedRoute.tsx`.

### Y un cuarto, transversal

El archivo lleva `'use client'`. **Cualquier `page.tsx` de servidor que lo importe deja de compilar.**
Mientras esté en un archivo, esa rama del árbol no se puede migrar a Server Components — así que este
documento bloquea al [doc 01](./01-servidor-primero.md) en 33 archivos.

## Mapa de equivalencias

Todo lo que hace el shim tiene equivalente nativo. Ninguna sustitución necesita librerías nuevas.

| Shim | Nativo de Next | Archivos |
|---|---|---|
| `Link` | `import Link from 'next/link'` — `to` pasa a `href` | 15 |
| `NavLink` | `Link` + `usePathname()` para el estado activo | 2 |
| `useParams` | `import { useParams } from 'next/navigation'` | 15 |
| `useNavigate` | `useRouter()` → `router.push()` / `router.replace()` | 13 |
| `useLocation` | `usePathname()` + `useSearchParams()` de `next/navigation` | 12 |
| `useSearchParams` | `useSearchParams()` de `next/navigation` (**API distinta**) | 2 |
| `Navigate` | `redirect()` en servidor, o `useEffect` + `router.replace()` en cliente | 1 |
| `Outlet` | `children` del `layout.tsx` | 1 |

Total: **33 archivos**.

## Las sustituciones, una por una

### `Link` — trivial

```tsx
- import { Link } from '@/utils/nextRouterCompat';
+ import Link from 'next/link';

- <Link to={`/eventos/${slug}`}>Ver</Link>
+ <Link href={`/eventos/${slug}`}>Ver</Link>
```

El shim acepta `to` **y** `href`. Si el código ya usa `href`, el cambio es sólo el import.

### `NavLink` — hay que escribir el estado activo

React Router daba `className` como función con `isActive`. En Next se compara el pathname:

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Sidebar() {
  const pathname = usePathname();

  const enlace = (href: string) =>
    `bloque-base ${pathname === href ? 'activo' : 'inactivo'}`;

  return <Link href="/perfil/mis_compras" className={enlace('/perfil/mis_compras')}>Mis compras</Link>;
}
```

Ojo si alguna ruta usaba coincidencia por prefijo: `pathname === href` es coincidencia exacta. Para
prefijo, `pathname.startsWith(href)`.

### `useParams` — sólo cambia el import

```tsx
- import { useParams } from '@/utils/nextRouterCompat';
+ import { useParams } from 'next/navigation';
```

El shim ya delega en el de Next. Cero cambios de comportamiento.

### `useNavigate` — `router.push`

```tsx
- import { useNavigate } from '@/utils/nextRouterCompat';
+ import { useRouter } from 'next/navigation';

- const navigate = useNavigate();
+ const router = useRouter();

- navigate(`/eventos/${slug}`);
+ router.push(`/eventos/${slug}`);

- navigate('/auth/login', { replace: true });
+ router.replace('/auth/login');

- navigate(-1);
+ router.back();
```

Lo que **no** tiene equivalente: el `state` de React Router (`navigate(to, { state })`). El shim lo
simulaba con `window.history.replaceState`. En Next hay que pasar el dato por query string, por
`sessionStorage`, o por contexto. Revisa cada `navigate` con `state` a mano — son pocos, pero cambian
de forma.

### `useLocation` — el más delicado

Aquí es donde estaba el bug, así que **no es un reemplazo mecánico**: hay que mirar para qué se usaba.

```tsx
- import { useLocation } from '@/utils/nextRouterCompat';
+ import { usePathname, useSearchParams } from 'next/navigation';

- const { pathname, search } = useLocation();
+ const pathname = usePathname();
+ const searchParams = useSearchParams();   // reactivo de verdad
```

Casos que vas a encontrar:

**a) Sólo para hacer scroll al cambiar de ruta** — es el uso en las 4 páginas de legales:

```tsx
const { pathname } = useLocation();
useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
```

→ `usePathname()` y listo. Cero riesgo.

**b) Para leer un parámetro de query:**

```tsx
- const { search } = useLocation();
- const funcionId = new URLSearchParams(search).get('funcion');
+ const funcionId = useSearchParams().get('funcion');
```

**Este cambio arregla un bug**, no sólo migra código: ahora sí reacciona cuando la query cambia.

> ⚠️ **`useSearchParams()` obliga a un boundary de `<Suspense>`** en rutas prerenderizadas. El repo ya
> lo hace bien en 6 rutas — copia ese patrón. Si falta, `next build` falla con un error de CSR bailout.

**c) Para `state`:** ver la nota de `useNavigate`.

### `useSearchParams` — cuidado, la API es distinta

El shim devuelve una tupla estilo React Router; el de Next devuelve un objeto de sólo lectura:

```tsx
// Shim: [params, setParams]
const [params, setParams] = useSearchParams();
setParams(new URLSearchParams({ ciudad: '5' }));

// Next: sólo lectura. Para escribir, se navega.
const params = useSearchParams();
const pathname = usePathname();
const router = useRouter();

const setCiudad = (id: string) => {
  const siguiente = new URLSearchParams(params.toString());
  siguiente.set('ciudad', id);
  router.push(`${pathname}?${siguiente}`);
};
```

Sólo 2 archivos (`ExplorarPage.tsx` y `HomePage.tsx`), pero **léelos con calma**: es la única
sustitución donde la forma del valor cambia.

### `Navigate` + `Outlet` — el caso especial

`publicUi/components/ProtectedRoute.tsx` es el único que los usa, y es un patrón de React Router que
en App Router **no se traduce: se reemplaza**.

En React Router protegías un árbol de rutas con un componente. En App Router lo hace el `layout.tsx`
del segmento, o `proxy.ts` a nivel de request.

```tsx
// app/(site)/perfil/layout.tsx — protege todo /perfil/*
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuthStore';

export default function PerfilLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useAuthStore();

  useEffect(() => {
    if (status === 'not-authenticated') router.replace('/auth/login');
  }, [status, router]);

  if (status !== 'authenticated') return <LocalLoader />;

  return <>{children}</>;   // ← esto es el Outlet
}
```

`children` **es** el `Outlet`. Y la redirección va en un `useEffect`, no en el render.

> La forma sólida de proteger rutas es en el servidor, con la sesión en una cookie `httpOnly` en vez
> de `localStorage`. Con el token en `localStorage` el servidor no puede saber quién eres, así que hoy
> la única opción es esta. Es otro proyecto; queda anotado.

## En qué orden

De menos a más riesgo. **No lo hagas todo en un PR.**

| # | Símbolo | Archivos | Riesgo | Notas |
|---|---|---|---|---|
| 1 | `useParams` | 15 | Ninguno | Sólo cambia el import; ya delega en Next |
| 2 | `Link` | 15 | Ninguno | `to` → `href` |
| 3 | `useNavigate` | 13 | Bajo | Revisa los que pasan `state` |
| 4 | `NavLink` | 2 | Bajo | Hay que escribir el estado activo |
| 5 | `useLocation` | 12 | **Medio** | Caso por caso; los de scroll son triviales, los de query arreglan un bug |
| 6 | `useSearchParams` | 2 | **Medio** | La API cambia de forma |
| 7 | `Navigate` + `Outlet` | 1 | **Alto** | Rediseño a `layout.tsx` |
| 8 | Borrar el archivo | — | — | Cuando el grep no devuelva nada |

Los pasos 1 y 2 son 30 archivos de puro buscar-y-reemplazar y se pueden hacer hoy.

## Verificar

**Que no queda ninguna referencia:**

```bash
grep -rn "nextRouterCompat" --include="*.tsx" --include="*.ts" . \
  --exclude-dir=node_modules --exclude-dir=.next
```

Cuando eso salga vacío, borra `utils/nextRouterCompat.tsx`.

**Que la query string sí reacciona** — la prueba del bug que estás arreglando:

1. Abre un evento multifecha y cambia de función.
2. La URL debe cambiar **y** el contenido con ella.
3. Botón atrás del navegador: el contenido vuelve a la función anterior.

Con el shim, el paso 2 o el 3 fallan.

**Que no hay errores de hidratación:** abre la consola en desarrollo. Los avisos de *hydration
mismatch* suelen venir de leer `window` durante el render — exactamente lo que hacía `useLocation`.

**Que el build pasa:**

```bash
npm run build
```

Si falla con un error de `useSearchParams` y CSR bailout, falta un `<Suspense>`.
