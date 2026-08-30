import type { NextConfig } from "next";
import path from "path";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  // Fija la raíz aquí: la carpeta padre (GGL) tiene su propio package-lock.json
  // y sin esto Next recalcula/advierte sobre cuál raíz usar en cada arranque.
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: path.join(__dirname),

  // No anunciar la versión de Next en cada respuesta (cabecera `x-powered-by`).
  // Menos bytes por respuesta y menos superficie de fingerprinting.
  poweredByHeader: false,

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
};

// `ANALYZE=true npm run build` abre el treemap del bundle en el navegador.
// Sin la variable, el wrapper es transparente (no toca el build normal).
export default withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" })(
  nextConfig,
);
