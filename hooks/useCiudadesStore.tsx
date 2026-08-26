import apiApplication from '../api/apiApplication';
import type { Ciudad } from '../types/Ciudad';

const extractMessage = (error: unknown, fallback: string): string => {
    const err = error as { response?: { data?: { message?: string | string[] } } };
    const raw = err?.response?.data?.message;
    if (Array.isArray(raw)) return raw.join('\n');
    return raw || fallback;
};

export const useCiudadesStore = () => {
    const getAllCiudades = async (): Promise<Ciudad[]> => {
        try {
            const { data } = await apiApplication.get('/ciudades/get_all_ciudades');
            // El backend puede responder un arreglo directo o { ciudades: [...] }.
            if (Array.isArray(data)) return data;
            if (Array.isArray(data?.ciudades)) return data.ciudades;
            return [];
        } catch (error) {
            throw new Error(extractMessage(error, 'Error al obtener las ciudades'));
        }
    };

    return {
        getAllCiudades,
    };
};
