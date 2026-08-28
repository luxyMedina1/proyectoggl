import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

// Comprueba que la cadena jsdom + React 19 + Testing Library quedo bien montada.
function Saludo({ nombre }: { nombre: string }) {
  return <h1>Hola {nombre}</h1>
}

describe('entorno de tests', () => {
  it('renderiza un componente de React', () => {
    render(<Saludo nombre="Taquilla VIP" />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Hola Taquilla VIP' }),
    ).toBeInTheDocument()
  })
})
