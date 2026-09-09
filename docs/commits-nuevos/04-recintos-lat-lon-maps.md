# 4. Abrir Google Maps por coordenadas del recinto

Commit: `a2e80bb` — *Feat: usar lat y lon recintos*
Archivos: `src/utils/mapsHelpers.ts`, `src/components/DireccionMapsLink.tsx`, `src/eventos/pages/infoEventoPage.tsx`, `src/public/pages/HomePage.tsx`

## Por qué se hizo

El enlace a Google Maps se armaba solo con **texto de dirección** (`recinto, dirección, ciudad`). Eso abre una **pantalla de búsqueda con resultados**, que puede caer en el lugar equivocado o forzar al usuario a elegir. Cuando el recinto tiene **latitud y longitud**, es mucho mejor abrir directamente el punto exacto con un pin etiquetado.

Regla nueva: **si el recinto trae lat y lon, se usan esas coordenadas; si no, se cae a la dirección de texto** (comportamiento anterior).

## Qué cambió

### `src/utils/mapsHelpers.ts` — nuevo helper puro

```ts
export const coordenadasMapsUrl = (
  latitud: number | string | null | undefined,
  longitud: number | string | null | undefined,
  etiqueta?: string | null,
): string | null => {
  const lat = typeof latitud === 'string' ? Number(latitud) : latitud;
  const lng = typeof longitud === 'string' ? Number(longitud) : longitud;
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;

  const nombre = etiqueta?.trim();
  const query = nombre ? `${lat},${lng}(${nombre})` : `${lat},${lng}`;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}`;
};
```

- Devuelve `null` si alguna coordenada no es un número válido → deja que el llamador caiga a la dirección.
- Con `etiqueta` (nombre del recinto), usa la sintaxis `q=lat,lng(Nombre)`: **ancla un pin fijo en el punto exacto y lo etiqueta**, sin pantalla de resultados.

### `src/components/DireccionMapsLink.tsx` — nuevas props y prioridad

Nuevas props: `latitud`, `longitud`, `etiqueta`. La prioridad es coordenadas → dirección → texto plano:

```tsx
const href = coordenadasMapsUrl(latitud, longitud, etiqueta) ?? (consulta?.trim() ? mapsUrl(consulta) : null);
if (!href) return <>{contenido}</>;
```

### Consumidores

`infoEventoPage.tsx` y `HomePage.tsx` ahora pasan las coordenadas al componente, y se agregó `latitud?`/`longitud?` a las interfaces `Recinto`:

```tsx
<DireccionMapsLink
  consulta={consultaMaps(evento?.recinto?.nombre, evento?.recinto?.direccion, evento?.ciudad?.nombre)}
  latitud={evento?.recinto?.latitud}
  longitud={evento?.recinto?.longitud}
  etiqueta={evento?.recinto?.nombre}
>
  {evento?.recinto?.nombre}, {evento?.recinto?.direccion}
</DireccionMapsLink>
```

## Cómo migrar a v3 (Next.js)

1. Copia `coordenadasMapsUrl` a `mapsHelpers` de v3 (helper puro, sirve en server y cliente).
2. Extiende el tipo `Recinto` con `latitud?`/`longitud?` (`number | string | null`), y asegúrate de que el backend los exponga.
3. Reproduce la prioridad **coordenadas → dirección → texto plano** en el componente equivalente a `DireccionMapsLink`.
4. `DireccionMapsLink` solo renderiza un `<a>`: puede ser **Server Component** en Next (no necesita `"use client"`).
5. Mantén `target="_blank"` con `rel="noopener noreferrer"` por seguridad.
