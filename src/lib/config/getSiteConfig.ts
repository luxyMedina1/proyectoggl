import type { BrandColors, ConfigResponse } from './types';

const DEFAULT_COLORS: BrandColors = {
    emphasis: '#082348',
    accentBase: '#023E8A',
    accentLight: '#3B82F6',
    neutral: '#f4f4ff',
    darker: '#27272A',
};

const isValidColor = (c?: string) => !!c && /^#([0-9A-F]{3}){1,2}$/i.test(c);

const validateColors = (data: ConfigResponse): BrandColors => ({
    emphasis: isValidColor(data.enfasis) ? (data.enfasis as string) : DEFAULT_COLORS.emphasis,
    accentBase: isValidColor(data.acentoBase) ? (data.acentoBase as string) : DEFAULT_COLORS.accentBase,
    accentLight: isValidColor(data.acentoBajo) ? (data.acentoBajo as string) : DEFAULT_COLORS.accentLight,
    neutral: isValidColor(data.neutro) ? (data.neutro as string) : DEFAULT_COLORS.neutral,
    darker: isValidColor(data.fondo) ? (data.fondo as string) : DEFAULT_COLORS.darker,
});

export async function getSiteConfig(): Promise<{ config: ConfigResponse | null; colors: BrandColors }> {
    const base = process.env.NEXT_PUBLIC_URL_BACKEND ?? '';
    const apiKey = process.env.NEXT_PUBLIC_API_KEY ?? '';

    try {
        const res = await fetch(`${base}/api/v1/configuraciones/detail/1`, {
            headers: apiKey ? { 'x-api-key': apiKey } : undefined,
            next: { revalidate: 60 },
        });
        if (!res.ok) throw new Error(`config fetch failed: ${res.status}`);
        const data = (await res.json()) as ConfigResponse;
        return { config: data, colors: validateColors(data) };
    } catch (err) {
        console.error('Error cargando configuracion white-label:', err);
        return { config: null, colors: DEFAULT_COLORS };
    }
}
