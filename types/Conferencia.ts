// Forma del detalle de conferencia que devuelve el backend en
// GET /eventos/conferencia/detalle/:id (y variantes por sección). Tipado a partir de lo
// que leen de verdad las páginas de conferencia; el backend no expone contrato fuerte.
//
// Reemplaza el `interface Conferencia { ...: any[] }` que estaba duplicado byte a byte en
// los cinco hooks `useConferencia*` y en `RegistroConferencia` (frente B2, deuda de lint).

export interface Patrocinador {
  id: number;
  nombre?: string;
  logo?: string;
}

export interface ContactoConferencia {
  id: number;
  nombre?: string;
  puesto?: string;
  correo?: string;
  foto?: string;
}

// Expositor de una sesión. En la UI también se le llama "speaker".
export interface Expositor {
  id: number;
  nombre?: string;
  puesto?: string;
  foto?: string;
  // Orden de aparición en la parrilla de speakers; 0 (o ausente) = sin orden fijado.
  orden: number;
}

export interface RedesSocialesConferencia {
  facebook?: string;
  instagram?: string;
  x?: string;
}

export interface BeneficioConferencia {
  descripcion?: string;
  imagen?: string;
}

export interface SesionConferencia {
  id: number;
  hora: string;
  titulo: string;
  descripcion: string;
  expositores: Expositor[];
}

export interface DiaPrograma {
  fecha: string;
  sesiones: SesionConferencia[];
}

export interface ConferenciaDetalle {
  id: number;
  nombre: string;
  fecha: string;
  descripcion: string;
  ubicacion: string;
  patrocinadores: Patrocinador[];
  contactos: ContactoConferencia[];
  redes_sociales: RedesSocialesConferencia[];
  imagenBanner: string;
  imagenLogo: string;
  programa: DiaPrograma[];
  imagenMapa: string;
  beneficios: BeneficioConferencia[];
}
