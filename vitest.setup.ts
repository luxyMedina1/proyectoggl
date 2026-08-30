// Se ejecuta una vez antes de cada archivo de test.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Desmonta lo renderizado despues de cada test para que no se filtre estado entre casos.
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// jsdom no implementa matchMedia; varios componentes (swiper, leaflet) lo consultan.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList
}
