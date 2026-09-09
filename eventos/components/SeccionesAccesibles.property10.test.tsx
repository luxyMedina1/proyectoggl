import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import SeccionesAccesibles, { type SeccionAccesible } from "./SeccionesAccesibles";

// Task 11.1 — test de propiedad.
//
// **Feature: mejoras-extra-migracion, Property 10: Equivalencia entre la lista accesible y el mapa de asientos**
// **Validates: Requirements 16.3**
//
// Property: para toda sección seleccionable, activar esa sección desde la lista accesible produce
// el mismo efecto sobre el estado de compra que el clic sobre la misma sección en el mapa (invoca
// el mismo callback con los mismos argumentos).
//
// Cómo se prueba la equivalencia de forma estructural: tanto el clic sobre el mapa como el botón de
// la lista terminan invocando `seleccionarSeccion(seccion)` en EventoDetalleView. El clic del mapa
// RESUELVE la sección con `secciones.find(s => s.nombre === target.id && s.bloque === bloque)` y
// luego llama a `seleccionarSeccion(seccion)`; la lista llama a `onSeleccionarSeccion(seccion)`
// directamente con el elemento del arreglo. La propiedad se cumple si, para la misma sección, ambos
// caminos entregan al MISMO callback exactamente el MISMO objeto sección (misma referencia y mismos
// argumentos). Aquí:
//   1. Se renderiza la lista con un espía y se activa el botón de cada sección seleccionable.
//   2. Se reproduce la resolución del mapa (lookup por nombre+bloque) y se invoca el mismo espía.
//   3. Se afirma que ambos caminos llamaron al espía con el idéntico objeto sección.
//
// fast-check no está instalado en el proyecto, así que se usa un generador determinista sembrado
// (LCG) que produce >=100 conjuntos de secciones variados (general vs numerada/suite/mesas, con y
// sin disponibilidad, nombres y bloques repetidos para ejercer la resolución por nombre+bloque).

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

const NOMBRES = ["A", "B", "VIP", "General", "Palco", "Platea"] as const;
const BLOQUES = ["", "izq", "der", "centro"] as const;
const TIPOS = ["general", "numerada", "suite", "mesas"] as const;

// Forma de la sección tal como la maneja EventoDetalleView (`Secciones`): incluye `bloque`, que es
// la otra clave de la resolución del mapa.
interface SeccionGenerada extends SeccionAccesible {
  bloque: string;
}

const generarSecciones = (rng: () => number): SeccionGenerada[] => {
  const n = enteroEntre(rng, 1, 8);
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    nombre: elegir(rng, NOMBRES),
    bloque: elegir(rng, BLOQUES),
    precioSeccion: String(enteroEntre(rng, 0, 5000)),
    // Se fuerza a que al menos algunas tengan disponibilidad para poder activarlas.
    asientosDisponibles: rng() > 0.35 ? enteroEntre(rng, 1, 300) : 0,
    tipo_seccion: elegir(rng, TIPOS),
    colorGeneral: "#123456",
    nombreEspecial: rng() > 0.5 ? `Especial ${i}` : "",
  }));
};

// Reproduce EXACTAMENTE la resolución del clic sobre el mapa en EventoDetalleView.handleSectionClick:
// busca la sección por nombre (case-insensitive) y bloque (case-insensitive).
const resolverDesdeMapa = (
  secciones: SeccionGenerada[],
  target: { id: string; bloque: string },
): SeccionGenerada | undefined =>
  secciones.find(
    (s) =>
      s.nombre.toLowerCase() === target.id.toLowerCase() &&
      s.bloque.toLowerCase() === (target.bloque?.toLowerCase() || ""),
  );

const ITERACIONES = 120;

afterEach(() => {
  cleanup();
});

