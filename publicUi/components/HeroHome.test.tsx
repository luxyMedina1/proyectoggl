import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import HeroHome from "./HeroHome";

// El Hero es controlado (el slide visible sale de `activeEvent`), así que se prueba
// dentro de un padre con estado, igual que lo usa EventosView.

const evento = (id: number, nombre: string, recinto: string) => ({
  id,
  nombre,
  imagenBanner: `/banner-${id}.webp`,
  artista: { nombre },
  recinto: { nombre: recinto },
});

const EVENTOS = [
  evento(1, "Tuff Riders", "Arena Durango"),
  evento(2, "Sky Fest", "Parque Reynosa"),
  evento(3, "Ronda y Jazz", "Teatro Victoria"),
  evento(4, "Cuarto evento", "No debe salir"),
];

type Ev = (typeof EVENTOS)[number];

function Hero({ eventos = EVENTOS }: { eventos?: Ev[] }) {
  const [activo, setActivo] = useState<Ev | null>(eventos[0] ?? null);
  return (
    <HeroHome
      eventos={eventos}
      activeEvent={activo}
      onActiveEventChange={setActivo}
      onVerClick={() => {}}
    />
  );
}

const titulo = () => screen.getByRole("heading", { level: 2 }).textContent;
const siguiente = () => fireEvent.click(screen.getByRole("button", { name: "Siguiente evento" }));
const anterior = () => fireEvent.click(screen.getByRole("button", { name: "Evento anterior" }));
const avanzar = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe("HeroHome — flechas y autoplay", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("arranca en el primer evento con su recinto, enlace e imagen", () => {
    render(<Hero />);
    expect(titulo()).toBe("Tuff Riders");
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Arena Durango");
    expect(screen.getByRole("link", { name: "Ver entradas" })).toHaveAttribute(
      "href",
      expect.stringContaining("tuff-riders"),
    );
    expect(screen.getByRole("img")).toHaveAttribute("alt", "Tuff Riders");
  });

  it("la flecha derecha avanza y al final vuelve al primero (solo 3 slides)", () => {
    render(<Hero />);
    siguiente();
    expect(titulo()).toBe("Sky Fest");
    siguiente();
    expect(titulo()).toBe("Ronda y Jazz");
    siguiente();
    expect(titulo()).toBe("Tuff Riders"); // el 4.º evento nunca aparece
  });

  it("la flecha izquierda desde el primero salta al último", () => {
    render(<Hero />);
    anterior();
    expect(titulo()).toBe("Ronda y Jazz");
    anterior();
    expect(titulo()).toBe("Sky Fest");
  });

  it("cambia solo cada 5 s y da la vuelta", () => {
    render(<Hero />);
    avanzar(4999);
    expect(titulo()).toBe("Tuff Riders");
    avanzar(1);
    expect(titulo()).toBe("Sky Fest");
    avanzar(5000);
    expect(titulo()).toBe("Ronda y Jazz");
    avanzar(5000);
    expect(titulo()).toBe("Tuff Riders");
  });

  it("un click en la flecha reinicia la cuenta de 5 s", () => {
    render(<Hero />);
    avanzar(4000);
    siguiente(); // Sky Fest
    avanzar(4000); // 8 s desde el inicio, pero solo 4 desde el click
    expect(titulo()).toBe("Sky Fest");
    avanzar(1000);
    expect(titulo()).toBe("Ronda y Jazz");
  });

  it("con un solo evento no hay flechas ni autoplay", () => {
    render(<Hero eventos={[EVENTOS[0]]} />);
    expect(screen.queryByRole("button", { name: "Siguiente evento" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Evento anterior" })).not.toBeInTheDocument();
    avanzar(20000);
    expect(titulo()).toBe("Tuff Riders");
  });

  it("sin eventos muestra 'Próximamente' y la imagen por defecto", () => {
    render(<Hero eventos={[]} />);
    expect(titulo()).toBe("Próximamente");
    expect(screen.queryByRole("link", { name: "Ver entradas" })).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("alt", "Eventos próximamente");
  });
});
