// DTOs de pago de abonos (reserva + cargo). Tipan los payloads que hoy viajan como `any`
// desde `abonos/[slug]/[seccionId]/[seccion]/page.tsx` hacia `useEventosStore`.
// Se modelan sobre la familia `MakeCargoCityPass*` de `types/CityPass.ts`. Un campo mal
// escrito aquí falla como 400 en mitad de la compra, no en compilación: por eso se tipan.

// ---- Reserva de abono (POST /abonos/:abonoId/reservar) ----

// Modo de selección de asientos para la reserva de un abono multifecha.
export type ModoSeleccionAbono = 'mismo_asiento' | 'por_funcion';

// Una selección concreta: qué asiento en qué función. Solo aplica al modo `por_funcion`.
export interface SeleccionAsientoFuncion {
    funcionId: number;
    asientoId: number;
}

// Payload de `reservarAbono`. El `modo` discrimina qué campo de asientos acompaña:
// - `mismo_asiento` → `asientoIds` (el mismo asiento en todas las funciones)
// - `por_funcion`   → `selecciones` (un asiento por función)
export interface ReservarAbonoBody {
    modo: ModoSeleccionAbono;
    asientoIds?: number[];
    selecciones?: SeleccionAsientoFuncion[];
}

// ---- Cargo de abono (POST /pagos/make/cargo_abono) ----

// Datos de tarjeta nueva para el cargo. Ausente cuando se paga con una tarjeta guardada
// (`source_id` + `usuarioOpenpayId`). Modelado sobre `MakeCargoCityPassTarjeta`.
export interface CargoAbonoTarjeta {
    card_number: string;
    holder_name: string;
    expiration_year: string;
    expiration_month: string;
    cvv2: string;
    device_session_id?: string | null;
}

// Payload de `comprarAbono`. `tarjeta` viene definida en pago con tarjeta nueva y como
// `undefined` cuando se reutiliza una tarjeta guardada (entonces llega `usuarioOpenpayId`).
export interface CargoAbonoBody {
    reservaId: string | null;
    abonoId: number;
    tipoDispositivo: 'web' | 'app';
    source_id: string;
    tarjeta?: CargoAbonoTarjeta;
    amount: number;
    device_session_id?: string | null;
    redirect_url: string;
    usuarioOpenpayId?: string | null;
}

// ---- Respuestas de pago (cargo / verificación) ----

// Respuesta de `comprarAbono`: el cargo Openpay (con posible redirect 3DS) y la transacción.
export interface CargoAbonoResponse {
    cargo: {
        id: string;
        status?: string;
        payment_method?: { type?: string; url?: string };
    };
}

// Respuesta de `checkCargoAbono` tras verificar el cargo.
export interface CheckCargoAbonoResponse {
    message?: string;
    reservaId?: string;
}
