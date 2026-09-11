import type { NextConfig } from "next";
import path from "path";
import withBundleAnalyzer from "@next/bundle-analyzer";

// Config de `compiler.removeConsole` derivada de `NODE_ENV` (Req 14.1, 14.2).
// En producción se eliminan los `console.*` salvo `error`/`warn` (los de los
// `catch`); fuera de producción `false` para conservar todos los logs en dev/test.
// Helper puro y exportado para poder verificar ambas ramas sin depender del
// `NODE_ENV` con el que corra el runner (tarea 6.1).
export const computeRemoveConsole = (
  nodeEnv: string | undefined,
): { exclude: string[] } | false =>
  nodeEnv === "production" ? { exclude: ["error", "warn"] } : false;

const nextConfig: NextConfig = {
  // React Compiler (Req 11): memoiza componentes automáticamente, reduciendo la
  // necesidad de `useMemo`/`useCallback` manuales. Requiere `babel-plugin-react-compiler`
  // (devDependency, ya instalado en la tarea 9.2). Next aplica el compilador solo a los
  // archivos con JSX/Hooks vía una optimización SWC, así que el coste de build es acotado.
  // BLOQUEADO hasta que los errores TDZ (`react-hooks/immutability`) estuvieran en 0 —
  // condición cumplida en la tarea 9.1. Ver `.../05-config/01-next-config-js/reactCompiler.md`.
  reactCompiler: true,

  // Fija la raíz aquí: la carpeta padre (GGL) tiene su propio package-lock.json
  // y sin esto Next recalcula/advierte sobre cuál raíz usar en cada arranque.
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: path.join(__dirname),

  // No anunciar la versión de Next en cada respuesta (cabecera `x-powered-by`).
  // Menos bytes por respuesta y menos superficie de fingerprinting.
  poweredByHeader: false,

  // Elimina los `console.*` del bundle en producción (Req 14), conservando
  // `console.error`/`console.warn` de los `catch`. Fuera de producción, `false`
  // deja todos los logs (dev/test). Ver `computeRemoveConsole` arriba.
  compiler: {
    removeConsole: computeRemoveConsole(process.env.NODE_ENV),
  },

  images: {
    // Hosts cuyas imágenes puede optimizar next/image. El backend sirve todo
    // desde este bucket de S3 (imágenes de evento, logos de marca, mapas…).
    // Prerrequisito del doc 06: sin esto, el primer <Image> con src remoto
    // hace fallar el build.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "taquilla-v2-files.s3.us-east-1.amazonaws.com",
        pathname: "/**",
      },
    ],
    // AVIF primero (≈30 % más liviano que WebP), WebP de respaldo para
    // navegadores que no lo soporten. El optimizador de Next elige según el
    // header `Accept`. Baja el peso del LCP en las rutas de evento.
    formats: ["image/avif", "image/webp"],
    // Las imágenes de evento (S3) cambian poco y, cuando cambian, se invalidan
    // por el endpoint de revalidación (doc 03). Subir el TTL de 4 h → 31 días
    // evita re-optimizar la misma imagen en cada ciclo de caché.
    minimumCacheTTL: 2678400,
  },

  experimental: {
    // Convierte los imports de barril (`import { X } from "paquete"`) en imports
    // directos al módulo real, para que el bundler solo incluya lo que se usa.
    // `date-fns` y `react-icons/*` ya vienen optimizados por defecto; aquí se
    // añaden los barriles pesados que quedan en el árbol de dependencias.
    optimizePackageImports: [
      "@reduxjs/toolkit",
      "react-redux",
      "react-icons",
      "react-spinners",
      "react-toastify",
    ],
  },

  // Cabeceras de seguridad básicas aplicadas a todas las rutas (Req 7).
  // La CSP completa (`script-src`, `style-src`…) queda fuera de alcance: el sitio
  // carga SDKs de terceros y `sweetalert2`/`next/script` requieren nonces, así que
  // aquí solo se fija `frame-ancestors 'self'` (anti-clickjacking del checkout).
  async headers() {
    const headers = [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // HSTS: fuerza HTTPS en el navegador. Sin `preload` (ese requiere
          // someter el dominio a la lista de precarga de los navegadores, y es
          // efectivamente irreversible) — 6 meses es suficiente para la mayoría
          // de los visitantes recurrentes sin ese compromiso permanente. El
          // navegador ignora esta cabecera si la respuesta no llega por HTTPS,
          // así que no afecta a `next dev` en HTTP plano.
          {
            key: "Strict-Transport-Security",
            value: "max-age=15552000; includeSubDomains",
          },
          // COOP: aísla esta ventana de otras del mismo grupo de navegación
          // (mitiga ataques tipo Spectre entre pestañas). Verificado que no rompe
          // nada: los `window.open(...)` del repo (wallet, compartir, mapas) son
          // de un solo sentido, ninguno depende de `window.opener` de vuelta.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];

    // Assets con hash de contenido en la ruta (`/_next/static/...`): el nombre
    // cambia si cambia el archivo, así que se pueden cachear para siempre. Next
    // ya lo hace en su propio server; se declara explícito para que la regla
    // también aplique detrás de un proxy/CDN que no herede ese default
    // (oportunidad "tiempos de vida de caché eficientes" del doc 05).
    //
    // Salvo en `next dev`: Turbopack sirve los chunks por esta misma ruta con
    // nombres que NO cambian aunque cambie el contenido, así que `immutable` deja
    // al navegador con JS viejo → HMR roto y errores de hidratación. Next lo
    // avisa: "Custom Cache-Control headers ... can break Next.js development".
    if (process.env.NODE_ENV !== "development") {
      headers.push({
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      });
    }

    return headers;
  },
};

// `ANALYZE=true npm run build` abre el treemap del bundle en el navegador.
// Sin la variable, el wrapper es transparente (no toca el build normal).
export default withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" })(
  nextConfig,
);
