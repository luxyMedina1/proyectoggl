// Helper puro de promociones (refactorización pura).
// Este módulo centraliza tipos y utilidades de promociones compartidas por los
// flujos de compra (generales, numerados y conferencias). No realiza llamadas a
// API, no muestra toasts/Swal y no lee estado de componentes.

export type TipoPromocion = 'PORCENTAJE' | 'CANTIDAD' | 'RESTA';

/**
 * Forma de una categoría dentro de una promoción. Los tres flujos usan una de
 * dos variantes de acceso al nombre. Ambas se modelan como opcionales para
 * reflejar los datos reales (que pueden traer null/undefined).
 */
export interface PromoCategoria {
  categoria?: { nombre: string | null } | null;         // usado por Numerados
  categoriaGeneral?: { nombre: string | null } | null;  // usado por Generales/Conferencias
}

export interface Promocion {
  id: number;
  nombre: string;
  tipo: TipoPromocion;
  porcentaje: number | string; // el código real usa number en boletos y parseFloat en numerados
  cantidadCompra: number;
  cantidadPaga: number;
  /**
   * Monto fijo a restar por asiento/boleto que califica. Solo aplica a
   * promociones de tipo RESTA. La API puede devolverlo como string (columna
   * numeric) y llega como null para PORCENTAJE/CANTIDAD.
   */
  cantidadResta?: number | string | null;
  aplicaTodoEvento: boolean;
  categorias: PromoCategoria[];
  descuentoCalculado: number;
}

/**
 * Salida de la variante "por boletos" (Generales/Conferencias).
 * Incluye precioFinal, tal como hoy.
 */
export interface MejorPromoPorBoletos extends Promocion {
  descuentoCalculado: number;
  precioFinal: number;
}

/**
 * Salida de la variante "por asientos" (Numerados).
 * NO incluye precioFinal, tal como hoy: sólo se sobrescribe descuentoCalculado.
 */
export interface MejorPromoPorAsientos extends Promocion {
  descuentoCalculado: number;
}

/** Asiento tal como lo usa el flujo numerado. */
export interface Asiento {
  id: number | string;
  categoria: string;
  precio: number | string;
  // otros campos del asiento se preservan vía spread donde aplique
  [key: string]: unknown;
}

/**
 * Selector del nombre de categoría. Permite soportar ambas variantes sin
 * cambiar el comportamiento: Generales/Conferencias pasan CATEGORIA_GENERAL_ACCESSOR,
 * Numerados pasan CATEGORIA_NUMERADA_ACCESSOR.
 */
export type CategoriaAccessor = (c: PromoCategoria) => string | null | undefined;

export const CATEGORIA_GENERAL_ACCESSOR: CategoriaAccessor =
  (c) => c.categoriaGeneral?.nombre;

export const CATEGORIA_NUMERADA_ACCESSOR: CategoriaAccessor =
  (c) => c.categoria?.nombre;

/**
 * Deriva los nombres de categoría válidos de una promoción, descartando null/undefined.
 * Valida: Requirement 4.4.
 */
export function categoriasValidasDePromo(
  promo: Pick<Promocion, 'categorias'>,
  accessor: CategoriaAccessor
): string[] {
  return promo.categorias
    .map(accessor)
    .filter((nombre): nombre is string => nombre !== null && nombre !== undefined);
}
// ---------------------------------------------------------------------------
// Helpers de cálculo de descuento
// ---------------------------------------------------------------------------

/**
 * PORCENTAJE por boletos (Generales/Conferencias):
 * (precioBoleto * cantidadBoletos * porcentaje) / 100
 * Valida: Requirement 2.1.
 */
export function calcularDescuentoPorcentajePorBoletos(
  precioBoleto: number,
  cantidadBoletos: number,
  porcentaje: number
): number {
  return (precioBoleto * cantidadBoletos * porcentaje) / 100;
}

/**
 * CANTIDAD por boletos (Generales/Conferencias):
 * gruposCompletos = floor(cantidadBoletos / cantidadCompra)
 * boletosGratis   = gruposCompletos * (cantidadCompra - cantidadPaga)
 * descuento       = boletosGratis * precioBoleto
 * Valida: Requirement 3.1.
 */