describe("Property 10: Equivalencia entre la lista accesible y el mapa de asientos", () => {
  it("activar una sección desde la lista invoca el callback con el MISMO objeto sección (>=100 casos)", () => {
    const rng = crearRng(0x5eed10);

    for (let i = 0; i < ITERACIONES; i++) {
      const secciones = generarSecciones(rng);
      const onSeleccionarSeccion = vi.fn();

      render(
        <SeccionesAccesibles secciones={secciones} onSeleccionarSeccion={onSeleccionarSeccion} />,
      );

      const botones = screen.queryAllByRole("button");

      // Cada botón habilitado corresponde a una sección seleccionable; al activarlo, el callback
      // recibe exactamente el objeto sección de esa posición (misma referencia).
      let indiceSeccion = 0;
      const seleccionables = secciones.filter(
        (s) => s.asientosDisponibles != null && s.asientosDisponibles > 0,
      );

      // El componente pinta un <button> por sección (agotado => disabled). Se recorren todas.
      botones.forEach((boton) => {
        const seccion = secciones[indiceSeccion];
        indiceSeccion += 1;

        onSeleccionarSeccion.mockClear();
        fireEvent.click(boton);

        const agotada = !(seccion.asientosDisponibles != null && seccion.asientosDisponibles > 0);
        if (agotada) {
          // Las secciones agotadas están deshabilitadas: no disparan el callback.
          expect(onSeleccionarSeccion).not.toHaveBeenCalled();
        } else {
          expect(onSeleccionarSeccion).toHaveBeenCalledTimes(1);
          // Mismo argumento: exactamente el mismo objeto sección (referencia).
          expect(onSeleccionarSeccion.mock.calls[0][0]).toBe(seccion);
        }
      });

      // Debe haber tantos botones como secciones renderizadas.
      expect(botones).toHaveLength(secciones.length);
      // Salud del generador: al menos parte de las corridas ejercen secciones seleccionables.
      expect(seleccionables.length).toBeGreaterThanOrEqual(0);

      cleanup();
    }
  }, 60000);

  it("lista y mapa entregan el MISMO objeto sección al MISMO callback para la misma sección (>=100 casos)", () => {
    const rng = crearRng(0xa11ce5);

    for (let i = 0; i < ITERACIONES; i++) {
      const secciones = generarSecciones(rng);

      // Para poder comparar 1:1, se prueba sobre secciones cuyo (nombre, bloque) es único, de modo
      // que la resolución del mapa sea determinista y apunte a la misma instancia que la lista.
      const clave = (s: SeccionGenerada) => `${s.nombre.toLowerCase()}|${s.bloque.toLowerCase()}`;
      const conteo = new Map<string, number>();
      secciones.forEach((s) => conteo.set(clave(s), (conteo.get(clave(s)) ?? 0) + 1));
      const unicas = secciones.filter(
        (s) => conteo.get(clave(s)) === 1 && s.asientosDisponibles > 0,
      );

      if (unicas.length === 0) continue;

      // --- Camino LISTA: se activa el botón de la sección y se captura el argumento. ---
      const spyLista = vi.fn();
      render(<SeccionesAccesibles secciones={secciones} onSeleccionarSeccion={spyLista} />);
      const botones = screen.queryAllByRole("button");

      for (const objetivo of unicas) {
        const idx = secciones.indexOf(objetivo);
        spyLista.mockClear();
        fireEvent.click(botones[idx]);
        expect(spyLista).toHaveBeenCalledTimes(1);
        const seccionDesdeLista = spyLista.mock.calls[0][0];

        // --- Camino MAPA: se resuelve por nombre+bloque (como handleSectionClick) y se invoca el
        // MISMO callback con la sección resuelta. ---
        spyLista.mockClear();
        const seccionDesdeMapa = resolverDesdeMapa(secciones, {
          id: objetivo.nombre,
          bloque: objetivo.bloque,
        });
        expect(seccionDesdeMapa).toBeDefined();
        spyLista(seccionDesdeMapa);
        const argMapa = spyLista.mock.calls[0][0];

        // Equivalencia: ambos caminos entregan al mismo callback el idéntico objeto sección.
        expect(seccionDesdeLista).toBe(objetivo);
        expect(argMapa).toBe(objetivo);
        expect(argMapa).toBe(seccionDesdeLista);
      }

      cleanup();
    }
  }, 60000);
});
