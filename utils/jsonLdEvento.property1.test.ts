import { describe, it, expect } from "vitest";
import { construirEventJsonLd, type EventoParaJsonLd } from "@/utils/jsonLdEvento";

// Task 5.2 — test de propiedad.
//
// **Feature: mejoras-extra-migracion, Property 1: Forma del JSON-LD de evento derivada de la fuente**
// **Validates: Requirements 1.1, 1.2, 1.7**
//
// Property: para todo evento resuelto, construirEventJsonLd produce un objeto con @context de
// schema.org y @type: "Event", cuyos campos name/startDate/location/offers se derivan de los datos
// reales (name === evento.nombre, startDate === evento.fecha, addressLocality === evento.ciudad.nombre).
// Aplica igual a una entidad de conferencia mapeada a EventoParaJsonLd.
//
// fast-check no está instalado en el proyecto, así que se usa un generador determinista con semilla
// (LCG) que produce 100+ entradas EventoParaJsonLd variadas (variando nombre, fecha, recinto, ciudad,
// artista, precioBase, con/sin campos opcionales, incluyendo entidades tipo conferencia).

// --- PRNG determinista (LCG de Numerical Recipes) para reproducibilidad ---
const crearRng = (semilla: number) => {
  let estado = semilla >>> 0;
  return () => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    return estado / 0xffffffff;
  };
};

const elegir = <T,>(rng: () => number, opciones: readonly T[]): T =>
  opciones[Math.floor(rng() * opciones.length)];

const NOMBRES = [
  "Concierto de Rock",
  "Festival de Jazz",
  "Obra de Teatro",
  "Cumbre Cosmotech 2025", // entidad de conferencia mapeada a EventoParaJsonLd
  "Ballet Clásico",
  "Stand-up Comedy",
  "Ópera al Aire Libre",
];

const FECHAS = [
  "2025-01-15T20:00:00-06:00",
  "2025-06-30T18:30:00-06:00",
  "2025-12-31T22:00:00-06:00",
  "2026-03-01T09:00:00-06:00",
];

const RECINTOS = [
  "Auditorio Nacional",
  "Teatro Metropólitan",
  "Arena Ciudad de México",
  "Centro de Convenciones",
];

const DIRECCIONES = ["Av. Reforma 50", "Calle 5 de Mayo 12", "Blvd. Kukulcán km 9"];

const CIUDADES = ["Ciudad de México", "Monterrey", "Guadalajara", "Cancún", "Mérida"];

const ARTISTAS = ["Los Tigres", "Orquesta Filarmónica", "Grupo Sorpresa", "Ponente Invitado"];

const PRECIOS: (string | number)[] = ["350", "1200.50", 500, 999, "0"];

// Genera una entidad EventoParaJsonLd variada. Los campos opcionales se incluyen/omiten
// según el RNG para cubrir la forma con y sin recinto, ciudad, artista y precioBase.
const generarEvento = (rng: () => number): EventoParaJsonLd => {
  const tieneRecinto = rng() > 0.15;
  const tieneCiudad = rng() > 0.15;
  const tieneArtista = rng() > 0.4;
  const tieneDireccion = rng() > 0.3;
  const tienePrecio = rng() > 0.2;

  return {
    nombre: elegir(rng, NOMBRES),
    fecha: elegir(rng, FECHAS),
    imagenPromocion: rng() > 0.5 ? "https://ejemplo.com/img.jpg" : null,
    descripcion: rng() > 0.5 ? "<p>Descripción del <strong>evento</strong></p>" : null,
    precioBase: tienePrecio ? elegir(rng, PRECIOS) : null,
    recinto: tieneRecinto
      ? {
          nombre: elegir(rng, RECINTOS),
          direccion: tieneDireccion ? elegir(rng, DIRECCIONES) : null,
        }
      : null,
    ciudad: tieneCiudad ? { nombre: elegir(rng, CIUDADES) } : null,
    artista: tieneArtista ? { nombre: elegir(rng, ARTISTAS) } : null,
  };
};

const ITERACIONES = 200;
const URL = "https://taquillavip.com/eventos/algun-evento";

describe("Property 1: Forma del JSON-LD de evento derivada de la fuente", () => {
  it("produce @context schema.org y @type Event, con name/startDate/location/offers derivados de la fuente (100+ entradas)", () => {
    const rng = crearRng(0x1a2b3c4d);

    for (let i = 0; i < ITERACIONES; i++) {
      const evento = generarEvento(rng);
      const jsonLd = construirEventJsonLd(evento, URL);

      // @context y @type fijos de schema.org (Req 1.1)
      expect(jsonLd["@context"]).toBe("https://schema.org");
      expect(jsonLd["@type"]).toBe("Event");

      // name y startDate derivan de los datos reales del evento (Req 1.2)
      expect(jsonLd.name).toBe(evento.nombre);
      expect(jsonLd.startDate).toBe(evento.fecha);

      // location es un Place con la ciudad como addressLocality (Req 1.2)
      const location = jsonLd.location as {
        "@type": string;
        name?: string | null;
        address: {
          "@type": string;
          streetAddress?: string | null;
          addressLocality?: string | null;
          addressCountry: string;
        };
      };
      expect(location["@type"]).toBe("Place");
      expect(location.name).toBe(evento.recinto?.nombre);
      expect(location.address["@type"]).toBe("PostalAddress");
      expect(location.address.streetAddress).toBe(evento.recinto?.direccion);
      expect(location.address.addressLocality).toBe(evento.ciudad?.nombre);
      expect(location.address.addressCountry).toBe("MX");

      // offers deriva del precioBase real (Req 1.2)
      const offers = jsonLd.offers as {
        "@type": string;
        priceCurrency: string;
        lowPrice?: string | number;
        url: string;
        availability?: string;
      };
      expect(offers["@type"]).toBe("AggregateOffer");
      expect(offers.priceCurrency).toBe("MXN");
      expect(offers.url).toBe(URL);
      expect(offers.lowPrice).toBe(evento.precioBase ?? undefined);

      // performer deriva del artista real cuando existe (aplica a conferencia con ponente) (Req 1.7)
      if (evento.artista?.nombre) {
        expect(jsonLd.performer).toEqual({
          "@type": "PerformingGroup",
          name: evento.artista.nombre,
        });
      } else {
        expect(jsonLd.performer).toBeUndefined();
      }
    }
  });

  it("aplica la misma forma a una entidad de conferencia mapeada a EventoParaJsonLd (Req 1.7)", () => {
    // Una conferencia (Cosmotech) se reutiliza mapeándola al mismo tipo; la forma resultante
    // debe derivar de la fuente igual que un evento.
    const conferencia: EventoParaJsonLd = {
      nombre: "Cosmotech Summit 2025",
      fecha: "2025-09-10T09:00:00-06:00",
      recinto: { nombre: "Centro de Convenciones", direccion: "Av. Congreso 100" },
      ciudad: { nombre: "Guadalajara" },
      artista: { nombre: "Keynote Speaker" },
      precioBase: "1500",
    };

    const jsonLd = construirEventJsonLd(conferencia, URL);

    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("Event");
    expect(jsonLd.name).toBe(conferencia.nombre);
    expect(jsonLd.startDate).toBe(conferencia.fecha);
    const location = jsonLd.location as { address: { addressLocality?: string | null } };
    expect(location.address.addressLocality).toBe(conferencia.ciudad?.nombre);
  });
});
