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

- [ ] Eventos con `funciones[]` (ej. Sky Fest): cada función ya tiene su propia URL en el sitemap (`sky-fest-laguna-7-matutino`, `-vespertino`, etc.) — confirmar que cada una arma su `Event` JSON-LD leyendo `funciones[i].fecha`, no la fecha del evento raíz.

## `/eventos` (listado)

- [ ] `ItemList` schema apuntando a cada evento del listado
- [ ] Decidir estrategia de filtros: rutas dedicadas (`/eventos/durango`) vs query params + `canonical` a la versión sin filtrar
- [ ] Paginación indexable si aplica (`rel=next/prev` o rutas por página, no solo "cargar más" client-side)
- [ ] `priority` en la imagen del primer evento (LCP)
- [ ] Breadcrumb schema

## `/eventos/[slug]` — mapa de asientos

- [ ] Separar en Server Component (fetch, SVG estático, metadatos, JSON-LD) + Client Component chiquito (solo clicks/selección de asientos)
- [ ] Localizar el `dynamic(..., { ssr: false })` responsable del `BAILOUT_TO_CLIENT_SIDE_RENDERING` y reducir su alcance al mínimo necesario
- [ ] `/eventos/[slug]` (mapa, compra directa) vs `/eventos/informacion/[slug]` (ficha extendida, lista funciones si es multifunción): son páginas distintas a propósito, no duplicado. Diferenciar bien `title`/`description` entre las dos para evitar canibalización de keyword, e interlinkear (info → botón "comprar", cada función listada → su propia página de compra específica). No poner `canonical` de una hacia la otra.

## `/citypass/[ciudad]` y `/citypass/[ciudad]/paquete/[slug]`

- [ ] Convertir ambas a Server Component completo
- [x] `canonical` dinámico — ya resuelto
- [ ] Corregir `cache-control` (`no-store` → `s-maxage`/`stale-while-revalidate`)
- [ ] Listado: un `Product` JSON-LD por cada paquete mostrado (hoy solo manda uno), o un `ItemList`
- [ ] Detalle de paquete: implementar `generateMetadata` propio (título, description, canonical) y `Product` JSON-LD con los datos de ese paquete — hoy no tiene ninguno de los dos

## General / sitio completo

- [ ] `<lastmod>` en el sitemap (usar `updatedAt`, ya viene en la respuesta del evento)
- [ ] Evaluar 307 → 308 en el redirect de `/` a `/eventos`
- [ ] Exponer alias `/sitemap.xml` además de `/sitemap/0.xml`

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
