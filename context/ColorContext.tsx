"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import apiApplication from "../api/apiApplication";
import { activarPixelsGlobales } from "../utils/metaPixel";
import type { BrandColors } from "@/lib/config/getSiteConfig";
import { DEFAULT_COLORS } from "@/lib/config/getSiteConfig";

type Colors = BrandColors;

export interface ConfigResponse {
    id: number;
    dominio: string;
    logo: string;
    nombreMarca: string;
    enfasis?: string;
    acentoBase?: string;
    acentoBajo?: string;
    neutro?: string;
    fondo?: string;
    habilitarConferencias: boolean;
    // Pixels de Meta de la marca. Son los que aplican en todo el sitio; cada evento puede
    // ademas traer los suyos propios (evento.metaPixels) que se activan solo en su detalle.
    metaPixels?: string[];
    [key: string]: any;
}

interface ColorConfigContextType {
    colors: Colors;
    config: ConfigResponse | null;
    loading: boolean;
    error: string | null;
    reloadConfig: () => Promise<void>;
}

// Contexto
const ColorConfigContext = createContext<ColorConfigContextType | undefined>(undefined);

// Provider
//
// La config de marca la trae ahora el servidor (lib/config/getSiteConfig.ts) y
// entra como props iniciales: el logo, los colores y el titulo estan en el HTML
// inicial, sin salto ni fetch del navegador. El <title> y los og:* los pone
// generateMetadata del layout raiz, asi que este provider ya NO toca <head>.
export const ColorConfigProvider: React.FC<{
    children: ReactNode;
    configInicial?: ConfigResponse | null;
    coloresIniciales?: Colors;
}> = ({ children, configInicial = null, coloresIniciales }) => {
    const [colors, setColors] = useState<Colors>(coloresIniciales ?? DEFAULT_COLORS);
    const [config, setConfig] = useState<ConfigResponse | null>(configInicial);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Los pixels de Meta se activan en el navegador (inyectan el script). Se hace
    // una vez al montar con la config que ya vino del servidor.
    useEffect(() => {
        activarPixelsGlobales(configInicial?.metaPixels);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const applyColorsToDocument = (colorsToApply: Colors) => {
        document.documentElement.style.setProperty("--color-emphasis", colorsToApply.emphasis);
        document.documentElement.style.setProperty("--color-accent-base", colorsToApply.accentBase);
        document.documentElement.style.setProperty("--color-accent-light", colorsToApply.accentLight);
        document.documentElement.style.setProperty("--color-neutral", colorsToApply.neutral);
        document.documentElement.style.setProperty("--color-darker", colorsToApply.darker);
    };

    const validateColors = (data: ConfigResponse): Colors => {
        const isValidColor = (color: string | undefined): boolean =>
            !!color && /^#([0-9A-F]{3}){1,2}$/i.test(color);

        return {
            emphasis: isValidColor(data.enfasis) ? data.enfasis! : DEFAULT_COLORS.emphasis,
            accentBase: isValidColor(data.acentoBase) ? data.acentoBase! : DEFAULT_COLORS.accentBase,
            accentLight: isValidColor(data.acentoBajo) ? data.acentoBajo! : DEFAULT_COLORS.accentLight,
            neutral: isValidColor(data.neutro) ? data.neutro! : DEFAULT_COLORS.neutral,
            darker: isValidColor(data.fondo) ? data.fondo! : DEFAULT_COLORS.darker,
        };
    };

    // Recarga en runtime (p. ej. tras editar la marca en el dashboard sin recargar).
    // El primer render ya viene servido; esto es el camino de refresco, no el inicial.
    const reloadConfig = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await apiApplication.get<ConfigResponse>(`/configuraciones/detail/1`);
            const validatedColors = validateColors(data);
            setColors(validatedColors);
            setConfig(data);
            applyColorsToDocument(validatedColors);
            activarPixelsGlobales(data.metaPixels);
        } catch (err) {
            console.error("Error recargando configuración:", err);
            setError("No se pudo recargar la configuración");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ColorConfigContext.Provider
            value={{ colors, config, loading, error, reloadConfig }}
        >
            {children}
        </ColorConfigContext.Provider>
    );
};

// Hook para consumirlo
export const useColorConfig = (): ColorConfigContextType => {
    const context = useContext(ColorConfigContext);
    if (!context) {
        throw new Error("useColorConfig debe usarse dentro de un ColorConfigProvider");
    }
    return context;
};
