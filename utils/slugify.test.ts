import { describe, it, expect } from 'vitest'
import { slugify, deslugify } from './slugify'

describe('slugify', () => {
  it('pasa acentos y espacios a un slug de URL', () => {
    expect(slugify('Ciudad de México')).toBe('ciudad-de-mexico')
  })

  it('colapsa separadores y recorta guiones sobrantes', () => {
    expect(slugify('  Playa   del  Carmen!! ')).toBe('playa-del-carmen')
  })

  // Paridad con el slugify del backend (v2 40b2d79). Junta los ejemplos de los dos ports que se hicieron en paralelo.
  it('transcribe & como "y" para coincidir con el slug del backend', () => {
    expect(slugify('RONDA & JAZZ')).toBe('ronda-y-jazz')
    expect(slugify('Rock & Roll')).toBe('rock-y-roll')
    expect(slugify('Rock&Roll')).toBe('rock-y-roll')
    expect(slugify('Tom&Jerry')).toBe('tom-y-jerry')
  })

  it('deslugify reconstruye un nombre legible', () => {
    expect(deslugify('ciudad-de-mexico')).toBe('Ciudad De Mexico')
  })

  it('deslugify tolera undefined', () => {
    expect(deslugify()).toBe('')
  })
})
