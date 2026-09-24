# Metadatos y Open Graph — opciones para esta SPA

## El problema en una frase

Los scrapers que generan la vista previa al compartir (**WhatsApp, Facebook, Twitter/X,
Telegram, Slack, iMessage, LinkedIn**) descargan el HTML y **no ejecutan JavaScript**. Esta app
es una SPA: el `index.html` que sirve el servidor es el mismo para `/eventos/tuff-riders` que
para el home, y el nombre, la imagen y la descripción del evento llegan después, por
`GET /eventos/:id/detalle`. El scraper nunca ve nada de eso.

Google sí renderiza JS, así que el título dinámico y la `description` sí le sirven. WhatsApp
no. Son dos problemas distintos y por eso hay dos soluciones.

## Lo que ya quedó implementado (cliente)

`src/utils/documentMeta.ts` + `src/hooks/usePageMeta.ts` escriben en runtime `<title>`,
`description`, `og:*`, `twitter:*` y `<link rel="canonical">`. El detalle del evento y la
página de información los usan con el nombre, la imagen promocional y la descripción del
evento; al desmontar vuelven a los de la marca (`nombreMarca` de `/configuraciones/detail/1`,
que ahora pasa por `setMetaDeSitio` en vez de escribir `document.title` a mano).

Con eso se cubre:

- ✅ Título correcto en la pestaña y en el historial/marcadores.
- ✅ Google y Bing (renderizan JS).
- ✅ `canonical` apuntando al slug, para que no se indexen duplicados.
- ❌ **La vista previa de WhatsApp / Facebook / Twitter sigue mostrando los datos genéricos**
  del `index.html`.

`index.html` ya trae `og:*` base para que al menos el enlace no salga pelado.

---

## Opciones para arreglar la vista previa

### A. Inyectar los metadatos en el HTML, en el servidor que sirve el `dist/` ⭐ recomendada

Quien sirve los estáticos intercepta `/eventos/:slug`, pide los datos del evento al backend e
inyecta las etiquetas en el `index.html` antes de responder. La SPA no cambia en absoluto: el
JS sigue reescribiendo los mismos tags al hidratar, y coinciden.

Se puede hacer solo para bots (cachea mejor, respuesta normal para humanos) o para todos.

Con un Worker / función edge:

```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/eventos\/([^/]+)$/);
    const respuesta = await env.ASSETS.fetch(request);
    if (!m) return respuesta;

    const og = await fetch(`${env.API}/eventos/slug/${m[1]}/og`, {
      headers: { "x-api-key": env.API_KEY },
    }).then((r) => (r.ok ? r.json() : null));
    if (!og) return respuesta;

    return new HTMLRewriter()
      .on("head", { element(e) { e.append(tagsOg(og, url.href), { html: true }); } })
      .transform(respuesta);
  },
};
```

En nginx la variante equivalente es un `location ~ ^/eventos/` que hace `proxy_pass` al
backend cuando el `User-Agent` es de un bot, y sirve el `dist/` en cualquier otro caso.

**Requiere del backend** un endpoint chico:
`GET /api/v1/eventos/slug/:slug/og` → `{ titulo, descripcion, imagen, fecha, recinto, ciudad }`,
con `imagen` como URL absoluta. Es el mismo resolver de
[slugs-eventos.md](./slugs-eventos.md) con unos campos más.

- Costo: bajo. Un archivo, sin tocar React.
- Contra: hay que tener control del edge/proxy.

### B. Que el backend (NestJS) sirva el HTML de `/eventos/*`

El backend lee el `index.html` construido, reemplaza un placeholder (`<!--OG-->`) con las
etiquetas del evento y lo devuelve. Nginx manda `/eventos/*` al backend y el resto al `dist/`.

- Costo: bajo-medio, y es todo dentro del repo del back (nada de infra nueva).
- Contra: el backend pasa a servir HTML y hay que invalidar su caché del `index.html` en cada
  deploy del front.

### C. Prerender en build (`react-snap`, `vite-prerender-plugin`)

**No sirve aquí.** Congela el HTML en el momento del build y los eventos se crean, se editan y
se agotan todos los días. Cada evento nuevo saldría sin metadatos hasta el siguiente deploy.
Solo tendría sentido para páginas fijas (legales, home).

### D. Migrar a SSR

React Router v7 ya está instalado en modo librería; su *framework mode* trae SSR y export
`meta` por ruta. Next.js es la otra opción (`generateMetadata`).

- Ventaja: resuelve OG, SEO y el primer render lento, de raíz.
- Contra: es una migración real (loaders por ruta, `window`/`localStorage` en el cliente,
  los scripts de Openpay/Google/Apple, el build y el deploy). No es el siguiente paso.

### E. Un servicio de prerender (Prerender.io, Rendertron)

Renderiza con un navegador headless y sirve ese HTML a los bots.

- Ventaja: cero código.
- Contra: costo mensual, latencia, y una dependencia externa en el camino de compartir.

---

## Recomendación

**A** si controlan el edge/proxy, **B** si prefieren no tocar infra. Ambas son un archivo y
un endpoint, no una migración, y dejan a la SPA como está.

## Detalles para cuando se implemente

- `og:image` debe ser **URL absoluta** (`https://…`), no relativa. Ideal 1200×630 y < 8 MB
  (WhatsApp corta antes: mejor < 300 KB para que alcance a cargar la miniatura).
- `og:title` sin el nombre de la marca repetido: WhatsApp ya muestra el dominio abajo.
- `og:description` en texto plano. La descripción del evento viene como HTML del dashboard;
  usar `richTextToPlainText` (`src/utils/sanitizeHtml.ts`) o su equivalente en el back.
- WhatsApp y Facebook **cachean** la vista previa por URL. Para reprobar un cambio hay que
  usar el [Sharing Debugger](https://developers.facebook.com/tools/debug/) de Facebook.
- Las páginas de compra (`/terminar_compra/...`) y de perfil no deben llevar OG ni indexarse.
