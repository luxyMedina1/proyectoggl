// Tipos del CityPass público. Basados en docs/integracion/citypass-publico (backend).

export interface CityPassPrecio {
    tipoBoletoId: number;
    tipoBoleto: string;
    precio: number;
}

export interface CityPassCategoria {
    clave: string;
    nombre: string;
    disponible: boolean;
}

export interface CityPassGaleriaItem {
    url: string;
    orden: number;
}

export interface CityPassPaqueteLanding {
    id: number;
    nombre: string;
    textoComplementario: string | null;
    descripcion: string | null;
    imagenPrincipal: string | null;
    validezDias: number;
    cargoServicioPorcentaje: number;
    cargoTarjetaPorcentaje: number;
    fechaInicioVenta: string | null;
    fechaFinVenta: string | null;
    disponibleVenta: boolean;
    atraccionesCount: number;
    precios: CityPassPrecio[];
}

export interface CityPassComparativaPaquete {
    id: number;
    nombre: string;
    atraccionesIncluidas: number;
}

export interface CityPassComparativaAtraccion {
    atraccionId: number;
    nombre: string;
    imagenPrincipal: string | null;
    incluida: boolean[];
}

export interface CityPassComparativa {
    paquetes: CityPassComparativaPaquete[];
    atracciones: CityPassComparativaAtraccion[];
}

interface CityPassCiudad {
    id: number;
    nombre: string;
}

export interface CityPassLandingNoConfigurada {
    configurada: false;
    ciudad: CityPassCiudad;
    mensaje: string;
}

export interface CityPassLandingConfigurada {
    configurada: true;
    ciudad: CityPassCiudad;
    hero: { titulo: string; descripcion: string | null; imagen: string | null };
    categorias: CityPassCategoria[];
    paquetes: CityPassPaqueteLanding[];
    comparativa: CityPassComparativa;
    galeria: CityPassGaleriaItem[];
}

export type CityPassLanding = CityPassLandingConfigurada | CityPassLandingNoConfigurada;

// ---- Mis CityPass (compras, detalle de boletos, transferencias) ----

export interface CityPassAcceso {
    atraccionId: number;
    nombre: string;
    direccion?: string | null;
    imagen?: string | null;
    horario: string;
    quemado: boolean;
    fechaQuema: string | null;
}

// Remitente / destinatario embebido en el estado de transferencia de un boleto.
export interface CityPassUsuarioMini {
    id: string;
    nombre: string | null;
    imagen: string | null;
}

// Etiqueta de estado de transferencia de un boleto (viene en el detalle).
export interface CityPassTransferenciaBoleto {
    estado: 'en_proceso' | 'transferido';
    transferId: number | null; // id del pendiente (solo en_proceso) → cancelar/responder
    de: CityPassUsuarioMini | null; // remitente
    para: CityPassUsuarioMini | null; // destinatario / dueño actual
    fecha: string | null;
}

export interface CityPassPaqueteMin {
    id: number;
    nombre: string;
    imagenPrincipal: string | null;
    ciudad: { id: number; nombre: string } | null;
    validezDias?: number;
}

// mis-compras: una card por compra (con el paquete embebido).
export interface CityPassCompraResumen {
    id: number;
    fecha: string;
    estado: string;
    total: number;
    validezDias: number;
    paquete: CityPassPaqueteMin;
    atraccionesCount: number;
    boletosCount: number;
    accesosTotales: number;
    accesosUsados: number;
    completamenteUsado: boolean;
    vigente: boolean;
}

// mis-boletos: pases que el usuario posee ahora, agrupados por paquete.
export interface CityPassGrupoBoletos {
    paquete: CityPassPaqueteMin;
    boletos: CityPassBoletoDetalle[];
}

export type CityPassEstadoBoleto = 'sin_usar' | 'activo' | 'caducado';

export interface CityPassBoletoDetalle {
    id: number;
    compraId?: number | null;
    tipoBoleto: { id: number; nombre: string } | null;
    precioUnitario?: number | null;
    estado: CityPassEstadoBoleto;
    vigenciaIniciada: boolean;
    diasRestantes: number | null;
    activadoEn: string | null;
    expiraEn: string | null;
    accesos: CityPassAcceso[];
    esCompradorOriginal?: boolean; // el usuario compró este boleto
    esPropietarioActual?: boolean; // el usuario es su dueño actual
    puedeTransferir?: boolean; // botón Transferir
    puedeDevolver?: boolean; // botón Devolver al dueño original
    transferencia?: CityPassTransferenciaBoleto | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    qr: any | null;
}

