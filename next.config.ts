import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Fija la raíz aquí: la carpeta padre (GGL) tiene su propio package-lock.json
  // y sin esto Next recalcula/advierte sobre cuál raíz usar en cada arranque.
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
