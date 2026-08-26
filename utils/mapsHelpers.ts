// URL de busqueda en Google Maps para una direccion.
export const mapsUrl = (direccion: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;

// Une recinto / direccion / ciudad en una sola consulta para Maps.
export const consultaMaps = (...partes: (string | null | undefined)[]) =>
  partes
    .map((parte) => parte?.trim())
    .filter((parte): parte is string => !!parte)
    .join(', ');
