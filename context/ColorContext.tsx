"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import apiApplication from "../api/apiApplication";
import { setMetaDeSitio } from "../utils/documentMeta";

interface Colors {
    emphasis: string;
    accentBase: string;
    accentLight: string;
    neutral: string;
    darker: string;
}

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
    [key: string]: any;
}

interface ColorConfigContextType {
    colors: Colors;
    config: ConfigResponse | null;
    loading: boolean;
    error: string | null;
    reloadConfig: () => Promise<void>;
}

// Colores por defecto
const DEFAULT_COLORS: Colors = {
    emphasis: "#082348",
    accentBase: "#023E8A",
    accentLight: "#3B82F6",
    neutral: "#f4f4ff",
    darker: "#27272A",
};

// Contexto
const ColorConfigContext = createContext<ColorConfigContextType | undefined>(undefined);

// Provider
export const ColorConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [colors, setColors] = useState<Colors>(DEFAULT_COLORS);
    const [config, setConfig] = useState<ConfigResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (config?.imagenTabNavegador) {
            let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");

            if (!link) {
                link = document.createElement("link");
                link.rel = "icon";
                document.head.appendChild(link);
            }
            link.href = config.imagenTabNavegador;
        }
    }, [config?.imagenTabNavegador]);


    const applyColorsToDocument = (colorsToApply: Colors) => {
        document.documentElement.style.setProperty("--color-emphasis", colorsToApply.emphasis);
        document.documentElement.style.setProperty("--color-accent-base", colorsToApply.accentBase);
        document.documentElement.style.setProperty("--color-accent-light", colorsToApply.accentLight);
        document.documentElement.style.setProperty("--color-neutral", colorsToApply.neutral);
        document.documentElement.style.setProperty("--color-darker", colorsToApply.darker);
    };

    const validateColors = (data: ConfigResponse): Colors => {
        const isValidColor = (color: string | undefined): boolean => !!color && /^#([0-9A-F]{3}){1,2}$/i.test(color);

        return {
            emphasis: isValidColor(data.enfasis) ? data.enfasis! : DEFAULT_COLORS.emphasis,
            accentBase: isValidColor(data.acentoBase) ? data.acentoBase! : DEFAULT_COLORS.accentBase,
            accentLight: isValidColor(data.acentoBajo) ? data.acentoBajo! : DEFAULT_COLORS.accentLight,
            neutral: isValidColor(data.neutro) ? data.neutro! : DEFAULT_COLORS.neutral,
            darker: isValidColor(data.fondo) ? data.fondo! : DEFAULT_COLORS.darker,
        };
    };

    const loadConfig = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await apiApplication.get<ConfigResponse>(`/configuraciones/detail/1`);
            const validatedColors = validateColors(data);
            setColors(validatedColors);
            setConfig(data);
            applyColorsToDocument(validatedColors);
            // El <title> y los og:* base pasan por documentMeta para que no pisen los
            // metadatos de la pagina actual (el detalle de evento los sobreescribe).
            setMetaDeSitio({
                nombreMarca: data.nombreMarca,
                descripcion: data.descripcion || data.descripcionMarca,
                imagen: data.imagenCompartir || data.logo,
            });
        } catch (err) {
            console.error("Error cargando configuración:", err);
            setError("No se pudo cargar la configuración");
            applyColorsToDocument(DEFAULT_COLORS);
            setColors(DEFAULT_COLORS);
            setConfig(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        applyColorsToDocument(DEFAULT_COLORS);
        loadConfig();
    }, []);

    return (
        <ColorConfigContext.Provider
            value={{ colors, config, loading, error, reloadConfig: loadConfig }}
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
