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
    ],
    // No procesar Sass/CSS en los tests: no aporta y solo hace lento el arranque.
    css: false,
    // Reporter compacto; usa `--reporter=verbose` cuando quieras el detalle.
    reporters: 'default',
  },
})