export function calcularDescuentoCantidadPorBoletos(
  precioBoleto: number,
  cantidadBoletos: number,
  cantidadCompra: number,
  cantidadPaga: number
): number {
  const gruposCompletos = Math.floor(cantidadBoletos / cantidadCompra);
  const boletosGratis = gruposCompletos * (cantidadCompra - cantidadPaga);
  return boletosGratis * precioBoleto;
}

/**
 * Total nuevo tras aplicar un descuento, nunca negativo.
 * Valida: Requirements 2.3, 3.3.
 */
export function calcularTotalNuevo(total: number, descuento: number): number {
  return Math.max(0, total - descuento);
}

/**
 * PORCENTAJE por subtotales de categoría (Numerados):
 * suma de subtotal * (porcentaje/100) sobre las categorías donde
 * aplicaTodoEvento || categoriasAplicables.includes(categoria).
 * Valida: Requirement 2.2.
 */
export function calcularDescuentoPorcentajePorCategoria(
  subtotalesPorCategoria: Record<string, number>,
  porcentaje: number,
  aplicaTodoEvento: boolean,
  categoriasAplicables: string[]
): number {
  let descuentoTotal = 0;
  Object.entries(subtotalesPorCategoria).forEach(([categoria, subtotal]) => {
    if (aplicaTodoEvento || categoriasAplicables.includes(categoria)) {
      descuentoTotal += subtotal * (porcentaje / 100);
    }
  });
  return descuentoTotal;
}

/**
 * Agrupa asientos por categoría y luego por precio.
 * Replica el reduce usado en Numerados.
 * Valida: soporte para Requirements 3.2.
 */
export function asientosPorCategoriaPrecio(
  asientos: Asiento[]
): Record<string, Record<string, Asiento[]>> {
  return asientos.reduce((acc: Record<string, Record<string, Asiento[]>>, asiento) => {
    const categoria = asiento.categoria;
    const precio = String(asiento.precio);
    if (!acc[categoria]) acc[categoria] = {};
    if (!acc[categoria][precio]) acc[categoria][precio] = [];
    acc[categoria][precio].push(asiento);
    return acc;
  }, {});
}

/**
 * CANTIDAD por asientos agrupados por categoría/precio (Numerados).
 * Por cada grupo completo de cantidadCompra asientos de una misma categoría y
 * precio, acumula el precio de los asientos ubicados después de los primeros
 * cantidadPaga del grupo. Devuelve { descuentoTotal, algunaCategoriaCumple }.
 * Valida: Requirement 3.2, y soporta la validación 7.2 (a través de algunaCategoriaCumple).
 */
export function calcularDescuentoCantidadPorAsientos(
  asientos: Asiento[],
  cantidadCompra: number,
  cantidadPaga: number,
  aplicaTodoEvento: boolean,
  categoriasAplicables: string[]
): { descuentoTotal: number; algunaCategoriaCumple: boolean } {
  const agrupados = asientosPorCategoriaPrecio(asientos);
  let descuentoTotal = 0;
  let algunaCategoriaCumple = false;

  Object.entries(agrupados).forEach(([categoria, preciosObj]) => {
    if (!aplicaTodoEvento && !categoriasAplicables.includes(categoria)) {
      return;
    }
    Object.entries(preciosObj).forEach(([, asientosGrupo]) => {
      const cantidad = asientosGrupo.length;
      const grupos = Math.floor(cantidad / cantidadCompra);
      if (cantidad >= cantidadCompra) {
        algunaCategoriaCumple = true;
      }
      for (let i = 0; i < grupos; i++) {
        const grupo = asientosGrupo.slice(i * cantidadCompra, (i + 1) * cantidadCompra);
        const gratis = grupo.slice(cantidadPaga);
        descuentoTotal += gratis.reduce((acc, a) => acc + Number(a.precio), 0);
      }
    });
  });

  return { descuentoTotal, algunaCategoriaCumple };
}

/**
 * RESTA por asientos (Numerados): descuenta un monto fijo (cantidadResta) por
 * cada asiento que califica, con piso por asiento: descuentoAsiento = min(cantidadResta, precioAsiento).
 * Solo cuentan asientos cuya categoría esté en categoriasAplicables cuando !aplicaTodoEvento.
 * Devuelve { descuentoTotal, algunaCategoriaCumple } para alinear con el patrón de CANTIDAD.
 */
