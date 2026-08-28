# 02 — Caché de datos: peticiones de vida larga

## Lo primero que hay que saber de Next 16

> **El caché de `fetch` es opt-in.** Un `fetch` sin opciones **no se cachea**.

Esto cambió respecto a Next 13/14, donde `fetch` se cacheaba por defecto y había que salirse a mano.
Casi todos los tutoriales que encuentres en internet describen el comportamiento viejo. La
documentación de la versión que tenemos instalada está en
`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/fetch.md`.

Consecuencia práctica: mover una petición al servidor **no la cachea**. Sin opciones de caché, lo
único que ganas es que salga del servidor en vez del navegador — que ya es algo, pero no es la
ganancia grande.

## Dos caminos, y por qué recomendamos el primero

### Camino A — `fetch` con opciones (usar este)

Funciona hoy, sin tocar `next.config.ts`, ruta por ruta. Es lo que describe el resto de este
documento.

```ts
const res = await fetch(url, {
  cache: 'force-cache',
  next: { revalidate: 3600, tags: ['config:sitio'] },
});
```

### Camino B — `'use cache'` (todavía no)

Next 16 trae la directiva `'use cache'` con `cacheTag()` y `cacheLife()`, que es más expresiva y
permite cachear componentes enteros, no sólo peticiones:

```ts
export async function getSiteConfig() {
  'use cache';
  cacheLife('hours');
  cacheTag('config:sitio');
  // ...
}
```

Requiere activar `cacheComponents: true` en `next.config.ts`, y ese flag **cambia el modelo de
render de toda la aplicación**: el renderizado pasa a ser dinámico por defecto y tú eliges
explícitamente qué se cachea. También exige runtime Node.js en todas las rutas.

**No lo activen a mitad de esta migración.** Es un cambio transversal que hay que hacer con la
migración a Server Components ya terminada, para no depurar dos cosas nuevas a la vez. El camino A no
es un parche temporal: es una API estable y soportada, y todo lo que se escriba con él sigue
funcionando si algún día se pasa al camino B (los tags se llaman igual y `revalidateTag` es el mismo).

Guía de migración, para cuando toque:
`node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md`

## La idea central: TTL largo + invalidación por evento

El instinto es poner un TTL corto para que los datos estén frescos. Es la forma cara de resolverlo:
con `revalidate: 60`, la config de marca se vuelve a pedir 1.440 veces al día para cambiar dos veces
al año.

La combinación correcta:

- **TTL largo** — porque el dato casi nunca cambia.
- **Invalidación por tag cuando cambia** — el backend avisa (ver [doc 03](./03-revalidacion-desde-el-backend.md)).

Con eso, el TTL deja de significar *«cada cuánto quiero datos frescos»* y pasa a significar
***«cuánto desfase tolero si el aviso del backend se pierde»***. Es la red de seguridad, no el
mecanismo principal.

## El caso de la configuración de marca

`/configuraciones/detail/1` es el ejemplo perfecto: idéntica para todos los visitantes, necesaria en
**todas** las páginas, y cambia cuando alguien la edita en el dashboard.

Hoy sale del navegador de cada visitante en un `useEffect` de `context/ColorContext.tsx`.

