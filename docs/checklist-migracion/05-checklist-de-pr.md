# 05 — Checklist de PR

Para PRs que migran una ruta a Server Component. Cabe en una pantalla a propósito.

## Límite servidor / cliente

- [ ] `page.tsx` **no** tiene `'use client'`.
- [ ] `page.tsx` no importa `utils/nextRouterCompat.tsx` (es `'use client'` y contamina).
- [ ] El componente cliente se movió con `git mv`, no copiando y pegando.
- [ ] `await` en `params` y `searchParams`.
- [ ] Se usan los tipos `PageProps<'/ruta'>` / `LayoutProps<'/ruta'>`, no tipos escritos a mano.
- [ ] Los props que cruzan al cliente son serializables: nada de funciones, instancias de clase ni
      `URL`. (`Date`, `Map` y `Set` sí cruzan.)
- [ ] Los `useEffect` que sólo servían para la carga inicial se borraron; el estado se siembra con los
      props.
- [ ] Ningún archivo de `utils/`, `types/` o `lib/` nuevo lleva `'use client'`.

## Datos y caché

- [ ] Cada `fetch` nuevo declara su intención: `cache: 'force-cache'` + `next.revalidate`, o
      `cache: 'no-store'`. **Nunca sin opciones** — en Next 16 el caché es opt-in y un `fetch` pelón
      no se cachea, así que «sin opciones» nunca es la respuesta correcta a propósito.
- [ ] Nada que dependa del usuario o del token está cacheado. Si la respuesta cambia según quién
      pregunta → `no-store`.
- [ ] Disponibilidad de asientos, cupos y precios en preventa → `no-store`.
- [ ] Todo `fetch` cacheado lleva `next.tags`, y el tag está en la tabla del
      [doc 02](./02-cache-de-datos.md).
- [ ] Si el tag es nuevo: está en la allowlist de `app/api/revalidate/route.ts` **y** avisado al equipo
      de backend.
- [ ] Ninguna función cacheada lee `cookies()` ni `headers()` (ni directa ni a través de un helper).
- [ ] Si la misma petición se usa en `generateMetadata` y en el componente, va envuelta en `cache()`
      de React.

## Secretos

- [ ] Ninguna variable nueva con `NEXT_PUBLIC_` contiene un secreto. Ese prefijo publica el valor en
      el bundle del navegador.
- [ ] Los `fetch` de servidor usan `API_KEY` / `URL_BACKEND` (sin prefijo), no las `NEXT_PUBLIC_`.

## Metadatos

- [ ] La ruta exporta `generateMetadata` con `openGraph` y `twitter`.
- [ ] Hay caso de «no encontrado»: `generateMetadata` no revienta si el fetch devuelve `null`.
- [ ] Las URLs de `openGraph.url` son relativas y `metadataBase` está en el layout raíz.

## HTML de terceros

- [ ] Cualquier `dangerouslySetInnerHTML` nuevo pasa por `sanitizeRichText()`.
- [ ] Si se necesitó texto plano en servidor, se usó `textoPlano()`, no `richTextToPlainText()` (esa
      usa `document`).

## Antes de pedir review

```bash
npm run lint
npm run build
```

- [ ] `next build` pasa.
- [ ] **First Load JS** de la ruta bajó respecto a `main`. Si no bajó, el límite no se movió: algo que
      importa `page.tsx` sigue arrastrando `'use client'`.
- [ ] Ningún `eslint-disable react-hooks/exhaustive-deps` nuevo. Si hizo falta uno, casi siempre es un
      hook de store que devuelve un objeto literal nuevo en cada render — la regla está señalando eso.
      Coméntalo en el PR en lugar de silenciarlo.
- [ ] El contenido sale en el HTML del servidor:

```bash
curl -s http://localhost:3000/eventos/tuff-riders | grep -o '<title>.*</title>'
```

Tiene que aparecer el nombre del evento. Si aparece «TaquillaVip», la ruta sigue siendo cliente.

- [ ] Y las etiquetas OG, que es la prueba que el inspector del navegador **no** puede dar:

```bash
curl -s -A 'facebookexternalhit/1.1' http://localhost:3000/eventos/tuff-riders | grep 'og:'
```

## En la descripción del PR

- Qué ruta se migró.
- First Load JS antes → después.
- La salida del `curl` del `<title>`.
- Qué quedó pendiente y por qué (si algo quedó).