export function calcularDescuentoRestaPorAsientos(
  asientos: Asiento[],
  cantidadResta: number,
  aplicaTodoEvento: boolean,
  categoriasAplicables: string[]
): { descuentoTotal: number; algunaCategoriaCumple: boolean } {
  let descuentoTotal = 0;
  let algunaCategoriaCumple = false;

  asientos.forEach((asiento) => {
    if (aplicaTodoEvento || categoriasAplicables.includes(asiento.categoria)) {
      algunaCategoriaCumple = true;
      descuentoTotal += Math.min(Number(cantidadResta), Number(asiento.precio));
    }
  });

  return { descuentoTotal: Math.round(descuentoTotal * 100) / 100, algunaCategoriaCumple };
}

/**
 * Devuelve el descuento DESGLOSADO POR CATEGORÍA para la variante por asientos,
 * según el tipo de promoción. Las categorías no aplicables (o sin descuento)
 * no aparecen en el resultado (o aparecen con 0). Sirve para recalcular cargos
 * por servicio/tarjeta sobre subtotales ya descontados por categoría.
 *
 * - PORCENTAJE: por cada categoría aplicable, subtotalCategoria * (porcentaje/100).
 * - RESTA: por cada asiento que califica, min(cantidadResta, precioAsiento), acumulado por su categoría.
 * - CANTIDAD: agrupa por categoría/precio; por cada grupo completo de cantidadCompra,
 *   acumula el precio de los asientos gratis (los que exceden cantidadPaga) en su categoría.
 *
 * La suma de los valores devueltos es igual (con tolerancia de redondeo) al
 * descuentoTotal que devuelven calcularDescuentoRestaPorAsientos /
 * calcularDescuentoCantidadPorAsientos / calcularDescuentoPorcentajePorCategoria
 * para los mismos inputs.
 */
export function calcularDescuentoPorCategoriaDeAsientos(
  promo: Pick<Promocion, 'tipo' | 'porcentaje' | 'cantidadResta' | 'cantidadCompra' | 'cantidadPaga' | 'aplicaTodoEvento'>,
  asientos: Asiento[],
  subtotalesPorCategoria: Record<string, number>,
  categoriasAplicables: string[]
): Record<string, number> {
  const aplica = (categoria: string): boolean =>
    promo.aplicaTodoEvento || categoriasAplicables.includes(categoria);

  const resultado: Record<string, number> = {};

  if (promo.tipo === 'PORCENTAJE') {
    Object.entries(subtotalesPorCategoria).forEach(([categoria, subtotal]) => {
      if (aplica(categoria)) {
        resultado[categoria] = (resultado[categoria] ?? 0) + subtotal * (Number(promo.porcentaje) / 100);
      }
    });
  } else if (promo.tipo === 'RESTA') {
    asientos.forEach((asiento) => {
      if (aplica(asiento.categoria)) {
        resultado[asiento.categoria] =
          (resultado[asiento.categoria] ?? 0) +
          Math.min(Number(promo.cantidadResta), Number(asiento.precio));
      }
    });
    // Redondea cada acumulado por categoría a 2 decimales, igual que
    // calcularDescuentoRestaPorAsientos redondea el total.
    Object.keys(resultado).forEach((categoria) => {
      resultado[categoria] = Math.round(resultado[categoria] * 100) / 100;
    });
  } else if (promo.tipo === 'CANTIDAD') {
    const agrupados = asientosPorCategoriaPrecio(asientos);
    Object.entries(agrupados).forEach(([categoria, preciosObj]) => {
      if (!aplica(categoria)) return;
      Object.entries(preciosObj).forEach(([, asientosGrupo]) => {
        const cantidad = asientosGrupo.length;
        const grupos = Math.floor(cantidad / Number(promo.cantidadCompra));
        for (let i = 0; i < grupos; i++) {
          const grupo = asientosGrupo.slice(
            i * Number(promo.cantidadCompra),
            (i + 1) * Number(promo.cantidadCompra)
          );
          const gratis = grupo.slice(Number(promo.cantidadPaga));
          resultado[categoria] =
            (resultado[categoria] ?? 0) +
            gratis.reduce((acc, a) => acc + Number(a.precio), 0);
        }
      });
    });
  }

  // Omite las categorías con descuento 0 (o negativo por seguridad).
  Object.keys(resultado).forEach((categoria) => {
    if (!(resultado[categoria] > 0)) {
      delete resultado[categoria];
    }
  });

  return resultado;
}