// Pase que el comprador ya transfirió: shape reducido (sin accesos ni QR).
export interface CityPassBoletoTransferido {
    id: number;
    tipoBoleto: { id: number; nombre: string } | null;
    estado: string; // "transferido"
    transferidoA: CityPassUsuarioMini | null;
    fecha: string | null;
}

export interface CityPassCompraDetalle {
    id: number;
    fecha: string;
    estado: string;
    esComprador?: boolean; // true = comprador original (ve todos los boletos); false = receptor
    subtotal: number;
    cargoServicio: number;
    cargoTarjeta: number;
    total: number;
    validezDias: number;
    completamenteUsado?: boolean;
    accesosTotales?: number;
    accesosUsados?: number;
    paquete: CityPassPaqueteMin;
    boletos: CityPassBoletoDetalle[];
    // Pases que el comprador ya transfirió a otros (shape reducido, separados de los propios).
    transferidos?: CityPassBoletoTransferido[];
    // Tarjeta con la que se pagó (si el backend la expone).
    tarjeta?: { numero: string; marca: string; tipo: string; banco: string } | null;
}

export interface CityPassUsuarioMin {
    id: string;
    fullName?: string;
    email?: string;
    image?: string;
}

export interface CityPassTransferencia {
    id: number;
    estado: 'pendiente' | 'completada' | 'rechazada' | 'cancelada';
    tipoMovimiento: 'transferencia' | 'devolucion';
    createdAt: string;
    respondedAt: string | null;
    boleto: { id: number; paquete?: { id: number; nombre: string } } | null;
    fromUser: CityPassUsuarioMin;
    toUser: CityPassUsuarioMin;
}

// ---- Detalle de paquete (pantalla de compra, se construye en la siguiente iteración) ----

export interface CityPassImagen {
    url: string;
    orden: number;
}

export interface CityPassAtraccion {
    id: number;
    nombre: string;
    descripcion: string | null;
    direccion: string | null;
    imagenPrincipal: string | null;
    latitud: number | null;
    longitud: number | null;
    galeria: CityPassImagen[];
}

export interface CityPassPuntoMapa {
    atraccionId: number;
    nombre: string;
    descripcion: string | null;
    direccion: string | null;
    imagenPrincipal: string | null;
    latitud: number;
    longitud: number;
}

// ---- Compra (pago Openpay 3DS) ----

// Boleto seleccionado por el usuario (para el resumen y el checkout).
export interface CityPassItemCompra {
    tipoBoletoId: number;
    tipoBoleto: string;
    cantidad: number;
    precio: number;
}

export interface MakeCargoCityPassTarjeta {
    card_number: string;
    holder_name: string;
    expiration_year: string;
    expiration_month: string;
    cvv2: string;
    device_session_id?: string | null;
}

export interface MakeCargoCityPassBody {
    paqueteId: number;
    items: { tipoBoletoId: number; cantidad: number }[];
    tipoDispositivo: 'web' | 'app';
    device_session_id?: string | null;
    usuarioOpenpayId?: string | null;
    source_id?: string;
    tarjeta?: MakeCargoCityPassTarjeta;
}

export interface MakeCargoCityPassResponse {
    cargo: {
        id: string;
        status?: string;
        payment_method?: { type?: string; url?: string };
    };
    compraId: number;
}

export interface CheckCargoCityPassResponse {
    message: string;
    compraId: number;
    boletosEmitidos?: number;
}

export interface CityPassPaqueteDetalle {
    id: number;
    nombre: string;
    textoComplementario: string | null;
    descripcion: string | null;
    imagenPrincipal: string | null;
    validezDias: number;
    cargoServicioPorcentaje: number;
    cargoTarjetaPorcentaje: number;
    fechaInicioVenta: string | null;
    fechaFinVenta: string | null;
    disponibleVenta: boolean;
    ciudad: CityPassCiudad | null;
    atraccionesCount: number;
    precios: CityPassPrecio[];
    atracciones: CityPassAtraccion[];
    galeria: (CityPassImagen & { atraccionId: number; atraccionNombre: string })[];
    mapa: { puntos: CityPassPuntoMapa[] };
}
