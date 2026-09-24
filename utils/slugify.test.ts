import { describe, it, expect } from 'vitest'
import { slugify, deslugify } from './slugify'

describe('slugify', () => {
  it('pasa acentos y espacios a un slug de URL', () => {
    expect(slugify('Ciudad de México')).toBe('ciudad-de-mexico')
  })

  it('colapsa separadores y recorta guiones sobrantes', () => {
    expect(slugify('  Playa   del  Carmen!! ')).toBe('playa-del-carmen')
  })

  it('transcribe & como "y", igual que el backend (v2 40b2d79)', () => {
    expect(slugify('RONDA & JAZZ')).toBe('ronda-y-jazz')
    expect(slugify('Rock&Roll')).toBe('rock-y-roll')
  })

  it('deslugify reconstruye un nombre legible', () => {
    expect(deslugify('ciudad-de-mexico')).toBe('Ciudad De Mexico')
  })

  it('deslugify tolera undefined', () => {
    expect(deslugify()).toBe('')
  })
})