/**
 * RESTA por boletos (Generales/Conferencias): todos los boletos son del mismo
 * precio (precioBoleto). Descuento = min(cantidadResta, precioBoleto) * cantidadBoletos.
 * El piso por asiento evita descuento mayor al precio del boleto.
 */
export function calcularDescuentoRestaPorBoletos(
  precioBoleto: number,
  cantidadBoletos: number,
  cantidadResta: number
): number {
  return (
    Math.round(
      Math.min(Number(cantidadResta), Number(precioBoleto)) * cantidadBoletos * 100
    ) / 100
  );
}
// ---------------------------------------------------------------------------
// Filtrado de promociones aplicables (dos variantes por flujo)
// ---------------------------------------------------------------------------

/**
 * Variante Generales/Conferencias: categoria es un string; se conserva
 * promo.aplicaTodoEvento OR categorias.includes(categoria).
 * Usa CATEGORIA_GENERAL_ACCESSOR.
 * Valida: Requirements 5.1, 5.2, 4.1, 4.2.
 */
export function filtrarPromocionesAplicablesPorCategoria(
  promociones: Promocion[],
  categoria: string
): Promocion[] {
  return promociones.filter((promo) => {
    if (promo.aplicaTodoEvento) return true;
    const categoriasGenerales = categoriasValidasDePromo(promo, CATEGORIA_GENERAL_ACCESSOR);
    return categoriasGenerales.includes(categoria);
  });
}

/**
 * Variante Numerados: categorias es un array; se conserva
 * promo.aplicaTodoEvento OR categoriasN.some(cat => categorias.includes(cat)).
 * Usa CATEGORIA_NUMERADA_ACCESSOR.
 * Valida: Requirements 5.1, 5.2, 4.1, 4.3.
 */
export function filtrarPromocionesAplicablesPorCategorias(
  promociones: Promocion[],
  categorias: string[]
): Promocion[] {
  return promociones.filter((promo) => {
    if (promo.aplicaTodoEvento) return true;
    const categoriasN = categoriasValidasDePromo(promo, CATEGORIA_NUMERADA_ACCESSOR);
    return categoriasN.some((cat) => categorias.includes(cat));
  });
}
// ---------------------------------------------------------------------------
// Selección de la mejor promoción (dos variantes por flujo)
// ---------------------------------------------------------------------------

/**
 * Selecciona la promoción de mayor descuento para la variante por boletos.
 * PORCENTAJE y CANTIDAD calculados con los helpers "PorBoletos".
 * Selección con comparación estricta (>) contra el mayor descuento acumulado.
 * Devuelve promo con descuentoCalculado y precioFinal, o null.
 * Valida: Requirements 6.1, 6.2, 6.3, 6.4.
 */
export function obtenerMejorPromocionPorBoletos(
  promocionesAplicables: Promocion[],
  cantidadBoletos: number,
  precioBoleto: number
): MejorPromoPorBoletos | null {
  if (!promocionesAplicables || promocionesAplicables.length === 0) {
    return null;
  }
  let mejorPromocion: MejorPromoPorBoletos | null = null;
  let mayorDescuento = 0;

  promocionesAplicables.forEach((promo) => {
    let descuentoTotal = 0;
    if (promo.tipo === 'PORCENTAJE') {
      descuentoTotal = calcularDescuentoPorcentajePorBoletos(
        precioBoleto, cantidadBoletos, Number(promo.porcentaje)
      );
    } else if (promo.tipo === 'CANTIDAD') {
      descuentoTotal = calcularDescuentoCantidadPorBoletos(
        precioBoleto, cantidadBoletos, promo.cantidadCompra, promo.cantidadPaga
      );
    } else if (promo.tipo === 'RESTA') {
      descuentoTotal = calcularDescuentoRestaPorBoletos(
        precioBoleto, cantidadBoletos, Number(promo.cantidadResta)
      );
    }
    if (descuentoTotal > mayorDescuento) {
      mayorDescuento = descuentoTotal;
      mejorPromocion = {
        ...promo,
        descuentoCalculado: descuentoTotal,
        precioFinal: (precioBoleto * cantidadBoletos) - descuentoTotal,
      };
    }
  });

  return mejorPromocion;
}

