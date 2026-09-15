# Checklist Frontend — Taquilla Vip

## JSON-LD de evento (una vez el backend mande los campos de `seo` y `recinto.lat/long`)

```ts
function buildEventJsonLd(evento: EventoAPI) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: evento.nombre,
    startDate: evento.fecha,
    endDate: evento.finalEvento ?? undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    image: [evento.imagenPromocion],
    location: {
      "@type": "Place",
      name: evento.recinto.nombre,
      address: {
        "@type": "PostalAddress",
        streetAddress: evento.recinto.direccion,
        addressLocality: evento.ciudad.nombre,
        addressCountry: "MX",
      },
      geo:
        evento.recinto.latitud != null && evento.recinto.longitud != null
          ? {
              "@type": "GeoCoordinates",
              latitude: evento.recinto.latitud,
              longitude: evento.recinto.longitud,
            }
          : undefined,
    },
    performer: evento.artista
      ? { "@type": "PerformingGroup", name: evento.artista.nombre.trim() }
      : undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: evento.seo.moneda,
      lowPrice: evento.seo.precioMinimo ?? undefined,
      highPrice: evento.seo.precioMaximo ?? undefined,
      availability: `https://schema.org/${evento.seo.disponibilidad}`,
      url: `https://taquillavip.com/eventos/${evento.slug}`,
    },
  };
}
```

- [x] Eventos con `funciones[]` (ej. Sky Fest): cada función ya tiene su propia URL en el sitemap (`sky-fest-laguna-7-matutino`, `-vespertino`, etc.) — confirmar que cada una arma su `Event` JSON-LD leyendo `funciones[i].fecha`, no la fecha del evento raíz. — resuelto en `construirEventosJsonLd` (`utils/jsonLdEvento.ts`): un `Event` por función con `fecha: funcion.fecha`, cubierto por `jsonLdEvento.property1/2/3.test.ts`.

## `/eventos` (listado)

- [x] `ItemList` schema apuntando a cada evento del listado — resuelto en `construirItemListEventosJsonLd`, wireado en `app/(site)/eventos/page.tsx`.
- [x] Decidir estrategia de filtros: rutas dedicadas (`/eventos/durango`) vs query params + `canonical` a la versión sin filtrar — decidido por query params (`?ciudad=`, `?buscar=`, filtrado client-side en `EventosView`); `generateMetadata` de `/eventos` fija `canonical` siempre a la URL sin filtrar.
- [ ] Paginación indexable si aplica (`rel=next/prev` o rutas por página, no solo "cargar más" client-side) — sigue sin implementar: `EventosView` trae el listado completo de una sola vez, sin paginar. Falta decidir si hace falta según el volumen real de eventos antes de construirla.
- [x] `priority` en la imagen del primer evento (LCP) — resuelto: el primer slide del hero usa `next/image` con `preload={index === 0}` (equivalente a `priority` en Next 16), ver `EventosView.tsx`.
- [x] Breadcrumb schema — resuelto en `construirBreadcrumbEventosJsonLd` (Inicio → Eventos), wireado en `app/(site)/eventos/page.tsx`.

## `/eventos/[slug]` — mapa de asientos

- [ ] Separar en Server Component (fetch, SVG estático, metadatos, JSON-LD) + Client Component chiquito (solo clicks/selección de asientos) — **sigue pendiente y es grande**: `EventoDetalleView.tsx` tiene ~2500 líneas, todo `"use client"`, y el SVG del recinto (`evento.recinto.svg`) llega en el mismo fetch de cliente que la disponibilidad de asientos (`getDetalleEventos` con `SIN_CACHE_DISPONIBILIDAD`, a propósito nunca cacheada — Req 26.3). Separar el SVG estático del Server Component sin tocar el flujo de disponibilidad/compra necesita su propia sesión dedicada, no un cambio de una sentada.
- [ ] Localizar el `dynamic(..., { ssr: false })` responsable del `BAILOUT_TO_CLIENT_SIDE_RENDERING` y reducir su alcance al mínimo necesario — no encontré ningún `dynamic(..., { ssr: false })` en el árbol de `/eventos/[slug]` hoy (sí hay uno nuevo en CityPass, `MapaAtraccionesIsla.tsx`, sin relación). O ya se resolvió en un commit anterior sin actualizar este checklist, o el bailout viene de otro lado (p. ej. `useSearchParams` sin `Suspense`, como se resolvió en `EventosView`). Antes de tocar nada aquí, correr `next build` y revisar si el warning `BAILOUT_TO_CLIENT_SIDE_RENDERING` sigue apareciendo — no lo vi en el build que corrí hoy.
- [x] `/eventos/[slug]` (mapa, compra directa) vs `/eventos/informacion/[slug]` (ficha extendida, lista funciones si es multifunción): son páginas distintas a propósito, no duplicado. Diferenciar bien `title`/`description` entre las dos para evitar canibalización de keyword, e interlinkear (info → botón "comprar", cada función listada → su propia página de compra específica). No poner `canonical` de una hacia la otra. — resuelto en `buildMetadataEvento(slug, "detalle" | "informacion")` (`utils/ogEvento.ts`); interlink verificado en `InfoEventoView.tsx` (botón "Comprar boletos" y un `href={rutaEvento(evento, funcion)}` por función).

## `/citypass/[ciudad]` y `/citypass/[ciudad]/paquete/[slug]`

- [x] `/citypass/[ciudad]` (landing): Server Component completo — resuelve `getLandingCityPass`/`getPaquetesCityPass` en el servidor y le pasa el landing ya armado a `CityPassPage` como prop, ya no es `"use client"` pidiendo sus propios datos.
- [ ] `/citypass/[ciudad]/paquete/[slug]` (detalle): sigue como cascarón — `generateMetadata` y el `Product` JSON-LD ya corren en servidor, pero `CityPassPaquetePage` sigue siendo `"use client"` y vuelve a pedir el detalle por su cuenta (fetch duplicado). Falta pasarle el paquete ya resuelto como prop para terminar la conversión.
- [x] `canonical` dinámico — ya resuelto
- [x] `/citypass/[ciudad]` (landing): `cache-control` corregido — tiene `export const revalidate = 3_600` + `generateStaticParams`, ya no responde `no-store`.
- [ ] `/citypass/[ciudad]/paquete/[slug]` (detalle): sigue sin `revalidate`/`generateStaticParams` propios — falta corregir su `cache-control` igual que se hizo en la landing.
- [x] Listado: un `Product` JSON-LD por cada paquete mostrado — resuelto en `citypass/[slug]/page.tsx` (`paquetes.map(construirProductJsonLd)`), ya no manda solo uno.
- [x] Detalle de paquete: `generateMetadata` propio (título, description, canonical) y `Product` JSON-LD con los datos de ese paquete — resuelto en `citypass/[slug]/paquete/[paqueteSlug]/page.tsx`.

## General / sitio completo

- [x] `<lastmod>` en el sitemap (usar `updatedAt`, ya viene en la respuesta del evento) — ya resuelto: `construirRutasEventos` en `app/sitemap.ts` fija `lastModified: new Date(evento.actualizadoEn)`.
- [x] Evaluar 307 → 308 en el redirect de `/` a `/eventos` — decidido por 308: `/` nunca sirve contenido propio y no hay plan de que deje de redirigir, así que usa `permanentRedirect` en vez de `redirect` (`app/page.tsx`).
- [x] Exponer alias `/sitemap.xml` además de `/sitemap/0.xml` — resuelto con un `rewrite` en `next.config.ts` (`/sitemap.xml` → `/sitemap/0.xml`); `robots.ts` ya apuntaba a la ruta real, esto es solo para quien visite el alias convencional a mano.

---

## Interfaz de datos (contrato con backend)

```ts
interface EventoAPI {
  // ...todos los campos actuales sin tocar...

  recinto: {
    id: number;
    nombre: string;
    direccion: string;
    latitud: number | null;
    longitud: number | null;
  };

  seo: {
    precioMinimo: number | null;
    precioMaximo: number | null;
    moneda: string;                 // "MXN"
    disponibilidad: "InStock" | "SoldOut" | "LimitedAvailability"; // eventos no manejan PreOrder
  };
}

interface PaqueteCityPassAPI {
  id: number;
  slug: string | null;   // null en paquetes viejos hasta que se resalven desde el admin
  nombre: string;
  descripcion: string;
  imagenPrincipal: string;   // ojo: NO "imagen"
  ciudad: {
    id: number;
    nombre: string;
  };

  seo: {
    precio: number;
    moneda: string;                 // "MXN"
    disponibilidad: "InStock" | "SoldOut" | "LimitedAvailability" | "PreOrder"; // PreOrder solo en CityPass
  };
}
```

`GET /citypass/publico/paquete/slug/:slug` ya existe (acepta id numérico también) — úsalo en `generateMetadata` del detalle de paquete en vez del endpoint viejo.
