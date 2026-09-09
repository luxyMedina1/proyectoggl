import { describe, it, expect } from "vitest";
import { construirProductJsonLd, type PaqueteParaJsonLd } from "@/utils/jsonLdCityPass";
import { textoPlano } from "@/utils/sanitizeHtml";

// Task 5.7 — test de propiedad.
//
// **Feature: mejoras-extra-migracion, Property 4: Forma del JSON-LD de CityPass**
// **Validates: Requirements 1.6**
//
// Property: para todo paquete de CityPass resuelto, `construirProductJsonLd` produce un objeto con
// `@type: "Product"` cuyo `offers` es un `Offer` con `priceCurrency: "MXN"` y `price` igual al menor
// de `precios` (ausente cuando no hay precios). name/description/image derivan de la fuente real, y
// `availability` aplica la MISMA regla tri-estado que el evento: se OMITE cuando `disponibleVenta` es
// `undefined`, es `InStock` cuando `true` y `SoldOut` cuando `false` — nunca se fija `InStock`.
//
// fast-check no está instalado en el repo: se usa un generador determinista sembrado (LCG) que
// recorre >=100 entradas variando nombre, descripcion, imagenPrincipal, precios (vacío/múltiple → el
// menor) y disponibleVenta (undefined/true/false).

const IN_STOCK = "https://schema.org/InStock";
const SOLD_OUT = "https://schema.org/SoldOut";

// PRNG determinista (LCG de Numerical Recipes) — sin dependencias externas y reproducible.
const crearRng = (semilla: number) => {
  let estado = semilla >>> 0;
  return () => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    return estado / 0x100000000;
  };
};

const elegir = <T,>(rng: () => number, opciones: readonly T[]): T =>
  opciones[Math.floor(rng() * opciones.length)];

const NOMBRES = [
  "CityPass Cancún",
  "Pase Total CDMX",
  "Bundle Riviera Maya",
  "Combo Monterrey",
  "Explora Guadalajara",
];

const DESCRIPCIONES: (string | null)[] = [
  "<p>Acceso a <strong>5</strong> atracciones</p>",
  "Pase con acceso ilimitado",
  "<div>Incluye transporte & guía</div>",
  null,
];

const IMAGENES: (string | null)[] = [
  "https://cdn.ejemplo.com/citypass-1.jpg",
  "https://cdn.ejemplo.com/citypass-2.png",
  null,
];

// Los tres estados del tri-estado `disponibleVenta` con su expectativa sobre `availability`.
const CASOS_VENTA: Array<{ disponibleVenta: boolean | undefined; esperado: string | null }> = [
  { disponibleVenta: undefined, esperado: null }, // omitido: la clave NO debe existir
  { disponibleVenta: true, esperado: IN_STOCK },
  { disponibleVenta: false, esperado: SOLD_OUT },
];

// Genera una lista de precios variada: a veces vacía (→ price ausente), a veces con múltiples
// entradas (→ price es el menor).
const generarPrecios = (rng: () => number): { precio: number }[] => {
  const n = Math.floor(rng() * 4); // 0..3 entradas
  const precios: { precio: number }[] = [];
  for (let i = 0; i < n; i++) {
    // Precios entre 100 y ~5100, con decimales, para que el mínimo sea significativo.
    precios.push({ precio: Math.round(rng() * 5000 + 100) + rng() });
  }
  return precios;
};

// Menor precio esperado, replicando la semántica del helper (undefined si no hay precios).
const menorEsperado = (precios: { precio: number }[]): number | undefined =>
  precios.length === 0 ? undefined : Math.min(...precios.map((p) => p.precio));

const URL = "https://taquillavip.com/citypass/cancun/paquete/pase-total";

describe("construirProductJsonLd — Property 4: Forma del JSON-LD de CityPass", () => {
  it("produce Product/Offer con price = min(precios) y availability tri-estado derivada de la fuente (>=100 iteraciones)", () => {
    const rng = crearRng(0x4c17ada5);
    let iteraciones = 0;

    // 40 paquetes x 3 estados de venta = 120 iteraciones (>= 100 exigidas).
    for (let i = 0; i < 40; i++) {
      const nombre = elegir(rng, NOMBRES);
      const descripcion = elegir(rng, DESCRIPCIONES);
      const imagenPrincipal = elegir(rng, IMAGENES);
      const precios = generarPrecios(rng);

      for (const { disponibleVenta, esperado } of CASOS_VENTA) {
        const paquete: PaqueteParaJsonLd = {
          nombre,
          descripcion,
          imagenPrincipal,
          precios,
          disponibleVenta,
        };

        const jsonLd = construirProductJsonLd(paquete, URL);

        // @context y @type fijos de schema.org: Product (no Event).
        expect(jsonLd["@context"]).toBe("https://schema.org");
        expect(jsonLd["@type"]).toBe("Product");

        // name/description/image derivan de la fuente real.
        expect(jsonLd.name).toBe(nombre);
        expect(jsonLd.description).toBe(descripcion ? textoPlano(descripcion) : undefined);
        expect(jsonLd.image).toEqual(imagenPrincipal ? [imagenPrincipal] : undefined);

        // offers es un Offer en MXN, con la URL y el precio derivados de la fuente.
        const offers = jsonLd.offers as Record<string, unknown>;
        expect(offers["@type"]).toBe("Offer");
        expect(offers.priceCurrency).toBe("MXN");
        expect(offers.url).toBe(URL);

        // price = menor de `precios`, o ausente/undefined cuando la lista está vacía.
        const esperadoPrecio = menorEsperado(precios);
        expect(offers.price).toBe(esperadoPrecio);

        // Regla de omisión de disponibilidad idéntica al evento (Req 1.6 → misma regla que 1.3/1.4).
        if (esperado === null) {
          // undefined → la clave `availability` está AUSENTE (no presente con undefined).
          expect(Object.prototype.hasOwnProperty.call(offers, "availability")).toBe(false);
          expect("availability" in offers).toBe(false);
        } else {
          expect(offers.availability).toBe(esperado);
        }

        // Regla dura: InStock jamás aparece salvo que disponibleVenta === true.
        if (disponibleVenta !== true) {
          expect(offers.availability).not.toBe(IN_STOCK);
        }

        iteraciones++;
      }
    }

    expect(iteraciones).toBeGreaterThanOrEqual(100);
  });

  it("con múltiples precios, price es el menor; con lista vacía, price está ausente", () => {
    // Caso explícito de la regla del mínimo, complementando el barrido aleatorio.
    const conVarios: PaqueteParaJsonLd = {
      nombre: "CityPass Mérida",
      precios: [{ precio: 900 }, { precio: 350.5 }, { precio: 1200 }],
      disponibleVenta: true,
    };
    const varios = construirProductJsonLd(conVarios, URL).offers as Record<string, unknown>;
    expect(varios.price).toBe(350.5);
    expect(varios.availability).toBe(IN_STOCK);

    const sinPrecios: PaqueteParaJsonLd = {
      nombre: "CityPass sin precios",
      precios: [],
      disponibleVenta: false,
    };
    const vacio = construirProductJsonLd(sinPrecios, URL).offers as Record<string, unknown>;
    expect(vacio.price).toBeUndefined();
    expect(vacio.availability).toBe(SOLD_OUT);
  });
});
