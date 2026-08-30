#!/usr/bin/env node
// `npm run analyze` — build de producción con el treemap del bundle.
// Wrapper sin dependencias (cross-platform: no depende de la sintaxis de env
// de la shell). Pone ANALYZE=true y delega en `next build`; next.config.ts
// activa entonces @next/bundle-analyzer y abre los .html del reporte.

import { spawnSync } from "node:child_process";

const bin = process.platform === "win32" ? "next.cmd" : "next";
const res = spawnSync(bin, ["build"], {
  stdio: "inherit",
  env: { ...process.env, ANALYZE: "true" },
  shell: process.platform === "win32",
});
process.exit(res.status ?? 1);
