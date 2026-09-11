import { describe, it, expect } from "vitest";

// Task 4.1 — test de ejemplo: verificar que headers() de next.config.ts declara
// las cuatro cabeceras de seguridad con el source "/:path*" (Req 7.1–7.5).
//
// El default export está envuelto por withBundleAnalyzer, pero el wrapper es
// transparente cuando ANALYZE no está: conserva la función headers() de la config.
import nextConfig, { computeRemoveConsole } from "./next.config";

describe("next.config — cabeceras de seguridad (Req 7)", () => {
  it("aplica las cabeceras a todas las rutas con source '/:path*' (Req 7.1)", async () => {
    expect(typeof nextConfig.headers).toBe("function");

    const reglas = await nextConfig.headers!();

    const seguridad = reglas.find((r) => r.source === "/:path*");
    expect(seguridad).toBeDefined();
  });

  it("cachea inmutable los assets versionados de /_next/static (doc 05)", async () => {
    const reglas = await nextConfig.headers!();
    const estatica = reglas.find((r) => r.source === "/_next/static/:path*");
    expect(estatica).toBeDefined();
    const porClave = Object.fromEntries(
      estatica!.headers.map((h) => [h.key, h.value]),
    );
    expect(porClave["Cache-Control"]).toBe("public, max-age=31536000, immutable");
  });

  it("NO declara la regla de /_next/static en `next dev` (rompe HMR / hidratación)", async () => {
    const previo = process.env.NODE_ENV;
    try {
      // @ts-expect-error NODE_ENV es readonly en los tipos pero asignable en runtime
      process.env.NODE_ENV = "development";
      const reglas = await nextConfig.headers!();
      expect(reglas.find((r) => r.source === "/_next/static/:path*")).toBeUndefined();
      // Las cabeceras de seguridad siguen aplicándose en dev.
      expect(reglas.find((r) => r.source === "/:path*")).toBeDefined();
    } finally {
      // @ts-expect-error idem
      process.env.NODE_ENV = previo;
    }
  });

  it("declara los cuatro pares clave/valor de seguridad (Req 7.2–7.5)", async () => {
    const reglas = await nextConfig.headers!();
    const cabeceras = reglas.find((r) => r.source === "/:path*")!.headers;

    const porClave = Object.fromEntries(
      cabeceras.map((h) => [h.key, h.value]),
    );

    // Req 7.2 — anti-clickjacking (CSP completa fuera de alcance, Req 7.6).
    expect(porClave["Content-Security-Policy"]).toBe("frame-ancestors 'self'");
    // Req 7.3
    expect(porClave["X-Content-Type-Options"]).toBe("nosniff");
    // Req 7.4
    expect(porClave["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    // Req 7.5
    expect(porClave["Permissions-Policy"]).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
    // HSTS: fuerza HTTPS, sin `preload` (irreversible una vez sometido).
    expect(porClave["Strict-Transport-Security"]).toBe(
      "max-age=15552000; includeSubDomains",
    );
    // COOP: aísla la ventana de otras del mismo grupo de navegación.
    expect(porClave["Cross-Origin-Opener-Policy"]).toBe("same-origin");

    // Exactamente seis cabeceras, ninguna directiva CSP adicional (Req 7.6).
    expect(cabeceras).toHaveLength(6);
  });
});

// Task 6.1 — test de ejemplo: verificar que `compiler.removeConsole` es
// `{ exclude: ["error", "warn"] }` en producción y `false` en cualquier otro
// caso (Req 14.1, 14.2). Se comprueba el helper puro `computeRemoveConsole`
// (independiente del NODE_ENV con el que corra el runner) y el `compiler`
// resuelto en la config exportada.
describe("next.config — removeConsole según NODE_ENV (Req 14)", () => {
  it("en producción excluye 'error' y 'warn' (Req 14.1)", () => {
    expect(computeRemoveConsole("production")).toEqual({
      exclude: ["error", "warn"],
    });
  });

  it("fuera de producción devuelve false (Req 14.2)", () => {
    expect(computeRemoveConsole("development")).toBe(false);
    expect(computeRemoveConsole("test")).toBe(false);
    expect(computeRemoveConsole(undefined)).toBe(false);
  });

  it("la config expone compiler.removeConsole derivado de NODE_ENV", () => {
    expect(nextConfig.compiler?.removeConsole).toEqual(
      computeRemoveConsole(process.env.NODE_ENV),
    );
  });
});