/**
 * Selecciona la promoción de mayor descuento para la variante por asientos.
 * PORCENTAJE usa subtotales por categoría; CANTIDAD usa agrupación por
 * categoría/precio y descarta la promo si ninguna categoría cumple.
 * Selección con comparación estricta (>). Devuelve promo con descuentoCalculado
 * (SIN precioFinal), o null.
 * Valida: Requirements 6.1, 6.2, 6.4, 2.2, 3.2.
 */
export function obtenerMejorPromocionPorAsientos(
  promocionesAplicables: Promocion[],
  asientosSeleccionados: Asiento[],
  subtotalesPorCategoria: Record<string, number>
): MejorPromoPorAsientos | null {
  if (!promocionesAplicables || promocionesAplicables.length === 0) {
    return null;
  }
  let mejorPromocion: MejorPromoPorAsientos | null = null;
  let mayorDescuento = 0;

  promocionesAplicables.forEach((promo) => {
    let descuentoTotal = 0;
    const categoriasAsientos = [...new Set(asientosSeleccionados.map((a) => a.categoria))];

    let categoriasAplicables: string[] = [];
    if (!promo.aplicaTodoEvento) {
      const categoriasValidas = categoriasValidasDePromo(promo, CATEGORIA_NUMERADA_ACCESSOR);
      categoriasAplicables = categoriasAsientos.filter((cat) => categoriasValidas.includes(cat));
      if (categoriasAplicables.length === 0) {
        return; // salta esta promo
      }
    }

    if (promo.tipo === 'PORCENTAJE') {
      descuentoTotal = calcularDescuentoPorcentajePorCategoria(
        subtotalesPorCategoria,
        Number(promo.porcentaje),
        promo.aplicaTodoEvento,
        categoriasAplicables
      );
    } else if (promo.tipo === 'CANTIDAD') {
      const { descuentoTotal: d, algunaCategoriaCumple } = calcularDescuentoCantidadPorAsientos(
        asientosSeleccionados,
        promo.cantidadCompra,
        promo.cantidadPaga,
        promo.aplicaTodoEvento,
        categoriasAplicables
      );
      if (!algunaCategoriaCumple) {
        return; // no cumple requisitos
      }
      descuentoTotal = d;
    } else if (promo.tipo === 'RESTA') {
      const { descuentoTotal: d, algunaCategoriaCumple } = calcularDescuentoRestaPorAsientos(
        asientosSeleccionados,
        Number(promo.cantidadResta),
        promo.aplicaTodoEvento,
        categoriasAplicables
      );
      if (!algunaCategoriaCumple) {
        return; // ninguna categoría cumple
      }
      descuentoTotal = d;
    }

    if (descuentoTotal > mayorDescuento) {
      mayorDescuento = descuentoTotal;
      mejorPromocion = { ...promo, descuentoCalculado: descuentoTotal };
    }
  });

  return mejorPromocion;
}
// ---------------------------------------------------------------------------
// Normalización de auto-aplicación (pura)
// ---------------------------------------------------------------------------

/**
 * Normaliza la lista `promocionesAplicaDirecto` que devuelven los endpoints
 * validar_promo_web/pv/app. Es PURA: no hace la llamada HTTP (eso queda en el page).
 * - Copia cada promo (no muta el arreglo original).
 * - Convierte cantidadResta a number cuando viene como string (deja null/undefined como está).
 * - Si `conPorcentajeOriginal` es true, añade `porcentaje_original = porcentaje` (para flujos pareja/familia: numerados y abonos).
 */
export function normalizarPromocionesAplicaDirecto(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promociones: any[],
  conPorcentajeOriginal: boolean = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  if (!promociones) return [];
  return promociones.map((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normalizada: any = { ...p };
    if (p.cantidadResta != null) {
      normalizada.cantidadResta = Number(p.cantidadResta);
    }
    if (conPorcentajeOriginal) {
      normalizada.porcentaje_original = p.porcentaje;
    }
    return normalizada;
  });
}
