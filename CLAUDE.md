@AGENTS.md

# Mantener el README al día

El `README.md` es la puerta de entrada del repo y tiene datos que se vuelven mentira solos. **Antes de
cerrar cualquier tarea, revisa si lo que cambiaste afecta al README y actualízalo en el mismo commit.**
No es un paso opcional ni "de limpieza para después": un README que miente cuesta más que no tenerlo.

## Qué cambios lo afectan

| Si tocas… | Revisa en el README |
|---|---|
| `package.json` (scripts) | La tabla de **Scripts** |
| `package.json` (versión de Next, React, o una dependencia principal) | La tabla de cabecera y **Última revisión** |
| `.env.example`, o lees una variable de entorno nueva | La tabla de **Variables de entorno** |
| Carpetas nuevas, o mueves features de sitio | El árbol de **Estructura** |
| `api/apiApplication.ts`, `lib/config/`, `app/layout.tsx`, `app/api/revalidate/`, `utils/ogEvento.ts`, `components/AppGate.tsx` | **Piezas que conviene conocer** y el diagrama de **Cómo fluyen los datos** |
| `.github/workflows/`, `.gitlab-ci.yml`, `lighthouserc.json`, `.githooks/` | **Calidad y CI** |
| `next.config.ts` | **Gotchas** (bucket de imágenes permitido, flags de build) |
| Páginas migradas a Server Component, `generateMetadata` nuevo, `<img>` → `next/image` | La tabla de **Estado de la migración** |
| `docs/` (documento nuevo o renombrado) | **Documentación** y el rango de docs citado (hoy 01–10) |
| Deploy, Dockerfile o pipeline de despliegue | El gotcha "**El deploy no está documentado**" — bórralo y documenta lo real |
| Cierras un hallazgo de la auditoría (API key expuesta, sesión en `localStorage`, deuda de lint) | El gotcha correspondiente, y **Estado de la migración** |

## Los números hay que contarlos, no estimarlos

El README cita cifras concretas y dice de dónde salen. Si tu cambio mueve alguna, **vuelve a contarla**
en lugar de ajustarla a ojo:

```bash
find app -name "page.tsx" | wc -l                                    # páginas
grep -l "use client" $(find app -name "page.tsx") | wc -l            # páginas cliente
grep -rn "<img" --include="*.tsx" . --exclude-dir=node_modules --exclude-dir=.next | wc -l
npm run lint 2>&1 | tail -3                                          # deuda de lint
npx vitest run --pool=threads                                        # pruebas
npm run build                                                        # número de rutas
```

Y actualiza la línea de **Última revisión** al final del archivo con la fecha del día.

## Cómo escribirlo

Sigue el tono que ya tiene: español, tablas antes que párrafos, y el *por qué* junto al *qué*. Cuando
algo está roto a propósito (el lint en rojo, la API key pública), dilo y explica por qué está así —
que nadie lo "arregle" sin contexto. Si un dato ya no es verdad y no sabes cuál es el nuevo, bórralo
o márcalo, pero no lo dejes ahí.
