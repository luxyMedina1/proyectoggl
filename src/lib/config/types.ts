export interface ConfigResponse {
    id: number;
    dominio: string;
    nombreMarca: string;
    logo?: string;
    logoMarca?: string;
    logoSmall?: string;
    imagenTabNavegador?: string;
    imagenCompartir?: string;
    descripcion?: string;
    descripcionMarca?: string;
    enfasis?: string;
    acentoBase?: string;
    acentoBajo?: string;
    neutro?: string;
    fondo?: string;
    habilitarConferencias?: boolean;
    mostrarOjo?: boolean;
    botonTexto?: string;
    botonIcono?: string;
    urlFacebook?: string;
    urlInstagram?: string;
    urlTwitter?: string;
    direccionContacto?: string;
    emailContacto?: string;
    telefonoContacto?: string;
    mensajeFooter?: string;
    terminosYCondiciones?: string;
    avisoPrivacidad?: string;
    politicasDeUso?: string;
    [key: string]: unknown;
}

export interface BrandColors {
    emphasis: string;
    accentBase: string;
    accentLight: string;
    neutral: string;
    darker: string;
}
