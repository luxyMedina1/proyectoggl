import { describe, it, expect } from "vitest";
import { proyectarCabeceraEvento } from "./cabeceraEvento";

// Task 3.3 — test de propiedad.
//
// **Feature: mejoras-extra-migracion, Property 9: Cabecera_Evento es una proyección que excluye la disponibilidad**
// **Validates: Requirements 26.1, 26.2**
//
// Property: para todo objeto de evento, la proyección Cabecera_Evento pasada a EventoDetalleView
// contiene EXACTAMENTE las claves nombre, fecha, imagenPromocion, recinto, ciudad, descripcion, y
// NUNCA `secciones` ni `secciones[].asientosDisponibles` (restricción anti venta doble, Req 26.2).
//
// fast-check no está instalado en el proyecto, así que se usa un generador determinista con semilla
// (LCG) que produce 200 entradas de evento variadas. Cada evento generado INCLUYE a propósito
// `secciones` con `asientosDisponibles` y claves extra que NO deben aparecer en la proyección, para
// que la propiedad tenga algo real que excluir.

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

const enteroEntre = (rng: () => number, min: number, max: number): number =>
  min + Math.floor(rng() * (max - min + 1));

const NOMBRES = ["Concierto de Rock", "Festival de Jazz", "Obra de Teatro", "Ballet Clásico"];
const FECHAS = [
  "2025-01-15T20:00:00-06:00",
  "2025-06-30T18:30:00-06:00",
  "2025-12-31T22:00:00-06:00",
];
const RECINTOS = ["Auditorio Nacional", "Teatro Metropólitan", "Arena Ciudad de México"];
const CIUDADES = ["Ciudad de México", "Monterrey", "Guadalajara", "Cancún"];

const LLAVES_CABECERA = [
  "nombre",
  "fecha",
  "imagenPromocion",
  "recinto",
  "ciudad",
  "descripcion",
] as const;

// Genera un evento "completo" al estilo del DTO del backend: además de las 6 claves de la
// cabecera, incluye secciones con asientosDisponibles y varias claves extra (precioBase,
// preciosCategorias, limiteDeAsientos, etc.) que NO deben filtrarse a la proyección.
const generarEventoCompleto = (rng: () => number): Record<string, unknown> => {
  const numSecciones = enteroEntre(rng, 0, 4);
  const secciones = Array.from({ length: numSecciones }, (_, i) => ({
    id: i + 1,
    nombre: `Sección ${i + 1}`,
    precioAdicional: String(enteroEntre(rng, 0, 500)),
    asientosDisponibles: enteroEntre(rng, 0, 300),
    filas: [],
    tipo_seccion: elegir(rng, ["general", "numerada", "suite", "mesas"] as const),
    color: "#ffffff",
  }));

  return {
    id: enteroEntre(rng, 1, 9999),
    slug: rng() > 0.5 ? "algun-slug" : null,
    nombre: elegir(rng, NOMBRES),
    fecha: elegir(rng, FECHAS),
    aperturaPuertas: rng() > 0.5 ? "2025-01-15T18:00:00-06:00" : null,
    finalEvento: rng() > 0.5 ? "2025-01-15T23:00:00-06:00" : null,
    funciones: [],
    precioBase: String(enteroEntre(rng, 100, 5000)),
    recinto: {
      id: enteroEntre(rng, 1, 100),
      nombre: elegir(rng, RECINTOS),
      svg: "<svg></svg>",
      direccion: "Av. Reforma 50",
    },
    // Clave crítica que la proyección DEBE excluir (venta doble).
    secciones,
    descripcion: "<p>Descripción del <strong>evento</strong></p>",
    ciudad: { id: enteroEntre(rng, 1, 100), nombre: elegir(rng, CIUDADES) },
    imagenPromocion: rng() > 0.3 ? "https://ejemplo.com/img.jpg" : "",
    artista: { id: 1, nombre: "Los Tigres" },
    preciosCategorias: [],
    limiteDeAsientos: enteroEntre(rng, 1, 10),
    udsPorCategoria: rng() > 0.5,
    esGratuito: rng() > 0.8,
    usoDeServicio: "10",
    metaPixels: ["123456"],
  };
};

const ITERACIONES = 200;

describe("Property 9: Cabecera_Evento es una proyección que excluye la disponibilidad", () => {
  it("proyecta EXACTAMENTE las 6 claves de la cabecera para 200 eventos variados (Req 26.1)", () => {
    const rng = crearRng(0x9e3779b9);

    for (let i = 0; i < ITERACIONES; i++) {
      const evento = generarEventoCompleto(rng);
      // El proyector es puro; el cast refleja que la fuente es un DTO laxo del backend.
      const cabecera = proyectarCabeceraEvento(evento as never);

      const claves = Object.keys(cabecera).sort();

      // Cantidad exacta: ni una clave de más, ni una de menos (Req 26.1).
      expect(claves).toHaveLength(6);
      // Igualdad de conjuntos con el subconjunto declarado.
      expect(claves).toEqual([...LLAVES_CABECERA].sort());

      // Los valores de esas 6 claves derivan de la fuente sin alterarse.
      expect(cabecera.nombre).toBe(evento.nombre);
      expect(cabecera.fecha).toBe(evento.fecha);
      expect(cabecera.imagenPromocion).toBe(evento.imagenPromocion);
      expect(cabecera.recinto).toBe(evento.recinto);
      expect(cabecera.ciudad).toBe(evento.ciudad);
      expect(cabecera.descripcion).toBe(evento.descripcion);
    }
  });

  it("NUNCA incluye `secciones` ni `asientosDisponibles` en ningún nivel (Req 26.2, venta doble)", () => {
    const rng = crearRng(0x1a2b3c4d);

    for (let i = 0; i < ITERACIONES; i++) {
      const evento = generarEventoCompleto(rng);
      const cabecera = proyectarCabeceraEvento(evento as never);

      // Nivel superior: la proyección no arrastra `secciones`.
      expect(Object.prototype.hasOwnProperty.call(cabecera, "secciones")).toBe(false);
      expect((cabecera as unknown as Record<string, unknown>).secciones).toBeUndefined();

      // Ningún valor/subobjeto de la cabecera contiene `asientosDisponibles` ni `secciones`
      // en ningún nivel de anidación (recinto/ciudad no las llevan; se verifica por si acaso).
      const serializado = JSON.stringify(cabecera);
      expect(serializado).not.toContain("asientosDisponibles");
      expect(serializado).not.toContain("secciones");

      // Prueba de contraste: la fuente SÍ traía disponibilidad, por lo que el aserto anterior
      // demuestra que la proyección la excluye activamente (no que nunca existió).
      if ((evento.secciones as unknown[]).length > 0) {
        expect(JSON.stringify(evento.secciones)).toContain("asientosDisponibles");
      }
    }
  });
});
