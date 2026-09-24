import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

// Automatizacion de pruebas para TODO el proyecto (componentes, hooks, utils, capa api).
// Vitest corre los archivos en paralelo con workers, cachea las transformaciones y solo
// reejecuta lo que cambia en modo watch -> arranca rapido y no se queda trabado.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Cualquier *.test.ts(x) / *.spec.ts(x) en cualquier carpeta del proyecto.
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'node_modules',
      '.next',
      'dist',
      'GGL_taquilla_next/**', // copia antigua del proyecto, no se testea
      'src/**',               // excluida tambien en tsconfig.json
      'e2e/**',
      'taquillavipfrontend-v2/**', // clon local de v2, solo referencia, excluida tambien en tsconfig.json
    ],
    // No procesar Sass/CSS en los tests: no aporta y solo hace lento el arranque.
    css: false,
    // Reporter compacto; usa `--reporter=verbose` cuando quieras el detalle.
    reporters: 'default',
    // Pool 'forks' (el default) lanza un proceso de Node completo por worker -- caro en RAM.
    // Sin tope, Vitest usa un worker por nucleo; en maquinas con poca RAM libre eso hace OOM a
    // mitad de corrida ("Worker exited unexpectedly" / crash nativo), visto en un pre-push
    // real. 'threads' comparte el proceso (mucho mas liviano) y maxWorkers baja el techo de
    // paralelismo; ninguno de los dos le cuesta nada a CI (la suite ya corre en <1 min).
    pool: 'threads',
    maxWorkers: 4,
  },
})
