import { describe, it, expect, beforeEach } from "vitest";

// Feature: mejoras-extra-migracion, Property 8: El limitador nunca excede el umbral por IP en la ventana
// Validates: Requirements 8.1, 8.2
//
// Para toda secuencia de peticiones (IP, marca de tiempo), el limitador permite
// a lo sumo `limite` peticiones para una misma IP dentro de cualquier ventana
// deslizante de 60 s, y rechaza las adicionales mientras la ventana siga llena.
//
// fast-check no esta instalado en este proyecto; se usa una tabla dirigida con
// muchas secuencias generadas de forma determinista (>=100 iteraciones) sobre el
// espacio de entrada relevante: varias IPs, marcas de tiempo dentro y fuera de la
// ventana, y rafagas que superan el limite.
import { permitido, limite, ventanaMs, _resetStore } from "./rateLimit";

beforeEach(() => {
  // El store es de modulo; se limpia entre casos para no filtrar estado.
  _resetStore();
});

// PRNG determinista (mulberry32) para generar secuencias reproducibles sin deps.
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Peticion {
  ip: string;
  ahora: number;
}

// Genera una secuencia de peticiones con marcas de tiempo no decrecientes
// (como llegan en la practica) repartidas entre varias IPs.
function genSecuencia(seed: number, n: number): Peticion[] {
  const rng = makeRng(seed);
  const ips = ["1.1.1.1", "2.2.2.2", "3.3.3.3", "desconocida"];
  const peticiones: Peticion[] = [];
  let ahora = 1_000_000; // base arbitraria
  for (let i = 0; i < n; i++) {
    const ip = ips[Math.floor(rng() * ips.length)];
    // Avance temporal: la mayoria de las veces pequeno (rafaga dentro de la
    // ventana), a veces grande (salta fuera de la ventana y la vacia).
    const salto = rng() < 0.2 ? Math.floor(rng() * ventanaMs * 2) : Math.floor(rng() * 500);
    ahora += salto;
    peticiones.push({ ip, ahora });
  }
  return peticiones;
}

// Oraculo independiente: dada una secuencia, verifica que en el instante de cada
// peticion PERMITIDA, el numero de permitidas de esa IP dentro de la ventana que
// termina en ese instante no supera `limite`.
function verificarInvariante(peticiones: Peticion[]): void {
  // Registro de instantes permitidos por IP.
  const permitidasPorIp = new Map<string, number[]>();

  for (const { ip, ahora } of peticiones) {
    const ok = permitido(ip, ahora);
    if (ok) {
      const arr = permitidasPorIp.get(ip) ?? [];
      arr.push(ahora);
      permitidasPorIp.set(ip, arr);
    }
    // Invariante clave: el numero de PERMITIDAS de esta IP dentro de la ventana
    // [ahora - ventanaMs, ahora] nunca supera `limite`.
    const enVentana = (permitidasPorIp.get(ip) ?? []).filter(
      (t) => ahora - t < ventanaMs,
    );
    expect(enVentana.length).toBeLessThanOrEqual(limite);
  }
}

describe("Property 8: el limitador nunca excede el umbral por IP en la ventana", () => {
  it("respeta el limite por IP en la ventana para >=100 secuencias generadas", () => {
    const NUM_SECUENCIAS = 120;
    expect(NUM_SECUENCIAS).toBeGreaterThanOrEqual(100);

    for (let seed = 1; seed <= NUM_SECUENCIAS; seed++) {
      _resetStore();
      const peticiones = genSecuencia(seed, 60);
      verificarInvariante(peticiones);
    }
  });

  it("permite exactamente `limite` peticiones y rechaza las siguientes en la misma ventana", () => {
    const ahora = 5_000;
    for (let i = 0; i < limite; i++) {
      expect(permitido("9.9.9.9", ahora + i)).toBe(true);
    }
    // La (limite + 1)-esima dentro de la ventana se rechaza.
    expect(permitido("9.9.9.9", ahora + limite)).toBe(false);
    expect(permitido("9.9.9.9", ahora + limite + 1)).toBe(false);
  });

  it("vuelve a permitir cuando la ventana se desliza mas alla de las peticiones previas", () => {
    const ahora = 10_000;
    for (let i = 0; i < limite; i++) {
      expect(permitido("8.8.8.8", ahora)).toBe(true);
    }
    expect(permitido("8.8.8.8", ahora)).toBe(false);
    // Al pasar la ventana completa, las previas expiran y se vuelve a permitir.
    expect(permitido("8.8.8.8", ahora + ventanaMs)).toBe(true);
  });

  it("aisla el conteo por IP: una IP saturada no afecta a otra", () => {
    const ahora = 2_000;
    for (let i = 0; i < limite; i++) {
      expect(permitido("a", ahora)).toBe(true);
    }
    expect(permitido("a", ahora)).toBe(false);
    // Otra IP sigue con su cubo intacto.
    expect(permitido("b", ahora)).toBe(true);
  });

  it("los rechazos no consumen cupo: al liberarse la ventana se permite de nuevo", () => {
    const ahora = 3_000;
    for (let i = 0; i < limite; i++) {
      expect(permitido("c", ahora)).toBe(true);
    }
    // Varios rechazos dentro de la ventana.
    for (let i = 0; i < 5; i++) {
      expect(permitido("c", ahora + 1)).toBe(false);
    }
    // Tras deslizar la ventana, se permite exactamente `limite` de nuevo.
    const despues = ahora + ventanaMs;
    for (let i = 0; i < limite; i++) {
      expect(permitido("c", despues)).toBe(true);
    }
    expect(permitido("c", despues)).toBe(false);
  });
});
