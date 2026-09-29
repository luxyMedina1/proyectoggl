// URL de busqueda en Google Maps para una direccion.
export const mapsUrl = (direccion: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;

// URL de Google Maps a partir de coordenadas. Devuelve null si alguna no es un
// numero valido, para que quien la use pueda caer de vuelta a la direccion.
export const coordenadasMapsUrl = (
  latitud: number | string | null | undefined,
  longitud: number | string | null | undefined,
): string | null => {
  const lat = typeof latitud === 'string' ? Number(latitud) : latitud;
  const lng = typeof longitud === 'string' ? Number(longitud) : longitud;
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;

  return mapsUrl(`${lat},${lng}`);
};

// Une recinto / direccion / ciudad en una sola consulta para Maps.
export const consultaMaps = (...partes: (string | null | undefined)[]) =>
  partes
    .map((parte) => parte?.trim())
    .filter((parte): parte is string => !!parte)
    .join(', ');
