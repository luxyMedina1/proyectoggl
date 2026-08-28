# Guía de migración — TaquillaVip Next

Documentación para el equipo que está terminando de migrar de React + Vite a Next.js App Router.

Está escrita **asumiendo que es tu primera vez con Next**. Explica el porqué, no sólo el cómo, y
cualquier término técnico que aparezca está definido en el [glosario](./glosario.md) — LCP, hidratación,
bundle, RSC, tree-shaking y demás.

Verificado contra **Next.js 16.3.2** y **React 19.2.8** (las versiones que están en `package.json`).
Varias APIs cambiaron en Next 16, así que **mucho de lo que encuentres en Google, en blogs o en
respuestas de IA va a estar desactualizado**. Lo de aquí sale de `node_modules/next/dist/docs/`, que
es la documentación de la versión exacta que tenemos instalada.

Tres ejemplos de cosas que casi todos los tutoriales dicen mal para Next 16:

- El caché de `fetch` **es opt-in**: un `fetch` sin opciones no se cachea. Antes era al revés.
- `revalidateTag(tag)` con un solo argumento **está deprecado**. Hay que pasar el segundo.
- El prop `priority` de `next/image` **está deprecado**, en favor de `loading="eager"` /
  `fetchPriority="high"` / `preload`.

## Los documentos

### Lo esencial — se leen en orden

| # | Documento | De qué trata |
|---|-----------|--------------|
| 01 | [Servidor primero](./01-servidor-primero.md) | Cómo dejar de poner `'use client'` en todo. El patrón para partir una página existente sin reescribirla. |
| 02 | [Caché de datos](./02-cache-de-datos.md) | Cachear peticiones de vida larga como la de configuración. Qué TTL para cada endpoint del proyecto. |
| 03 | [Revalidación desde el backend](./03-revalidacion-desde-el-backend.md) | El endpoint que el back llama cuando cambia algo. Incluye el contrato para el equipo de backend. |
| 04 | [Metadatos y OG](./04-metadatos-og-eventos.md) | Vistas previas al compartir en WhatsApp, Facebook y X. Es la razón principal por la que hay que hacer 01. |
| 05 | [Checklist de PR](./05-checklist-de-pr.md) | Lo que hay que revisar antes de pedir review. Cabe en una pantalla. |

El 02 no sirve de nada sin el 01 (no hay dónde cachear si todo es cliente), y el 03 no sirve sin el 02
(no hay caché que invalidar).

### Optimizaciones — independientes entre sí

Se pueden hacer antes, después o en paralelo a lo anterior. Cada uno se lee suelto.

| # | Documento | De qué trata |
|---|-----------|--------------|
| 06 | [Imágenes](./06-imagenes.md) | `next/image`. Hoy hay 129 `<img>` y cero optimización. Empieza por `remotePatterns` o el build falla. |
| 07 | [Fuentes](./07-fuentes.md) | `next/font`. Hoy se cargan 18 variantes de Poppins para usar 5, desde un dominio externo que bloquea el render. |
| 08 | [Code-splitting](./08-code-splitting.md) | Que el navegador no baje lo que no usa. Incluye qué hace Next solo y qué **no** hay que configurar. |
| 09 | [Adiós React Router](./09-adios-react-router.md) | Retirar `utils/nextRouterCompat.tsx`. Tiene tres bugs reales y bloquea la migración de 33 archivos. |

### Referencia

| Documento | De qué trata |
|-----------|--------------|
| [Glosario](./glosario.md) | LCP, CLS, hidratación, RSC, tree-shaking, `stale-while-revalidate`… Consúltalo según lo necesites. |

## Si sólo puedes leer una cosa

El [doc 01](./01-servidor-primero.md), y dentro de él esta idea:

> `'use client'` no significa «este componente es interactivo». Marca **el punto donde empieza el
> bundle del navegador**: todo lo que ese archivo importe, y todo lo que esos importen, se manda al
> navegador.

Ponerlo en `page.tsx` mueve ese límite a la raíz del árbol, y entonces la página entera es cliente.
Esa confusión es la que explica casi todo lo que hay que arreglar, y es completamente razonable
haberla tenido: la directiva está mal nombrada para lo que hace.

## Dónde estamos hoy

Foto del estado actual, para que se entienda que estos documentos no son teoría:

- **32 de 34 `page.tsx` abren con `'use client'`.** Las 2 que no son `redirect()` de una línea.
  Ninguna página renderiza HTML útil en el servidor.
- **0 usos de `next/image`** frente a 129 `<img>` nativos.
- **0 `generateMetadata`** en rutas de contenido. Al compartir cualquier evento en WhatsApp sale el
  mismo título genérico y ninguna imagen.
- **Todas las peticiones salen del navegador.** Incluida `/configuraciones/detail/1`, que es idéntica
  para todos los visitantes y de la que dependen el logo, los colores, el título y los pixels.
- **18 variantes de Poppins** cargadas desde Google Fonts para usar 5 pesos.
- **3 librerías de fechas** instaladas (`moment`, `dayjs`, `date-fns`); dos de ellas en los mismos dos
  archivos.
- **0 `loading.tsx`, `error.tsx`, `sitemap.ts`, `robots.ts`.**

Nada de esto es culpa de nadie: es lo que pasa cuando migras una SPA ruta por ruta y el objetivo es
que no se rompa. **Funciona, y eso no es poca cosa.** El siguiente paso es aprovechar el servidor, que
es la única razón por la que se cambió de Vite a Next.

## Convenciones

- **Los ejemplos son de este proyecto**, con endpoints, rutas y nombres reales. Si un ejemplo menciona
  `/configuraciones/detail/1` es porque ese endpoint existe.
- **Lo que depende del backend está marcado** con «⚠️ Requiere backend». No lo puede resolver el front.
- **Lo que depende de infraestructura está marcado** con «⚠️ Requiere infra». Cómo estén desplegadas
  las réplicas cambia la respuesta.
- Los números (129 `<img>`, 33 archivos, 261 `font-semibold`) salen de contar el repo, no de estimar.
  Si no cuadran, el repo cambió — vuelve a contar.

## Todavía sin cubrir

- Mover la sesión de `localStorage` a una cookie `httpOnly`. Es prerrequisito para renderizar perfil y
  mis compras en el servidor, y cierra la exposición a XSS. Proyecto aparte.
- `loading.tsx` y `error.tsx` por segmento.
- Activar `cacheComponents` para usar `'use cache'`. Explicado en el [doc 02](./02-cache-de-datos.md),
  con la recomendación de **no** hacerlo hasta terminar la migración a Server Components.
