/**
 * Limitador de peticiones por IP con ventana deslizante en memoria.
 *
 * Se usa en `app/api/revalidate/route.ts` ANTES de validar el secreto: el
 * endpoint compara el secreto con tiempo constante, pero sin límite un atacante
 * puede sondear el secreto en bucle o un backend con reintentos con bug puede
 * disparar tormentas de revalidación. El límite corta ambos casos.
 *
 * Store: `Map<string, number[]>` (IP → marcas de tiempo dentro de la ventana),
 * ventana deslizante de 60 s y límite ~10.
 *
 * Caveat serverless: en despliegues con múltiples instancias este `Map` es
 * por instancia, no global, así que el límite efectivo se multiplica por el
 * número de instancias. Es aceptable para frenar el sondeo trivial del secreto;
 * un límite global exacto exigiría un store compartido (Redis/KV), fuera de
 * alcance y anotado como seguimiento.
 */

export const ventanaMs = 60_000;
export const limite = 10;

const store = new Map<string, number[]>();

/**
 * ¿Se permite una petición de `ip` en el instante `ahora`?
 *
 * Función pura respecto a sus argumentos salvo por el store en memoria; el
 * parámetro `ahora` es inyectable para poder probar la ventana de forma
 * determinista. Devuelve `true` y registra la petición cuando cabe en la
 * ventana; devuelve `false` sin registrarla cuando la ventana ya está llena.
 */
export const permitido = (ip: string, ahora = Date.now()): boolean => {
  // Solo cuentan las peticiones dentro de la ventana deslizante actual.
  const previos = (store.get(ip) ?? []).filter((t) => ahora - t < ventanaMs);
  if (previos.length >= limite) {
    store.set(ip, previos); // conserva la ventana, no cuenta el rechazado
    return false;
  }
  previos.push(ahora);
  store.set(ip, previos);
  return true;
};

/**
 * Limpia el store. Solo para tests: evita que el estado se filtre entre casos.
 */
export const _resetStore = (): void => {
  store.clear();
};
