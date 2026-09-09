import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  categoriasValidasDePromo,
  CATEGORIA_GENERAL_ACCESSOR,
  CATEGORIA_NUMERADA_ACCESSOR,
  type PromoCategoria,
} from './promociones';

/**
 * Feature: promociones-helper-compartido, Property 8: Descarte de categorías nulas
 *
 * Para toda promoción cuyas categorías contengan nombres null o undefined,
 * categoriasValidasDePromo (con cualquiera de los dos accessors) nunca incluye
 * esos valores en el resultado.
 *
 * Validates: Requirements 4.4
 */
describe('Property 8: Descarte de categorías nulas', () => {
  // Genera un nombre que puede ser un string, null o undefined.
  const nombreArb: fc.Arbitrary<string | null | undefined> = fc.oneof(
    fc.string(),
    fc.constant(null),
    fc.constant(undefined)
  );

  it('categoriasValidasDePromo (CATEGORIA_GENERAL_ACCESSOR) nunca devuelve null/undefined', () => {
    fc.assert(
      fc.property(fc.array(nombreArb), (nombres) => {
        const categorias: PromoCategoria[] = nombres.map((nombre) => ({
          categoriaGeneral: nombre === undefined ? undefined : { nombre },
        }));

        const resultado = categoriasValidasDePromo(
          { categorias },
          CATEGORIA_GENERAL_ACCESSOR
        );

        expect(
          resultado.every((n) => n !== null && n !== undefined)
        ).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('categoriasValidasDePromo (CATEGORIA_NUMERADA_ACCESSOR) nunca devuelve null/undefined', () => {
    fc.assert(
      fc.property(fc.array(nombreArb), (nombres) => {
        const categorias: PromoCategoria[] = nombres.map((nombre) => ({
          categoria: nombre === undefined ? undefined : { nombre },
        }));

        const resultado = categoriasValidasDePromo(
          { categorias },
          CATEGORIA_NUMERADA_ACCESSOR
        );

        expect(
          resultado.every((n) => n !== null && n !== undefined)
        ).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Pruebas de propiedad para los cálculos de descuento y total (Task 3.3)
// ---------------------------------------------------------------------------

import {
  calcularDescuentoPorcentajePorBoletos,
  calcularDescuentoCantidadPorBoletos,
  calcularTotalNuevo,
  calcularDescuentoPorcentajePorCategoria,
  calcularDescuentoCantidadPorAsientos,
  type Asiento,
} from './promociones';

/**
 * Feature: promociones-helper-compartido, Property 1: Descuento PORCENTAJE por boletos
 *
 * Para todo precio de boleto no negativo, cantidad de boletos no negativa y
 * porcentaje, calcularDescuentoPorcentajePorBoletos(precioBoleto, cantidadBoletos,
 * porcentaje) es igual a (precioBoleto * cantidadBoletos * porcentaje) / 100.
 *
 * Validates: Requirements 2.1
 */
describe('Property 1: Descuento PORCENTAJE por boletos', () => {
  it('equivale a (precioBoleto * cantidadBoletos * porcentaje) / 100', () => {
    fc.assert(
      fc.property(
        // Precio no negativo, acotado para evitar overflow / imprecisión extrema.
        fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
        // Cantidad de boletos no negativa (entero).
        fc.integer({ min: 0, max: 10_000 }),
        // Porcentaje acotado.
        fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
        (precioBoleto, cantidadBoletos, porcentaje) => {
          const esperado = (precioBoleto * cantidadBoletos * porcentaje) / 100;
          const actual = calcularDescuentoPorcentajePorBoletos(
            precioBoleto,
            cantidadBoletos,
            porcentaje
          );
          expect(actual).toBe(esperado);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: promociones-helper-compartido, Property 4: Descuento CANTIDAD por boletos
 *
 * Para toda combinación de precio, cantidad de boletos, cantidadCompra (positivo)
 * y cantidadPaga, calcularDescuentoCantidadPorBoletos es igual a
 * Math.floor(cantidadBoletos / cantidadCompra) * (cantidadCompra - cantidadPaga) *
 * precioBoleto; en particular, cuando cantidadBoletos < cantidadCompra el descuento
 * es cero.
 *
 * Validates: Requirements 3.1
 */
describe('Property 4: Descuento CANTIDAD por boletos', () => {
  it('equivale a floor(cantidad/compra) * (compra - paga) * precio', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: 0, max: 10_000 }),
        // cantidadCompra positivo (evita división por cero).
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (precioBoleto, cantidadBoletos, cantidadCompra, cantidadPaga) => {
          const gruposCompletos = Math.floor(cantidadBoletos / cantidadCompra);
          const boletosGratis = gruposCompletos * (cantidadCompra - cantidadPaga);
          const esperado = boletosGratis * precioBoleto;
          const actual = calcularDescuentoCantidadPorBoletos(
            precioBoleto,
            cantidadBoletos,
            cantidadCompra,
            cantidadPaga
          );
          expect(actual).toBe(esperado);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('es cero cuando cantidadBoletos < cantidadCompra', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: 2, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (precioBoleto, cantidadCompra, cantidadPaga) => {
          // cantidadBoletos estrictamente menor que cantidadCompra.
          const cantidadBoletos = cantidadCompra - 1;
          const actual = calcularDescuentoCantidadPorBoletos(
            precioBoleto,
            cantidadBoletos,
            cantidadCompra,
            cantidadPaga
          );
          // Normaliza -0 a +0: numéricamente cero (Math.floor da 0 grupos).
          expect(actual + 0).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: promociones-helper-compartido, Property 3: Total nuevo nunca negativo
 *
 * Para todo total y descuento (incluyendo descuento mayor que total),
 * calcularTotalNuevo(total, descuento) es igual a Math.max(0, total - descuento)
 * y por lo tanto siempre es mayor o igual a cero.
 *
 * Validates: Requirements 2.3, 3.3
 */
describe('Property 3: Total nuevo nunca negativo', () => {
  it('equivale a Math.max(0, total - descuento) y nunca es negativo', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1_000_000, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -1_000_000, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
        (total, descuento) => {
          const esperado = Math.max(0, total - descuento);
          const actual = calcularTotalNuevo(total, descuento);
          expect(actual).toBe(esperado);
          expect(actual).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: promociones-helper-compartido, Property 2: Descuento PORCENTAJE por subtotales de categoría
 *
 * Para todo mapa de subtotales por categoría, porcentaje y conjunto de categorías
 * aplicables, calcularDescuentoPorcentajePorCategoria devuelve la suma de
 * subtotal * (porcentaje / 100) únicamente sobre las categorías donde
 * aplicaTodoEvento es verdadero o la categoría está en categoriasAplicables.
 *
 * Validates: Requirements 2.2
 */
describe('Property 2: Descuento PORCENTAJE por subtotales de categoría', () => {
  // Genera un mapa categoría -> subtotal con claves únicas.
  const subtotalesArb: fc.Arbitrary<Record<string, number>> = fc.dictionary(
    fc.string({ minLength: 1 }),
    fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true })
  );

  const porcentajeArb = fc.double({
    min: 0,
    max: 100,
    noNaN: true,
    noDefaultInfinity: true,
  });

  it('suma únicamente sobre categorías aplicables (aplicaTodoEvento falso)', () => {
    fc.assert(
      fc.property(
        subtotalesArb,
        porcentajeArb,
        // Categorías aplicables arbitrarias (pueden o no existir en el mapa).
        fc.array(fc.string({ minLength: 1 })),
        (subtotales, porcentaje, categoriasAplicables) => {
          const esperado = Object.entries(subtotales).reduce((acc, [cat, subtotal]) => {
            if (categoriasAplicables.includes(cat)) {
              return acc + subtotal * (porcentaje / 100);
            }
            return acc;
          }, 0);

          const actual = calcularDescuentoPorcentajePorCategoria(
            subtotales,
            porcentaje,
            false,
            categoriasAplicables
          );
          expect(actual).toBeCloseTo(esperado, 6);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('suma sobre todas las categorías cuando aplicaTodoEvento es verdadero', () => {
    fc.assert(
      fc.property(subtotalesArb, porcentajeArb, (subtotales, porcentaje) => {
        const esperado = Object.values(subtotales).reduce(
          (acc, subtotal) => acc + subtotal * (porcentaje / 100),
          0
        );
        const actual = calcularDescuentoPorcentajePorCategoria(
          subtotales,
          porcentaje,
          true,
          []
        );
        expect(actual).toBeCloseTo(esperado, 6);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: promociones-helper-compartido, Property 5: Descuento CANTIDAD por asientos agrupados
 *
 * Para toda lista de asientos, por cada grupo completo de cantidadCompra asientos
 * de una misma categoría y precio, calcularDescuentoCantidadPorAsientos acumula
 * exactamente la suma del precio de los asientos ubicados después de los primeros
 * cantidadPaga del grupo, considerando sólo categorías aplicables cuando
 * aplicaTodoEvento es falso.
 *
 * Validates: Requirements 3.2
 */
describe('Property 5: Descuento CANTIDAD por asientos agrupados', () => {
  // Genera un asiento con categoría y precio acotados (para forzar agrupaciones).
  const asientoArb: fc.Arbitrary<Asiento> = fc.record({
    id: fc.integer({ min: 0, max: 100_000 }),
    // Pocas categorías/precios distintos para que se formen grupos completos.
    categoria: fc.constantFrom('A', 'B', 'C'),
    precio: fc.integer({ min: 0, max: 1000 }),
  });

  const asientosArb = fc.array(asientoArb, { maxLength: 30 });

  // Reimplementación independiente (oráculo) del cálculo esperado.
  const oraculo = (
    asientos: Asiento[],
    cantidadCompra: number,
    cantidadPaga: number,
    aplicaTodoEvento: boolean,
    categoriasAplicables: string[]
  ): number => {
    const agrupados: Record<string, Record<string, Asiento[]>> = {};
    for (const a of asientos) {
      const cat = a.categoria;
      const precio = String(a.precio);
      if (!agrupados[cat]) agrupados[cat] = {};
      if (!agrupados[cat][precio]) agrupados[cat][precio] = [];
      agrupados[cat][precio].push(a);
    }
    let descuento = 0;
    for (const [categoria, preciosObj] of Object.entries(agrupados)) {
      if (!aplicaTodoEvento && !categoriasAplicables.includes(categoria)) continue;
      for (const asientosGrupo of Object.values(preciosObj)) {
        const grupos = Math.floor(asientosGrupo.length / cantidadCompra);
        for (let i = 0; i < grupos; i++) {
          const grupo = asientosGrupo.slice(i * cantidadCompra, (i + 1) * cantidadCompra);
          const gratis = grupo.slice(cantidadPaga);
          descuento += gratis.reduce((acc, x) => acc + Number(x.precio), 0);
        }
      }
    }
    return descuento;
  };

  it('acumula el precio de los asientos gratis por grupo completo (aplicaTodoEvento)', () => {
    fc.assert(
      fc.property(
        asientosArb,
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 0, max: 5 }),
        (asientos, cantidadCompra, cantidadPaga) => {
          const esperado = oraculo(asientos, cantidadCompra, cantidadPaga, true, []);
          const { descuentoTotal } = calcularDescuentoCantidadPorAsientos(
            asientos,
            cantidadCompra,
            cantidadPaga,
            true,
            []
          );
          expect(descuentoTotal).toBe(esperado);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('considera sólo categorías aplicables cuando aplicaTodoEvento es falso', () => {
    fc.assert(
      fc.property(
        asientosArb,
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 0, max: 5 }),
        fc.subarray(['A', 'B', 'C']),
        (asientos, cantidadCompra, cantidadPaga, categoriasAplicables) => {
          const esperado = oraculo(
            asientos,
            cantidadCompra,
            cantidadPaga,
            false,
            categoriasAplicables
          );
          const { descuentoTotal } = calcularDescuentoCantidadPorAsientos(
            asientos,
            cantidadCompra,
            cantidadPaga,
            false,
            categoriasAplicables
          );
          expect(descuentoTotal).toBe(esperado);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Pruebas de propiedad para el filtrado de promociones aplicables (Task 4.2)
// ---------------------------------------------------------------------------

import {
  filtrarPromocionesAplicablesPorCategoria,
  filtrarPromocionesAplicablesPorCategorias,
  type Promocion,
} from './promociones';

// Construye una Promocion mínima válida, permitiendo sobrescribir campos.
const construirPromo = (overrides: Partial<Promocion>): Promocion => ({
  id: 1,
  nombre: 'promo',
  tipo: 'PORCENTAJE',
  porcentaje: 10,
  cantidadCompra: 1,
  cantidadPaga: 1,
  aplicaTodoEvento: false,
  categorias: [],
  descuentoCalculado: 0,
  ...overrides,
});

/**
 * Feature: promociones-helper-compartido, Property 6: Aplicabilidad por evento completo
 *
 * Para toda promoción con aplicaTodoEvento verdadero y cualquier selección de
 * categoría(s), ambas variantes de filtrarPromocionesAplicables incluyen dicha
 * promoción en el resultado.
 *
 * Validates: Requirements 4.1
 */
describe('Property 6: Aplicabilidad por evento completo', () => {
  // Nombre de categoría no nulo para poblar las categorías de la promo.
  const nombreArb = fc.string();

  it('la variante por categoría (string) incluye siempre las promos aplicaTodoEvento', () => {
    fc.assert(
      fc.property(
        fc.array(nombreArb),
        fc.string(),
        (nombresCategorias, categoriaSeleccionada) => {
          const promo = construirPromo({
            aplicaTodoEvento: true,
            categorias: nombresCategorias.map((nombre) => ({
              categoriaGeneral: { nombre },
            })),
          });

          const resultado = filtrarPromocionesAplicablesPorCategoria(
            [promo],
            categoriaSeleccionada
          );

          expect(resultado).toContain(promo);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('la variante por categorías (array) incluye siempre las promos aplicaTodoEvento', () => {
    fc.assert(
      fc.property(
        fc.array(nombreArb),
        fc.array(fc.string()),
        (nombresCategorias, categoriasSeleccionadas) => {
          const promo = construirPromo({
            aplicaTodoEvento: true,
            categorias: nombresCategorias.map((nombre) => ({
              categoria: { nombre },
            })),
          });

          const resultado = filtrarPromocionesAplicablesPorCategorias(
            [promo],
            categoriasSeleccionadas
          );

          expect(resultado).toContain(promo);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: promociones-helper-compartido, Property 7: Aplicabilidad por categoría según variante de accessor
 *
 * Para toda promoción con aplicaTodoEvento falso: la variante Generales/Conferencias
 * (accessor categoriaGeneral.nombre, categoría string) la incluye si y sólo si sus
 * categorías válidas contienen la categoría; la variante Numerados (accessor
 * categoria.nombre, array de categorías) la incluye si y sólo si alguna de sus
 * categorías válidas está en el array seleccionado.
 *
 * Validates: Requirements 4.2, 4.3, 5.1, 5.2
 */
describe('Property 7: Aplicabilidad por categoría según variante de accessor', () => {
  // Nombre potencialmente null/undefined para probar el descarte junto al filtrado.
  const nombreArb: fc.Arbitrary<string | null | undefined> = fc.oneof(
    fc.string(),
    fc.constant(null),
    fc.constant(undefined)
  );

  it('variante Generales/Conferencias: incluye sii las categorías válidas contienen la categoría', () => {
    fc.assert(
      fc.property(
        fc.array(nombreArb),
        fc.string(),
        (nombres, categoriaSeleccionada) => {
          const promo = construirPromo({
            aplicaTodoEvento: false,
            categorias: nombres.map((nombre) =>
              nombre === undefined
                ? {}
                : { categoriaGeneral: { nombre } }
            ),
          });

          // Categorías válidas derivadas con el accessor general (descarta null/undefined).
          const categoriasValidas = nombres.filter(
            (n): n is string => n !== null && n !== undefined
          );
          const esperadoIncluido = categoriasValidas.includes(categoriaSeleccionada);

          const resultado = filtrarPromocionesAplicablesPorCategoria(
            [promo],
            categoriaSeleccionada
          );

          expect(resultado.includes(promo)).toBe(esperadoIncluido);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('variante Numerados: incluye sii alguna categoría válida está en el array seleccionado', () => {
    fc.assert(
      fc.property(
        fc.array(nombreArb),
        fc.array(fc.string()),
        (nombres, categoriasSeleccionadas) => {
          const promo = construirPromo({
            aplicaTodoEvento: false,
            categorias: nombres.map((nombre) =>
              nombre === undefined ? {} : { categoria: { nombre } }
            ),
          });

          // Categorías válidas derivadas con el accessor numerado (descarta null/undefined).
          const categoriasValidas = nombres.filter(
            (n): n is string => n !== null && n !== undefined
          );
          const esperadoIncluido = categoriasValidas.some((cat) =>
            categoriasSeleccionadas.includes(cat)
          );

          const resultado = filtrarPromocionesAplicablesPorCategorias(
            [promo],
            categoriasSeleccionadas
          );

          expect(resultado.includes(promo)).toBe(esperadoIncluido);
        }
      ),
      { numRuns: 100 }
    );
  });
});
// ---------------------------------------------------------------------------
// Pruebas de propiedad para la selección de la mejor promoción (Task 5.3)
// ---------------------------------------------------------------------------

import {
  obtenerMejorPromocionPorBoletos,
  obtenerMejorPromocionPorAsientos,
} from './promociones';

/**
 * Feature: promociones-helper-compartido, Property 9: Selección del máximo descuento con desempate estricto
 *
 * Para toda lista no vacía de promociones aplicables, obtenerMejorPromocion
 * (ambas variantes) devuelve una promoción cuyo descuentoCalculado es el máximo
 * entre todas; ante empates, prevalece la primera que alcanzó ese máximo
 * (comparación estricta >).
 *
 * Validates: Requirements 6.2
 */
describe('Property 9: Selección del máximo descuento con desempate estricto', () => {
  // Genera una promoción con datos acotados que producen descuentos deterministas.
  const promoArb: fc.Arbitrary<Promocion> = fc.oneof(
    // PORCENTAJE aplicaTodoEvento (siempre calcula sobre boletos/categorías).
    fc.record({
      id: fc.integer({ min: 1, max: 100_000 }),
      nombre: fc.constant('promo'),
      tipo: fc.constant<'PORCENTAJE'>('PORCENTAJE'),
      porcentaje: fc.integer({ min: 0, max: 100 }),
      cantidadCompra: fc.integer({ min: 1, max: 5 }),
      cantidadPaga: fc.integer({ min: 0, max: 5 }),
      aplicaTodoEvento: fc.constant(true),
      categorias: fc.constant<PromoCategoria[]>([]),
      descuentoCalculado: fc.constant(0),
    }),
    // CANTIDAD aplicaTodoEvento.
    fc.record({
      id: fc.integer({ min: 1, max: 100_000 }),
      nombre: fc.constant('promo'),
      tipo: fc.constant<'CANTIDAD'>('CANTIDAD'),
      porcentaje: fc.integer({ min: 0, max: 100 }),
      cantidadCompra: fc.integer({ min: 1, max: 5 }),
      cantidadPaga: fc.integer({ min: 0, max: 5 }),
      aplicaTodoEvento: fc.constant(true),
      categorias: fc.constant<PromoCategoria[]>([]),
      descuentoCalculado: fc.constant(0),
    })
  );

  it('variante por boletos: el resultado (si no es null) tiene el máximo descuento y respeta el desempate estricto', () => {
    fc.assert(
      fc.property(
        fc.array(promoArb, { minLength: 1, maxLength: 8 }),
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 5000 }),
        (promos, cantidadBoletos, precioBoleto) => {
          // Descuentos calculados por variante boletos (misma lógica del helper).
          const descuentos = promos.map((promo) => {
            if (promo.tipo === 'PORCENTAJE') {
              return (precioBoleto * cantidadBoletos * Number(promo.porcentaje)) / 100;
            }
            const gruposCompletos = Math.floor(cantidadBoletos / promo.cantidadCompra);
            const boletosGratis = gruposCompletos * (promo.cantidadCompra - promo.cantidadPaga);
            return boletosGratis * precioBoleto;
          });
          const maxDescuento = Math.max(...descuentos);

          const resultado = obtenerMejorPromocionPorBoletos(
            promos,
            cantidadBoletos,
            precioBoleto
          );

          if (maxDescuento > 0) {
            expect(resultado).not.toBeNull();
            expect(resultado!.descuentoCalculado).toBe(maxDescuento);
            // Desempate estricto: el índice del ganador es el primero que alcanza el máximo.
            const indiceEsperado = descuentos.findIndex((d) => d === maxDescuento);
            expect(resultado!.id).toBe(promos[indiceEsperado].id);
          } else {
            // Ningún descuento > 0 => null (comparación estricta contra 0).
            expect(resultado).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('variante por asientos: el resultado (si no es null) tiene el máximo descuento y respeta el desempate estricto', () => {
    // Asientos deterministas para calcular subtotales y agrupaciones.
    const asientoArb: fc.Arbitrary<Asiento> = fc.record({
      id: fc.integer({ min: 0, max: 100_000 }),
      categoria: fc.constantFrom('A', 'B', 'C'),
      precio: fc.integer({ min: 0, max: 500 }),
    });

    fc.assert(
      fc.property(
        fc.array(promoArb, { minLength: 1, maxLength: 8 }),
        fc.array(asientoArb, { minLength: 1, maxLength: 20 }),
        (promos, asientos) => {
          // Subtotales por categoría derivados de los asientos.
          const subtotales: Record<string, number> = {};
          for (const a of asientos) {
            subtotales[a.categoria] = (subtotales[a.categoria] ?? 0) + Number(a.precio);
          }

          // Todas las promos generadas son aplicaTodoEvento, por lo que
          // se calculan directamente. Reimplementación de la lógica del helper.
          const descuentos = promos.map((promo) => {
            if (promo.tipo === 'PORCENTAJE') {
              return Object.values(subtotales).reduce(
                (acc, subtotal) => acc + subtotal * (Number(promo.porcentaje) / 100),
                0
              );
            }
            // CANTIDAD: agrupar por categoría y precio.
            const agrupados: Record<string, Record<string, Asiento[]>> = {};
            for (const a of asientos) {
              const cat = a.categoria;
              const precio = String(a.precio);
              if (!agrupados[cat]) agrupados[cat] = {};
              if (!agrupados[cat][precio]) agrupados[cat][precio] = [];
              agrupados[cat][precio].push(a);
            }
            let desc = 0;
            let cumple = false;
            for (const preciosObj of Object.values(agrupados)) {
              for (const grupoAsientos of Object.values(preciosObj)) {
                const grupos = Math.floor(grupoAsientos.length / promo.cantidadCompra);
                if (grupoAsientos.length >= promo.cantidadCompra) cumple = true;
                for (let i = 0; i < grupos; i++) {
                  const grupo = grupoAsientos.slice(
                    i * promo.cantidadCompra,
                    (i + 1) * promo.cantidadCompra
                  );
                  const gratis = grupo.slice(promo.cantidadPaga);
                  desc += gratis.reduce((acc, x) => acc + Number(x.precio), 0);
                }
              }
            }
            return cumple ? desc : 0;
          });

          const maxDescuento = Math.max(...descuentos);

          const resultado = obtenerMejorPromocionPorAsientos(
            promos,
            asientos,
            subtotales
          );

          if (maxDescuento > 0) {
            expect(resultado).not.toBeNull();
            expect(resultado!.descuentoCalculado).toBeCloseTo(maxDescuento, 6);
          } else {
            expect(resultado).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: promociones-helper-compartido, Property 10: Forma de salida de la variante por boletos
 *
 * Para toda mejor promoción seleccionada por obtenerMejorPromocionPorBoletos,
 * el resultado contiene descuentoCalculado igual al descuento calculado y
 * precioFinal igual a (precioBoleto * cantidadBoletos) - descuentoCalculado.
 *
 * Validates: Requirements 6.3
 */
describe('Property 10: Forma de salida de la variante por boletos', () => {
  const promoArb: fc.Arbitrary<Promocion> = fc.oneof(
    fc.record({
      id: fc.integer({ min: 1, max: 100_000 }),
      nombre: fc.constant('promo'),
      tipo: fc.constant<'PORCENTAJE'>('PORCENTAJE'),
      porcentaje: fc.integer({ min: 1, max: 100 }),
      cantidadCompra: fc.integer({ min: 1, max: 5 }),
      cantidadPaga: fc.integer({ min: 0, max: 5 }),
      aplicaTodoEvento: fc.constant(true),
      categorias: fc.constant<PromoCategoria[]>([]),
      descuentoCalculado: fc.constant(0),
    }),
    fc.record({
      id: fc.integer({ min: 1, max: 100_000 }),
      nombre: fc.constant('promo'),
      tipo: fc.constant<'CANTIDAD'>('CANTIDAD'),
      porcentaje: fc.integer({ min: 1, max: 100 }),
      cantidadCompra: fc.integer({ min: 1, max: 5 }),
      cantidadPaga: fc.integer({ min: 0, max: 4 }),
      aplicaTodoEvento: fc.constant(true),
      categorias: fc.constant<PromoCategoria[]>([]),
      descuentoCalculado: fc.constant(0),
    })
  );

  it('precioFinal = (precioBoleto * cantidadBoletos) - descuentoCalculado cuando hay ganadora', () => {
    fc.assert(
      fc.property(
        fc.array(promoArb, { minLength: 1, maxLength: 8 }),
        // Cantidades/precios que tienden a producir descuentos > 0.
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 5000 }),
        (promos, cantidadBoletos, precioBoleto) => {
          const resultado = obtenerMejorPromocionPorBoletos(
            promos,
            cantidadBoletos,
            precioBoleto
          );

          if (resultado !== null) {
            expect(resultado.precioFinal).toBe(
              precioBoleto * cantidadBoletos - resultado.descuentoCalculado
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: promociones-helper-compartido, Property 11: Ausencia de promoción válida devuelve null
 *
 * Para toda invocación de obtenerMejorPromocion (ambas variantes) donde la lista
 * sea vacía o undefined, o donde ninguna promoción produzca un descuento
 * estrictamente mayor que cero, el resultado es null.
 *
 * Validates: Requirements 6.1, 6.4
 */
describe('Property 11: Ausencia de promoción válida devuelve null', () => {
  it('variante por boletos: lista vacía o undefined => null', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 5000 }),
        (cantidadBoletos, precioBoleto) => {
          expect(
            obtenerMejorPromocionPorBoletos([], cantidadBoletos, precioBoleto)
          ).toBeNull();
          expect(
            obtenerMejorPromocionPorBoletos(
              undefined as unknown as Promocion[],
              cantidadBoletos,
              precioBoleto
            )
          ).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('variante por boletos: ningún descuento > 0 => null', () => {
    // Fuerza descuento cero usando porcentaje 0 y CANTIDAD con cantidadCompra > cantidadBoletos.
    const promoSinDescuentoArb: fc.Arbitrary<Promocion> = fc.oneof(
      fc.record({
        id: fc.integer({ min: 1, max: 100_000 }),
        nombre: fc.constant('promo'),
        tipo: fc.constant<'PORCENTAJE'>('PORCENTAJE'),
        porcentaje: fc.constant(0),
        cantidadCompra: fc.integer({ min: 1, max: 5 }),
        cantidadPaga: fc.integer({ min: 0, max: 5 }),
        aplicaTodoEvento: fc.constant(true),
        categorias: fc.constant<PromoCategoria[]>([]),
        descuentoCalculado: fc.constant(0),
      }),
      fc.record({
        id: fc.integer({ min: 1, max: 100_000 }),
        nombre: fc.constant('promo'),
        tipo: fc.constant<'CANTIDAD'>('CANTIDAD'),
        porcentaje: fc.constant(0),
        // cantidadCompra alto para que floor(cantidadBoletos/compra) sea 0.
        cantidadCompra: fc.integer({ min: 100, max: 200 }),
        cantidadPaga: fc.integer({ min: 0, max: 5 }),
        aplicaTodoEvento: fc.constant(true),
        categorias: fc.constant<PromoCategoria[]>([]),
        descuentoCalculado: fc.constant(0),
      })
    );

    fc.assert(
      fc.property(
        fc.array(promoSinDescuentoArb, { minLength: 1, maxLength: 8 }),
        // cantidadBoletos menor que la cantidadCompra mínima usada arriba (100).
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 0, max: 5000 }),
        (promos, cantidadBoletos, precioBoleto) => {
          expect(
            obtenerMejorPromocionPorBoletos(promos, cantidadBoletos, precioBoleto)
          ).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('variante por asientos: lista vacía o undefined => null', () => {
    const asientoArb: fc.Arbitrary<Asiento> = fc.record({
      id: fc.integer({ min: 0, max: 100_000 }),
      categoria: fc.constantFrom('A', 'B', 'C'),
      precio: fc.integer({ min: 0, max: 500 }),
    });

    fc.assert(
      fc.property(
        fc.array(asientoArb, { maxLength: 10 }),
        (asientos) => {
          const subtotales: Record<string, number> = {};
          for (const a of asientos) {
            subtotales[a.categoria] = (subtotales[a.categoria] ?? 0) + Number(a.precio);
          }
          expect(
            obtenerMejorPromocionPorAsientos([], asientos, subtotales)
          ).toBeNull();
          expect(
            obtenerMejorPromocionPorAsientos(
              undefined as unknown as Promocion[],
              asientos,
              subtotales
            )
          ).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('variante por asientos: ningún descuento > 0 => null (porcentaje 0)', () => {
    const asientoArb: fc.Arbitrary<Asiento> = fc.record({
      id: fc.integer({ min: 0, max: 100_000 }),
      categoria: fc.constantFrom('A', 'B', 'C'),
      precio: fc.integer({ min: 0, max: 500 }),
    });

    const promoSinDescuentoArb: fc.Arbitrary<Promocion> = fc.record({
      id: fc.integer({ min: 1, max: 100_000 }),
      nombre: fc.constant('promo'),
      tipo: fc.constant<'PORCENTAJE'>('PORCENTAJE'),
      porcentaje: fc.constant(0),
      cantidadCompra: fc.integer({ min: 1, max: 5 }),
      cantidadPaga: fc.integer({ min: 0, max: 5 }),
      aplicaTodoEvento: fc.constant(true),
      categorias: fc.constant<PromoCategoria[]>([]),
      descuentoCalculado: fc.constant(0),
    });

    fc.assert(
      fc.property(
        fc.array(promoSinDescuentoArb, { minLength: 1, maxLength: 8 }),
        fc.array(asientoArb, { minLength: 1, maxLength: 15 }),
        (promos, asientos) => {
          const subtotales: Record<string, number> = {};
          for (const a of asientos) {
            subtotales[a.categoria] = (subtotales[a.categoria] ?? 0) + Number(a.precio);
          }
          expect(
            obtenerMejorPromocionPorAsientos(promos, asientos, subtotales)
          ).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Pruebas unitarias por ejemplo / edge (Task 6.1)
// _Requirements: 9.1_
// ---------------------------------------------------------------------------

import {
  asientosPorCategoriaPrecio,
} from './promociones';

describe('Ejemplos: cálculos de descuento', () => {
  it('PORCENTAJE por boletos: 100 * 3 boletos al 10% = 30', () => {
    expect(calcularDescuentoPorcentajePorBoletos(100, 3, 10)).toBe(30);
  });

  it('PORCENTAJE por boletos: porcentaje 0 => 0', () => {
    expect(calcularDescuentoPorcentajePorBoletos(250, 4, 0)).toBe(0);
  });

  it('CANTIDAD por boletos: 3x2 con 6 boletos a 50 => 2 gratis * 50 = 100', () => {
    // cantidadCompra=3, cantidadPaga=2 => 1 gratis por grupo; 6/3 = 2 grupos => 2 gratis.
    expect(calcularDescuentoCantidadPorBoletos(50, 6, 3, 2)).toBe(100);
  });

  it('CANTIDAD por boletos: cantidad < cantidadCompra => 0', () => {
    expect(calcularDescuentoCantidadPorBoletos(50, 2, 3, 2)).toBe(0);
  });

  it('total nuevo: clamp a 0 cuando el descuento supera el total', () => {
    expect(calcularTotalNuevo(100, 150)).toBe(0);
    expect(calcularTotalNuevo(200, 50)).toBe(150);
  });

  it('PORCENTAJE por categoría: suma sólo categorías aplicables (aplicaTodoEvento falso)', () => {
    const subtotales = { A: 1000, B: 500, C: 200 };
    // 10% sólo de A y C => 100 + 20 = 120.
    expect(
      calcularDescuentoPorcentajePorCategoria(subtotales, 10, false, ['A', 'C'])
    ).toBeCloseTo(120, 6);
  });

  it('PORCENTAJE por categoría: aplicaTodoEvento suma todas las categorías', () => {
    const subtotales = { A: 1000, B: 500 };
    // 20% de (1000 + 500) = 300.
    expect(
      calcularDescuentoPorcentajePorCategoria(subtotales, 20, true, [])
    ).toBeCloseTo(300, 6);
  });

  it('CANTIDAD por asientos: 2x1 en misma categoría/precio => 1 gratis por grupo', () => {
    const asientos: Asiento[] = [
      { id: 1, categoria: 'A', precio: 100 },
      { id: 2, categoria: 'A', precio: 100 },
      { id: 3, categoria: 'A', precio: 100 },
      { id: 4, categoria: 'A', precio: 100 },
    ];
    // cantidadCompra=2, cantidadPaga=1 => 1 gratis por grupo de 2; 4/2 = 2 grupos => 2 gratis * 100 = 200.
    const { descuentoTotal, algunaCategoriaCumple } = calcularDescuentoCantidadPorAsientos(
      asientos,
      2,
      1,
      true,
      []
    );
    expect(descuentoTotal).toBe(200);
    expect(algunaCategoriaCumple).toBe(true);
  });

  it('CANTIDAD por asientos: categoría no aplicable no aporta descuento', () => {
    const asientos: Asiento[] = [
      { id: 1, categoria: 'A', precio: 100 },
      { id: 2, categoria: 'A', precio: 100 },
    ];
    const { descuentoTotal, algunaCategoriaCumple } = calcularDescuentoCantidadPorAsientos(
      asientos,
      2,
      1,
      false,
      ['B'] // sólo B aplica, pero los asientos son A.
    );
    expect(descuentoTotal).toBe(0);
    expect(algunaCategoriaCumple).toBe(false);
  });

  it('asientosPorCategoriaPrecio: agrupa por categoría y luego por precio', () => {
    const asientos: Asiento[] = [
      { id: 1, categoria: 'A', precio: 100 },
      { id: 2, categoria: 'A', precio: 100 },
      { id: 3, categoria: 'A', precio: 200 },
      { id: 4, categoria: 'B', precio: 100 },
    ];
    const agrupados = asientosPorCategoriaPrecio(asientos);
    expect(agrupados['A']['100']).toHaveLength(2);
    expect(agrupados['A']['200']).toHaveLength(1);
    expect(agrupados['B']['100']).toHaveLength(1);
  });
});

describe('Ejemplos: validación y derivación de categorías', () => {
  it('CATEGORIA_GENERAL_ACCESSOR: descarta null/undefined y conserva nombres válidos', () => {
    const categorias: PromoCategoria[] = [
      { categoriaGeneral: { nombre: 'VIP' } },
      { categoriaGeneral: { nombre: null } },
      {}, // undefined
      { categoriaGeneral: { nombre: 'GENERAL' } },
    ];
    expect(categoriasValidasDePromo({ categorias }, CATEGORIA_GENERAL_ACCESSOR)).toEqual([
      'VIP',
      'GENERAL',
    ]);
  });

  it('CATEGORIA_NUMERADA_ACCESSOR: descarta null/undefined y conserva nombres válidos', () => {
    const categorias: PromoCategoria[] = [
      { categoria: { nombre: 'A' } },
      { categoria: { nombre: null } },
      { categoria: null },
      {}, // undefined
      { categoria: { nombre: 'B' } },
    ];
    expect(categoriasValidasDePromo({ categorias }, CATEGORIA_NUMERADA_ACCESSOR)).toEqual([
      'A',
      'B',
    ]);
  });

  it('lista de categorías vacía => arreglo vacío', () => {
    expect(categoriasValidasDePromo({ categorias: [] }, CATEGORIA_GENERAL_ACCESSOR)).toEqual(
      []
    );
  });
});

describe('Ejemplos: filtrado y selección', () => {
  const promoBase = (overrides: Partial<Promocion>): Promocion => ({
    id: 1,
    nombre: 'promo',
    tipo: 'PORCENTAJE',
    porcentaje: 10,
    cantidadCompra: 1,
    cantidadPaga: 1,
    aplicaTodoEvento: false,
    categorias: [],
    descuentoCalculado: 0,
    ...overrides,
  });

  it('filtrarPromocionesAplicablesPorCategoria: incluye por aplicaTodoEvento y por categoría', () => {
    const promoTodoEvento = promoBase({ id: 1, aplicaTodoEvento: true });
    const promoVip = promoBase({
      id: 2,
      categorias: [{ categoriaGeneral: { nombre: 'VIP' } }],
    });
    const promoGeneral = promoBase({
      id: 3,
      categorias: [{ categoriaGeneral: { nombre: 'GENERAL' } }],
    });

    const resultado = filtrarPromocionesAplicablesPorCategoria(
      [promoTodoEvento, promoVip, promoGeneral],
      'VIP'
    );
    expect(resultado.map((p) => p.id)).toEqual([1, 2]);
  });

  it('filtrarPromocionesAplicablesPorCategorias: incluye si alguna categoría coincide', () => {
    const promoTodoEvento = promoBase({ id: 1, aplicaTodoEvento: true });
    const promoAB = promoBase({
      id: 2,
      categorias: [{ categoria: { nombre: 'A' } }, { categoria: { nombre: 'B' } }],
    });
    const promoC = promoBase({
      id: 3,
      categorias: [{ categoria: { nombre: 'C' } }],
    });

    const resultado = filtrarPromocionesAplicablesPorCategorias(
      [promoTodoEvento, promoAB, promoC],
      ['B']
    );
    expect(resultado.map((p) => p.id)).toEqual([1, 2]);
  });

  it('obtenerMejorPromocionPorBoletos: elige el mayor descuento y calcula precioFinal', () => {
    const promoPct = promoBase({ id: 1, tipo: 'PORCENTAJE', porcentaje: 10, aplicaTodoEvento: true });
    const promoCant = promoBase({
      id: 2,
      tipo: 'CANTIDAD',
      cantidadCompra: 2,
      cantidadPaga: 1,
      aplicaTodoEvento: true,
    });
    // 4 boletos a 100. PORCENTAJE 10% => 40. CANTIDAD 2x1 => 2 gratis * 100 = 200.
    const resultado = obtenerMejorPromocionPorBoletos([promoPct, promoCant], 4, 100);
    expect(resultado).not.toBeNull();
    expect(resultado!.id).toBe(2);
    expect(resultado!.descuentoCalculado).toBe(200);
    expect(resultado!.precioFinal).toBe(400 - 200);
  });

  it('obtenerMejorPromocionPorBoletos: lista vacía => null', () => {
    expect(obtenerMejorPromocionPorBoletos([], 4, 100)).toBeNull();
  });

  it('obtenerMejorPromocionPorBoletos: undefined => null', () => {
    expect(
      obtenerMejorPromocionPorBoletos(undefined as unknown as Promocion[], 4, 100)
    ).toBeNull();
  });

  it('obtenerMejorPromocionPorBoletos: ningún descuento > 0 => null', () => {
    const promoPct0 = promoBase({ id: 1, tipo: 'PORCENTAJE', porcentaje: 0, aplicaTodoEvento: true });
    expect(obtenerMejorPromocionPorBoletos([promoPct0], 4, 100)).toBeNull();
  });

  it('obtenerMejorPromocionPorBoletos: CANTIDAD con cantidad < cantidadCompra => null', () => {
    const promoCant = promoBase({
      id: 1,
      tipo: 'CANTIDAD',
      cantidadCompra: 5,
      cantidadPaga: 4,
      aplicaTodoEvento: true,
    });
    // 3 boletos < cantidadCompra 5 => descuento 0 => null.
    expect(obtenerMejorPromocionPorBoletos([promoCant], 3, 100)).toBeNull();
  });

  it('obtenerMejorPromocionPorAsientos: elige mejor descuento sin precioFinal', () => {
    const asientos: Asiento[] = [
      { id: 1, categoria: 'A', precio: 100 },
      { id: 2, categoria: 'A', precio: 100 },
      { id: 3, categoria: 'A', precio: 100 },
      { id: 4, categoria: 'A', precio: 100 },
    ];
    const subtotales = { A: 400 };
    const promoPct = promoBase({ id: 1, tipo: 'PORCENTAJE', porcentaje: 10, aplicaTodoEvento: true });
    const promoCant = promoBase({
      id: 2,
      tipo: 'CANTIDAD',
      cantidadCompra: 2,
      cantidadPaga: 1,
      aplicaTodoEvento: true,
    });
    // PORCENTAJE 10% de 400 = 40. CANTIDAD 2x1 => 2 gratis * 100 = 200.
    const resultado = obtenerMejorPromocionPorAsientos([promoPct, promoCant], asientos, subtotales);
    expect(resultado).not.toBeNull();
    expect(resultado!.id).toBe(2);
    expect(resultado!.descuentoCalculado).toBe(200);
    expect('precioFinal' in resultado!).toBe(false);
  });

  it('obtenerMejorPromocionPorAsientos: lista vacía => null', () => {
    expect(obtenerMejorPromocionPorAsientos([], [], {})).toBeNull();
  });

  it('obtenerMejorPromocionPorAsientos: undefined => null', () => {
    expect(
      obtenerMejorPromocionPorAsientos(undefined as unknown as Promocion[], [], {})
    ).toBeNull();
  });

  it('obtenerMejorPromocionPorAsientos: promo sin categoría aplicable se descarta => null', () => {
    const asientos: Asiento[] = [
      { id: 1, categoria: 'A', precio: 100 },
      { id: 2, categoria: 'A', precio: 100 },
    ];
    const subtotales = { A: 200 };
    // Promo restringida a categoría B (no seleccionada) => se salta => null.
    const promoB = promoBase({
      id: 1,
      tipo: 'PORCENTAJE',
      porcentaje: 10,
      aplicaTodoEvento: false,
      categorias: [{ categoria: { nombre: 'B' } }],
    });
    expect(obtenerMejorPromocionPorAsientos([promoB], asientos, subtotales)).toBeNull();
  });

  it('obtenerMejorPromocionPorAsientos: CANTIDAD sin grupo completo (cantidad < cantidadCompra) => null', () => {
    const asientos: Asiento[] = [{ id: 1, categoria: 'A', precio: 100 }];
    const subtotales = { A: 100 };
    const promoCant = promoBase({
      id: 1,
      tipo: 'CANTIDAD',
      cantidadCompra: 3,
      cantidadPaga: 2,
      aplicaTodoEvento: true,
    });
    // 1 asiento < cantidadCompra 3 => algunaCategoriaCumple falso => null.
    expect(obtenerMejorPromocionPorAsientos([promoCant], asientos, subtotales)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Pruebas para el tipo de promoción RESTA y la normalización de auto-aplicación
// ---------------------------------------------------------------------------

import {
  calcularDescuentoRestaPorAsientos,
  calcularDescuentoRestaPorBoletos,
  normalizarPromocionesAplicaDirecto,
} from './promociones';

/**
 * Feature: promociones-helper-compartido (RESTA), calcularDescuentoRestaPorAsientos:
 * el descuento por asiento nunca supera el precio del asiento (piso por asiento),
 * y el total equivale a la suma de min(cantidadResta, precioAsiento) sobre los
 * asientos que califican según aplicaTodoEvento/categoriasAplicables, redondeado
 * a 2 decimales.
 */
describe('calcularDescuentoRestaPorAsientos', () => {
  const asientoArb: fc.Arbitrary<Asiento> = fc.record({
    id: fc.integer({ min: 0, max: 100_000 }),
    categoria: fc.constantFrom('A', 'B', 'C'),
    precio: fc.integer({ min: 0, max: 1000 }),
  });

  const asientosArb = fc.array(asientoArb, { maxLength: 30 });

  // Oráculo independiente del cálculo esperado.
  const oraculo = (
    asientos: Asiento[],
    cantidadResta: number,
    aplicaTodoEvento: boolean,
    categoriasAplicables: string[]
  ): { descuentoTotal: number; algunaCategoriaCumple: boolean } => {
    let descuento = 0;
    let cumple = false;
    for (const a of asientos) {
      if (aplicaTodoEvento || categoriasAplicables.includes(a.categoria)) {
        cumple = true;
        descuento += Math.min(Number(cantidadResta), Number(a.precio));
      }
    }
    return { descuentoTotal: Math.round(descuento * 100) / 100, algunaCategoriaCumple: cumple };
  };

  it('equivale a la suma de min(cantidadResta, precio) sobre asientos que califican (aplicaTodoEvento)', () => {
    fc.assert(
      fc.property(
        asientosArb,
        fc.integer({ min: 0, max: 2000 }),
        (asientos, cantidadResta) => {
          const esperado = oraculo(asientos, cantidadResta, true, []);
          const actual = calcularDescuentoRestaPorAsientos(asientos, cantidadResta, true, []);
          expect(actual.descuentoTotal).toBe(esperado.descuentoTotal);
          expect(actual.algunaCategoriaCumple).toBe(esperado.algunaCategoriaCumple);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('filtra por categoría cuando aplicaTodoEvento es falso', () => {
    fc.assert(
      fc.property(
        asientosArb,
        fc.integer({ min: 0, max: 2000 }),
        fc.subarray(['A', 'B', 'C']),
        (asientos, cantidadResta, categoriasAplicables) => {
          const esperado = oraculo(asientos, cantidadResta, false, categoriasAplicables);
          const actual = calcularDescuentoRestaPorAsientos(
            asientos,
            cantidadResta,
            false,
            categoriasAplicables
          );
          expect(actual.descuentoTotal).toBe(esperado.descuentoTotal);
          expect(actual.algunaCategoriaCumple).toBe(esperado.algunaCategoriaCumple);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('el descuento por asiento nunca supera el precio del asiento (piso por asiento)', () => {
    fc.assert(
      fc.property(
        asientosArb,
        fc.integer({ min: 0, max: 5000 }),
        (asientos, cantidadResta) => {
          const { descuentoTotal } = calcularDescuentoRestaPorAsientos(
            asientos,
            cantidadResta,
            true,
            []
          );
          const sumaPrecios = asientos.reduce((acc, a) => acc + Number(a.precio), 0);
          // El descuento nunca supera la suma total de precios que califican.
          expect(descuentoTotal).toBeLessThanOrEqual(sumaPrecios + 1e-9);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Ejemplo de la documentación.
  it('ejemplo doc: cantidadResta=50, VIP x2 a 350 => descuento 100', () => {
    const asientos: Asiento[] = [
      { id: 1, categoria: 'VIP', precio: 350 },
      { id: 2, categoria: 'VIP', precio: 350 },
      { id: 3, categoria: 'General', precio: 200 },
    ];
    const { descuentoTotal, algunaCategoriaCumple } = calcularDescuentoRestaPorAsientos(
      asientos,
      50,
      false,
      ['VIP']
    );
    expect(descuentoTotal).toBe(100);
    expect(algunaCategoriaCumple).toBe(true);
  });

  it('caso borde piso por asiento: cantidadResta=400, precio=350 => descuento 350', () => {
    const asientos: Asiento[] = [{ id: 1, categoria: 'VIP', precio: 350 }];
    const { descuentoTotal } = calcularDescuentoRestaPorAsientos(asientos, 400, true, []);
    expect(descuentoTotal).toBe(350);
  });

  it('ninguna categoría cumple => algunaCategoriaCumple falso y descuento 0', () => {
    const asientos: Asiento[] = [
      { id: 1, categoria: 'A', precio: 100 },
      { id: 2, categoria: 'A', precio: 100 },
    ];
    const { descuentoTotal, algunaCategoriaCumple } = calcularDescuentoRestaPorAsientos(
      asientos,
      50,
      false,
      ['B']
    );
    expect(descuentoTotal).toBe(0);
    expect(algunaCategoriaCumple).toBe(false);
  });

  it('redondea el total a 2 decimales', () => {
    const asientos: Asiento[] = [
      { id: 1, categoria: 'A', precio: 100 },
      { id: 2, categoria: 'A', precio: 100 },
      { id: 3, categoria: 'A', precio: 100 },
    ];
    // 3 * 10.005 = 30.015 => redondeado a 30.02 (Number puede acumular imprecisión).
    const { descuentoTotal } = calcularDescuentoRestaPorAsientos(asientos, 10.005, true, []);
    expect(descuentoTotal).toBe(30.02);
  });
});

/**
 * Feature: promociones-helper-compartido (RESTA), calcularDescuentoRestaPorBoletos:
 * el descuento equivale a min(cantidadResta, precioBoleto) * cantidadBoletos con
 * redondeo a 2 decimales; nunca supera precioBoleto * cantidadBoletos.
 */
describe('calcularDescuentoRestaPorBoletos', () => {
  it('equivale a min(cantidadResta, precioBoleto) * cantidadBoletos redondeado a 2 decimales', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 200_000 }),
        (precioBoleto, cantidadBoletos, cantidadResta) => {
          const esperado =
            Math.round(Math.min(cantidadResta, precioBoleto) * cantidadBoletos * 100) / 100;
          const actual = calcularDescuentoRestaPorBoletos(
            precioBoleto,
            cantidadBoletos,
            cantidadResta
          );
          expect(actual).toBe(esperado);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('el descuento nunca supera precioBoleto * cantidadBoletos (piso por boleto)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 200_000 }),
        (precioBoleto, cantidadBoletos, cantidadResta) => {
          const actual = calcularDescuentoRestaPorBoletos(
            precioBoleto,
            cantidadBoletos,
            cantidadResta
          );
          expect(actual).toBeLessThanOrEqual(precioBoleto * cantidadBoletos + 1e-9);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ejemplo: precioBoleto=100, 3 boletos, cantidadResta=20 => 60', () => {
    expect(calcularDescuentoRestaPorBoletos(100, 3, 20)).toBe(60);
  });

  it('caso borde: cantidadResta mayor al precio se capa al precio del boleto', () => {
    // min(400, 350) * 2 = 700.
    expect(calcularDescuentoRestaPorBoletos(350, 2, 400)).toBe(700);
  });
});

/**
 * Feature: promociones-helper-compartido (RESTA), obtenerMejorPromocion con RESTA:
 * una promoción RESTA participa en la selección por boletos y por asientos; gana
 * si aporta el mayor descuento, y en la variante por asientos se descarta (null)
 * cuando ninguna categoría de la selección aplica.
 */
describe('obtenerMejorPromocion con RESTA', () => {
  const promoBase = (overrides: Partial<Promocion>): Promocion => ({
    id: 1,
    nombre: 'promo',
    tipo: 'PORCENTAJE',
    porcentaje: 10,
    cantidadCompra: 1,
    cantidadPaga: 1,
    aplicaTodoEvento: false,
    categorias: [],
    descuentoCalculado: 0,
    ...overrides,
  });

  it('por boletos: RESTA gana cuando aporta el mayor descuento', () => {
    const promoPct = promoBase({ id: 1, tipo: 'PORCENTAJE', porcentaje: 10, aplicaTodoEvento: true });
    const promoResta = promoBase({
      id: 2,
      tipo: 'RESTA',
      cantidadResta: 50,
      aplicaTodoEvento: true,
    });
    // 4 boletos a 100. PORCENTAJE 10% => 40. RESTA 50 * 4 => 200.
    const resultado = obtenerMejorPromocionPorBoletos([promoPct, promoResta], 4, 100);
    expect(resultado).not.toBeNull();
    expect(resultado!.id).toBe(2);
    expect(resultado!.descuentoCalculado).toBe(200);
    expect(resultado!.precioFinal).toBe(400 - 200);
  });

  it('por boletos: RESTA con cantidadResta como string se interpreta como número', () => {
    const promoResta = promoBase({
      id: 1,
      tipo: 'RESTA',
      cantidadResta: '50.00',
      aplicaTodoEvento: true,
    });
    const resultado = obtenerMejorPromocionPorBoletos([promoResta], 2, 100);
    expect(resultado).not.toBeNull();
    expect(resultado!.descuentoCalculado).toBe(100);
  });

  it('por asientos: RESTA gana cuando aporta el mayor descuento', () => {
    const asientos: Asiento[] = [
      { id: 1, categoria: 'VIP', precio: 350 },
      { id: 2, categoria: 'VIP', precio: 350 },
    ];
    const subtotales = { VIP: 700 };
    const promoPct = promoBase({ id: 1, tipo: 'PORCENTAJE', porcentaje: 10, aplicaTodoEvento: true });
    const promoResta = promoBase({
      id: 2,
      tipo: 'RESTA',
      cantidadResta: 50,
      aplicaTodoEvento: false,
      categorias: [{ categoria: { nombre: 'VIP' } }],
    });
    // PORCENTAJE 10% de 700 = 70. RESTA 50 * 2 = 100.
    const resultado = obtenerMejorPromocionPorAsientos([promoPct, promoResta], asientos, subtotales);
    expect(resultado).not.toBeNull();
    expect(resultado!.id).toBe(2);
    expect(resultado!.descuentoCalculado).toBe(100);
    expect('precioFinal' in resultado!).toBe(false);
  });

  it('por asientos: RESTA se descarta (null) cuando ninguna categoría aplica', () => {
    const asientos: Asiento[] = [
      { id: 1, categoria: 'A', precio: 100 },
      { id: 2, categoria: 'A', precio: 100 },
    ];
    const subtotales = { A: 200 };
    // Promo RESTA restringida a categoría B (no seleccionada) => se salta => null.
    const promoResta = promoBase({
      id: 1,
      tipo: 'RESTA',
      cantidadResta: 50,
      aplicaTodoEvento: false,
      categorias: [{ categoria: { nombre: 'B' } }],
    });
    expect(obtenerMejorPromocionPorAsientos([promoResta], asientos, subtotales)).toBeNull();
  });
});

/**
 * Feature: promociones-helper-compartido (RESTA), normalizarPromocionesAplicaDirecto:
 * convierte cantidadResta string->number, respeta null/undefined, añade
 * porcentaje_original únicamente cuando conPorcentajeOriginal es true, y nunca
 * muta el arreglo ni los objetos originales.
 */
describe('normalizarPromocionesAplicaDirecto', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const promoArb: fc.Arbitrary<any> = fc.record({
    id: fc.integer({ min: 1, max: 100_000 }),
    tipo: fc.constantFrom('PORCENTAJE', 'CANTIDAD', 'RESTA'),
    porcentaje: fc.oneof(fc.integer({ min: 0, max: 100 }), fc.constant(null)),
    cantidadResta: fc.oneof(
      fc.constant(null),
      fc.integer({ min: 0, max: 1000 }),
      fc.integer({ min: 0, max: 1000 }).map((n) => `${n}.00`)
    ),
  });

  it('convierte cantidadResta string a number y respeta null (conPorcentajeOriginal falso)', () => {
    fc.assert(
      fc.property(fc.array(promoArb, { maxLength: 10 }), (promos) => {
        const resultado = normalizarPromocionesAplicaDirecto(promos, false);
        expect(resultado).toHaveLength(promos.length);
        resultado.forEach((r, i) => {
          const original = promos[i];
          if (original.cantidadResta == null) {
            expect(r.cantidadResta).toBe(original.cantidadResta);
          } else {
            expect(typeof r.cantidadResta).toBe('number');
            expect(r.cantidadResta).toBe(Number(original.cantidadResta));
          }
          expect('porcentaje_original' in r).toBe(false);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('añade porcentaje_original = porcentaje solo cuando conPorcentajeOriginal es true', () => {
    fc.assert(
      fc.property(fc.array(promoArb, { maxLength: 10 }), (promos) => {
        const resultado = normalizarPromocionesAplicaDirecto(promos, true);
        resultado.forEach((r, i) => {
          expect(r.porcentaje_original).toBe(promos[i].porcentaje);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('no muta el arreglo ni los objetos originales', () => {
    fc.assert(
      fc.property(fc.array(promoArb, { maxLength: 10 }), (promos) => {
        const copiaProfunda = JSON.parse(JSON.stringify(promos));
        normalizarPromocionesAplicaDirecto(promos, true);
        expect(promos).toEqual(copiaProfunda);
      }),
      { numRuns: 100 }
    );
  });

  it('lista undefined/null => arreglo vacío', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizarPromocionesAplicaDirecto(undefined as unknown as any[])).toEqual([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizarPromocionesAplicaDirecto(null as unknown as any[])).toEqual([]);
  });

  it('ejemplo: cantidadResta "50.00" => 50 y porcentaje_original replicado', () => {
    const promos = [{ id: 12, tipo: 'RESTA', porcentaje: null, cantidadResta: '50.00' }];
    const sinOriginal = normalizarPromocionesAplicaDirecto(promos);
    expect(sinOriginal[0].cantidadResta).toBe(50);
    expect('porcentaje_original' in sinOriginal[0]).toBe(false);

    const conOriginal = normalizarPromocionesAplicaDirecto(promos, true);
    expect(conOriginal[0].cantidadResta).toBe(50);
    expect(conOriginal[0].porcentaje_original).toBe(null);
  });
});
// ---------------------------------------------------------------------------
// Pruebas para el desglose de descuento por categoría (variante por asientos)
// ---------------------------------------------------------------------------

import {
  calcularDescuentoPorCategoriaDeAsientos,
  calcularDescuentoPorcentajePorCategoria as calcularDescuentoPorcentajePorCategoriaDesglose,
} from './promociones';

/**
 * Feature: promociones-helper-compartido (RESTA/desglose), calcularDescuentoPorCategoriaDeAsientos:
 *
 * Devuelve el descuento desglosado por categoría para la variante por asientos.
 * INVARIANTE PRINCIPAL: la suma de los valores del Record devuelto debe coincidir
 * (con tolerancia de redondeo) con el descuentoTotal que devuelven las funciones
 * existentes (calcularDescuentoRestaPorAsientos / calcularDescuentoCantidadPorAsientos /
 * calcularDescuentoPorcentajePorCategoria) para los mismos inputs.
 *
 * Validates: Requirements 2.2, 3.2
 */
describe('Feature: promociones-helper-compartido (RESTA/desglose): calcularDescuentoPorCategoriaDeAsientos', () => {
  // Genera asientos deterministas para formar grupos por categoría/precio.
  const asientoArb: fc.Arbitrary<Asiento> = fc.record({
    id: fc.integer({ min: 0, max: 100_000 }),
    categoria: fc.constantFrom('A', 'B', 'C'),
    precio: fc.integer({ min: 0, max: 1000 }),
  });

  const asientosArb = fc.array(asientoArb, { maxLength: 30 });

  // Subtotales por categoría derivados de la selección de asientos.
  const subtotalesDe = (asientos: Asiento[]): Record<string, number> => {
    const subtotales: Record<string, number> = {};
    for (const a of asientos) {
      subtotales[a.categoria] = (subtotales[a.categoria] ?? 0) + Number(a.precio);
    }
    return subtotales;
  };

  const sumaDesglose = (desglose: Record<string, number>): number =>
    Object.values(desglose).reduce((acc, v) => acc + v, 0);

  it('invariante de suma (RESTA): sum(desglose) ≈ descuentoTotal de calcularDescuentoRestaPorAsientos', () => {
    fc.assert(
      fc.property(
        asientosArb,
        fc.integer({ min: 0, max: 2000 }),
        fc.boolean(),
        fc.subarray(['A', 'B', 'C']),
        (asientos, cantidadResta, aplicaTodoEvento, categoriasAplicables) => {
          const { descuentoTotal } = calcularDescuentoRestaPorAsientos(
            asientos,
            cantidadResta,
            aplicaTodoEvento,
            categoriasAplicables
          );
          const desglose = calcularDescuentoPorCategoriaDeAsientos(
            { tipo: 'RESTA', porcentaje: 0, cantidadResta, cantidadCompra: 0, cantidadPaga: 0, aplicaTodoEvento },
            asientos,
            subtotalesDe(asientos),
            categoriasAplicables
          );
          expect(sumaDesglose(desglose)).toBeCloseTo(descuentoTotal, 6);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('invariante de suma (CANTIDAD): sum(desglose) ≈ descuentoTotal de calcularDescuentoCantidadPorAsientos', () => {
    fc.assert(
      fc.property(
        asientosArb,
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 0, max: 5 }),
        fc.boolean(),
        fc.subarray(['A', 'B', 'C']),
        (asientos, cantidadCompra, cantidadPaga, aplicaTodoEvento, categoriasAplicables) => {
          const { descuentoTotal } = calcularDescuentoCantidadPorAsientos(
            asientos,
            cantidadCompra,
            cantidadPaga,
            aplicaTodoEvento,
            categoriasAplicables
          );
          const desglose = calcularDescuentoPorCategoriaDeAsientos(
            { tipo: 'CANTIDAD', porcentaje: 0, cantidadResta: null, cantidadCompra, cantidadPaga, aplicaTodoEvento },
            asientos,
            subtotalesDe(asientos),
            categoriasAplicables
          );
          expect(sumaDesglose(desglose)).toBeCloseTo(descuentoTotal, 6);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('invariante de suma (PORCENTAJE): sum(desglose) ≈ descuentoTotal de calcularDescuentoPorcentajePorCategoria', () => {
    fc.assert(
      fc.property(
        asientosArb,
        fc.integer({ min: 0, max: 100 }),
        fc.boolean(),
        fc.subarray(['A', 'B', 'C']),
        (asientos, porcentaje, aplicaTodoEvento, categoriasAplicables) => {
          const subtotales = subtotalesDe(asientos);
          const descuentoTotal = calcularDescuentoPorcentajePorCategoriaDesglose(
            subtotales,
            porcentaje,
            aplicaTodoEvento,
            categoriasAplicables
          );
          const desglose = calcularDescuentoPorCategoriaDeAsientos(
            { tipo: 'PORCENTAJE', porcentaje, cantidadResta: null, cantidadCompra: 0, cantidadPaga: 0, aplicaTodoEvento },
            asientos,
            subtotales,
            categoriasAplicables
          );
          expect(sumaDesglose(desglose)).toBeCloseTo(descuentoTotal, 6);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('las categorías no aplicables no aparecen en el resultado', () => {
    fc.assert(
      fc.property(
        fc.array(asientoArb, { minLength: 1, maxLength: 30 }),
        fc.constantFrom('RESTA' as const, 'CANTIDAD' as const, 'PORCENTAJE' as const),
        fc.subarray(['A', 'B', 'C']),
        (asientos, tipo, categoriasAplicables) => {
          const desglose = calcularDescuentoPorCategoriaDeAsientos(
            {
              tipo,
              porcentaje: 10,
              cantidadResta: 50,
              cantidadCompra: 2,
              cantidadPaga: 1,
              aplicaTodoEvento: false,
            },
            asientos,
            subtotalesDe(asientos),
            categoriasAplicables
          );
          // Toda categoría presente en el resultado debe ser aplicable.
          Object.keys(desglose).forEach((categoria) => {
            expect(categoriasAplicables.includes(categoria)).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // Ejemplo RESTA de la documentación (sección 5/6).
  it('ejemplo doc RESTA: cantidadResta=50, PREFERENTE x2 a 350 y GENERAL a 200 => { PREFERENTE: 100, GENERAL: 50 }', () => {
    const asientos: Asiento[] = [
      { id: 1, categoria: 'PREFERENTE', precio: 350 },
      { id: 2, categoria: 'PREFERENTE', precio: 350 },
      { id: 3, categoria: 'GENERAL', precio: 200 },
    ];
    const subtotales = { PREFERENTE: 700, GENERAL: 200 };
    const desglose = calcularDescuentoPorCategoriaDeAsientos(
      {
        tipo: 'RESTA',
        porcentaje: 0,
        cantidadResta: 50,
        cantidadCompra: 0,
        cantidadPaga: 0,
        aplicaTodoEvento: false,
      },
      asientos,
      subtotales,
      ['PREFERENTE', 'GENERAL']
    );
    expect(desglose).toEqual({ PREFERENTE: 100, GENERAL: 50 });
  });

  it('ejemplo: categoría no aplicable se omite del resultado (RESTA)', () => {
    const asientos: Asiento[] = [
      { id: 1, categoria: 'VIP', precio: 350 },
      { id: 2, categoria: 'VIP', precio: 350 },
      { id: 3, categoria: 'General', precio: 200 },
    ];
    const subtotales = { VIP: 700, General: 200 };
    const desglose = calcularDescuentoPorCategoriaDeAsientos(
      {
        tipo: 'RESTA',
        porcentaje: 0,
        cantidadResta: 50,
        cantidadCompra: 0,
        cantidadPaga: 0,
        aplicaTodoEvento: false,
      },
      asientos,
      subtotales,
      ['VIP']
    );
    expect(desglose).toEqual({ VIP: 100 });
    expect('General' in desglose).toBe(false);
  });

  it('ejemplo PORCENTAJE: desglose por categoría aplicable', () => {
    const asientos: Asiento[] = [
      { id: 1, categoria: 'A', precio: 500 },
      { id: 2, categoria: 'A', precio: 500 },
      { id: 3, categoria: 'B', precio: 200 },
    ];
    const subtotales = { A: 1000, B: 200 };
    const desglose = calcularDescuentoPorCategoriaDeAsientos(
      {
        tipo: 'PORCENTAJE',
        porcentaje: 10,
        cantidadResta: null,
        cantidadCompra: 0,
        cantidadPaga: 0,
        aplicaTodoEvento: false,
      },
      asientos,
      subtotales,
      ['A']
    );
    // 10% de A(1000) = 100; B no aplica.
    expect(desglose).toEqual({ A: 100 });
  });

  it('ejemplo CANTIDAD: desglose por categoría con grupo completo', () => {
    const asientos: Asiento[] = [
      { id: 1, categoria: 'A', precio: 100 },
      { id: 2, categoria: 'A', precio: 100 },
      { id: 3, categoria: 'A', precio: 100 },
      { id: 4, categoria: 'A', precio: 100 },
      { id: 5, categoria: 'B', precio: 50 },
    ];
    const subtotales = { A: 400, B: 50 };
    const desglose = calcularDescuentoPorCategoriaDeAsientos(
      {
        tipo: 'CANTIDAD',
        porcentaje: 0,
        cantidadResta: null,
        cantidadCompra: 2,
        cantidadPaga: 1,
        aplicaTodoEvento: true,
      },
      asientos,
      subtotales,
      []
    );
    // A: 4/2 = 2 grupos => 2 gratis * 100 = 200. B: 1 < 2 => sin grupo => omitido.
    expect(desglose).toEqual({ A: 200 });
  });

  it('aplicaTodoEvento=true: incluye todas las categorías con descuento > 0 (RESTA)', () => {
    const asientos: Asiento[] = [
      { id: 1, categoria: 'A', precio: 100 },
      { id: 2, categoria: 'B', precio: 100 },
    ];
    const subtotales = { A: 100, B: 100 };
    const desglose = calcularDescuentoPorCategoriaDeAsientos(
      {
        tipo: 'RESTA',
        porcentaje: 0,
        cantidadResta: 30,
        cantidadCompra: 0,
        cantidadPaga: 0,
        aplicaTodoEvento: true,
      },
      asientos,
      subtotales,
      []
    );
    expect(desglose).toEqual({ A: 30, B: 30 });
  });
});
