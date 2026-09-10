// Helpers para leer el error que propaga axios cuando el backend responde con un
// status de error. Ese error trae el cuerpo JSON del backend en `error.response.data`;
// como el backend no expone un contrato fuerte, se tipa laxo pero con las claves que el
// front lee de verdad (mensaje, disponibilidad). Sustituyen al `catch (error: any)` que
// se repetía en ~19 archivos (frente B2, deuda de lint).

export interface CuerpoErrorApi {
  message?: string;
  // Presentes en los flujos de reserva cuando un asiento ya no está disponible.
  noDisponibles?: unknown;
  completo?: boolean;
  [clave: string]: unknown;
}

interface ErrorConRespuesta {
  response?: { data?: CuerpoErrorApi | null; status?: number };
}

// Cuerpo de error del backend, o `undefined` si el error no tiene esa forma
// (error de red, timeout, `throw new Error(...)` manual, etc.). Nunca lanza.
export const cuerpoDeErrorApi = (error: unknown): CuerpoErrorApi | undefined =>
  (error as ErrorConRespuesta | null | undefined)?.response?.data ?? undefined;

// Status HTTP de la respuesta de error, si lo hubo.
export const statusDeErrorApi = (error: unknown): number | undefined =>
  (error as ErrorConRespuesta | null | undefined)?.response?.status;

// El `message` que mandó el backend si vino como texto no vacío; si no, el `fallback`.
export const mensajeDeErrorApi = (error: unknown, fallback: string): string => {
  const msg = cuerpoDeErrorApi(error)?.message;
  return typeof msg === "string" && msg.trim() ? msg : fallback;
};