```ts
// lib/config/getSiteConfig.ts
import type { BrandColors, ConfigResponse } from './types';

/** Tag de caché. El backend lo usa para invalidar; ver doc 03. */
export const TAG_CONFIG = 'config:sitio';

const DEFAULT_COLORS: BrandColors = {
  emphasis: '#0E1A3D',
  accentBase: '#1A56DB',
  accentLight: '#38BDF8',
  neutral: '#F8FAFC',
  darker: '#1E293B',
};

export async function getSiteConfig(): Promise<{
  config: ConfigResponse | null;
  colors: BrandColors;
}> {
  try {
    const res = await fetch(
      `${process.env.URL_BACKEND}/api/v1/configuraciones/detail/1`,
      {
        // Sin API_KEY server-only esto no se puede hacer desde el servidor:
        // NEXT_PUBLIC_API_KEY se inlinea en el bundle del navegador.
        headers: { 'x-api-key': process.env.API_KEY! },

        // Las dos líneas que hacen el trabajo:
        cache: 'force-cache',
        next: {
          // 1 h de red de seguridad. La invalidación real la dispara el
          // backend cuando alguien guarda la config en el dashboard.
          revalidate: 3600,
          tags: [TAG_CONFIG],
        },
      },
    );

    if (!res.ok) throw new Error(`config: HTTP ${res.status}`);

    const config = (await res.json()) as ConfigResponse;
    return { config, colors: validarColores(config) };
  } catch (err) {
    // La marca no puede tumbar el sitio: se cae a los colores por defecto.
    // Ojo: sólo se cachean respuestas 200, así que un fallo se reintenta
    // en la siguiente petición. No se cachea el error.
    console.error('[config] no se pudo cargar la configuración de marca:', err);
    return { config: null, colors: DEFAULT_COLORS };
  }
}
```

Dos detalles que no son obvios:

- **`cache: 'force-cache'` y `next.revalidate` van juntos.** Sé explícito con los dos. Sin
  `force-cache` el comportamiento depende de si la ruta acabó siendo estática o dinámica, y eso
  cambia según lo que haga cualquier otro componente de la misma ruta — es exactamente el tipo de
  cosa que funciona en local y no en producción.
- **Sólo se cachean respuestas con estado 200.** Un 500 del backend no envenena el caché.

## Tabla de TTLs para este proyecto

| Dato | Endpoint | `revalidate` | Tag |
|------|----------|--------------|-----|
| Configuración de marca | `/configuraciones/detail/1` | `3600` (1 h) | `config:sitio` |
| Ciudades | `/ciudades` | `86400` (24 h) | `ciudades` |
| Listado público de eventos | `/eventos/get_all_select` | `300` (5 min) | `eventos:lista` |
| Detalle de un evento | `/eventos/:id/detalle` | `300` (5 min) | `evento:<slug>` |
| Secciones y precios | `/eventos/:id/detalle_seccion/...` | `300` (5 min) | `evento:<slug>` |
| Paquetes de CityPass | `/citypass/...` | `3600` (1 h) | `citypass:<ciudad>` |
| Documentos de legales (`.docx`) | `config.terminosYCondiciones` | `86400` (24 h) | `legales` |
| **Disponibilidad de asientos** | `/eventos/:id/:sec/filas_por_seccion` | **`no-store`** | — |
| **Cualquier cosa del usuario** | `/eventos/mis_eventos`, perfil, amigos | **`no-store`** | — |

Las dos últimas filas son las importantes. Siguen.

## Lo que NUNCA se cachea

### Disponibilidad de asientos

```ts
// Un asiento cacheado 5 minutos es un asiento vendido dos veces.
const res = await fetch(`${base}/api/v1/eventos/${id}/${sec}/filas_por_seccion`, {
  cache: 'no-store',
});
```

Somos una plataforma de boletos. La disponibilidad se lee en el momento o no se lee. Esto vale también
para promociones con cupo, precios durante una preventa activa, y cualquier contador de existencias.

### Datos de un usuario

> **Cachear una respuesta autenticada es servirle los datos de un usuario a otro.**

Es el bug más caro de esta categoría, y no se ve en desarrollo porque en desarrollo hay un solo
usuario. La clave de caché de `fetch` se calcula con URL, método, headers y body: si dos usuarios
piden la misma URL, la respuesta del primero se le sirve al segundo.

Regla operativa: **si la respuesta depende del token, `no-store`.** `/eventos/mis_eventos`,
`/perfil/*`, `/amigos/*`, `/transferencias/*`, cualquier cosa bajo `mis_`.

Y en el mismo sentido: una función cacheada **no puede leer `cookies()` ni `headers()`**. Next lanza
el error `next-request-in-use-cache`, y la restricción se propaga por la pila de llamadas: si una
función cacheada llama a un helper que lee cookies, falla igual. En una ruta dinámica el error puede
aparecer sólo en `next start` y no en `next build`.

