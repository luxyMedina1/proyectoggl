#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Auditoría de imágenes — apoyo al doc 06 y a la emergencia de CLS del reporte.
//
// Recorre el código fuente y marca cada `<img>` que NO declara `width` y
// `height` a la vez. Esos son los que reservan 0 px hasta que la imagen carga y
// luego empujan el layout: son la causa principal del CLS 0.65–0.73 medido.
//
// Uso:
//   node scripts/audit-images.mjs            (informe, siempre sale con código 0)
//   node scripts/audit-images.mjs --strict   (sale con código 1 si hay pendientes)
//   node scripts/audit-images.mjs --json      (salida JSON para dashboards/CI)
//
// Sin dependencias: solo `node:fs` / `node:path`. Corre en Node 18+.
// -----------------------------------------------------------------------------

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const STRICT = process.argv.includes("--strict");
const AS_JSON = process.argv.includes("--json");

const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "out",
  "coverage",
  "GGL_taquilla_next",
  "src",
]);
const EXT = /\.(tsx|jsx)$/;

/** @type {string[]} */
const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!IGNORED_DIRS.has(entry)) walk(full);
    } else if (EXT.test(entry)) {
      files.push(full);
    }
  }
})(ROOT);

// Cada apertura de etiqueta <img ... > (puede ocupar varias líneas).
const IMG_TAG = /<img\b[^>]*?>/gis;
const HAS_WIDTH = /\bwidth[=\s]/i;
const HAS_HEIGHT = /\bheight[=\s]/i;
const HAS_FILL = /\bfill\b/i; // <Image fill> tiene su propia estrategia; no aplica a <img>
// `aspect-[16/9]`, `aspect-square`, `aspect-video` reservan la caja → no hay CLS.
const HAS_ASPECT = /\baspect-(\[|square|video)/;
// Un par de utilidades Tailwind con tamaño fijo (`h-24 w-32`) también reserva la
// caja. `h-full` / `w-full` / `h-screen` / `h-auto` NO: dependen del contenedor.
const FIXED_H = /\bh-(?!full|screen|auto|px\b)[\w./[\]-]+/;
const FIXED_W = /\bw-(?!full|screen|auto|px\b)[\w./[\]-]+/;
const isSized = (tag) => {
  if (HAS_WIDTH.test(tag) && HAS_HEIGHT.test(tag)) return true;
  if (HAS_FILL.test(tag)) return true;
  // Se prueban las utilidades Tailwind contra la etiqueta completa: cubre tanto
  // `className="..."` como `className={`...`}` (literal de plantilla).
  if (HAS_ASPECT.test(tag)) return true;
  if (FIXED_H.test(tag) && FIXED_W.test(tag)) return true;
  return false;
};

/** @type {{file:string, line:number, snippet:string}[]} */
const offenders = [];
let totalImg = 0;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(IMG_TAG)) {
    totalImg++;
    const tag = match[0];
    if (isSized(tag)) continue;
    const line = text.slice(0, match.index).split("\n").length;
    offenders.push({
      file: relative(ROOT, file).split(sep).join("/"),
      line,
      snippet: tag.replace(/\s+/g, " ").slice(0, 100),
    });
  }
}

if (AS_JSON) {
  console.log(
    JSON.stringify(
      { totalImg, unsized: offenders.length, offenders },
      null,
      2,
    ),
  );
} else {
  const byFile = new Map();
  for (const o of offenders) {
    if (!byFile.has(o.file)) byFile.set(o.file, []);
    byFile.get(o.file).push(o);
  }
  console.log("\n  Auditoría de <img> sin dimensiones (CLS / doc 06)\n");
  if (offenders.length === 0) {
    console.log("  ✅ Todos los <img> declaran width + height (o son <Image fill>).\n");
  } else {
    for (const [file, list] of [...byFile.entries()].sort()) {
      console.log(`  ${file}  (${list.length})`);
      for (const o of list) console.log(`     L${o.line}  ${o.snippet}`);
      console.log("");
    }
    console.log(
      `  ${offenders.length} de ${totalImg} <img> sin dimensiones en ${byFile.size} archivos.`,
    );
    console.log(
      "  Cada uno es CLS potencial. Prioridad del doc 06: LCP eventos/[slug] → tarjetas → layout → resto.\n",
    );
  }
}

if (STRICT && offenders.length > 0) process.exit(1);