Si necesitas un valor de request dentro de algo cacheable, **léelo fuera y pásalo como argumento**:

```ts
// mal — explota
async function getDatos() {
  'use cache';
  const ck = await cookies();          // ❌ next-request-in-use-cache
}

// bien — el valor entra como argumento y forma parte de la clave de caché
const ck = await cookies();
const datos = await getDatos(ck.get('ciudad')?.value);
```

## Memoización: no confundirla con el caché

Son dos mecanismos distintos y la diferencia importa.

| | Memoización | Caché persistente |
|---|---|---|
| Duración | Un solo render | Entre peticiones, usuarios y hasta el próximo deploy |
| Alcance | Una petición HTTP | Todo el servidor |
| Cómo | Automático en `fetch` GET; `cache()` de React para lo demás | `cache: 'force-cache'` + `next.revalidate` |

**`fetch` con GET se memoiza solo.** Si `generateMetadata` y el componente de página llaman al mismo
`fetch` con la misma URL y opciones, Next lo ejecuta una vez y comparte el resultado. Por eso el
patrón del [doc 01](./01-servidor-primero.md) no duplica la petición.

**Para lo que no es `fetch`** —o para envolver varios fetches en una función— usa `cache()` de React:

```ts
// lib/data/eventos.ts
import { cache } from 'react';

// cache() de React: una sola ejecución por render.
// Es lo que evita resolver el slug dos veces cuando generateMetadata
// y el componente de página piden el mismo evento.
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

Fíjate en los **dos tags**: así el backend puede invalidar un evento suelto (`evento:tuff-riders`) o
todos de golpe (`eventos:lista`) cuando cambia algo transversal.

> ⚠️ **Requiere backend**: `GET /eventos/slug/:slug` hoy responde 404 — lo dice el `TODO(slug)` de
> `hooks/useEventosStore.tsx`. Sin ese endpoint, resolver un slug obliga a descargar el listado
> completo. Es la única dependencia externa de todo este plan.

## Cómo elegir el `revalidate`

Las tres preguntas, en orden:

1. **¿Depende del usuario?** → `no-store`. Fin.
2. **¿Un dato viejo cuesta dinero o confianza?** (disponibilidad, precios en preventa) → `no-store`.
3. **¿El backend puede avisar cuando cambie?** → TTL largo (1-24 h) + tag.
   **¿No puede?** → TTL corto (1-5 min), y asume el costo.

Vale más un TTL de 24 h con invalidación que uno de 60 s sin ella: es más barato *y* más fresco.

## Nunca lo trates como base de datos

- **Un deploy nuevo vacía el caché.** La clave incluye el Build ID.
- **El caché por defecto es local a la instancia.** Con varias réplicas, cada una tiene el suyo.
  Esto también afecta a la invalidación y es el detalle operativo más importante de todo este
  conjunto — está explicado en el [doc 03](./03-revalidacion-desde-el-backend.md).
- **Un fallo de escritura de caché no rompe la respuesta**, sólo la pierde: la siguiente petición
  vuelve a renderizar.

## Verificar que está cacheando

En `next build`, los símbolos junto a cada ruta dicen si quedó estática o dinámica. Y en desarrollo,
para ver cada `fetch` del servidor con su estado de caché en la terminal:

```ts
// next.config.ts — sólo afecta a desarrollo
const nextConfig: NextConfig = {
  logging: { fetches: { fullUrl: true } },
};
```

Con eso, `npm run dev` imprime cada petición de servidor y si vino del caché o no.

La prueba manual honesta: pide dos veces la misma página y mira los logs del **backend**. Si la
segunda petición no llegó al back, el caché funciona.

```bash
curl -s http://localhost:3000/eventos > /dev/null
curl -s http://localhost:3000/eventos > /dev/null
# el log del backend debería mostrar 1 llamada a /configuraciones/detail/1, no 2
```
