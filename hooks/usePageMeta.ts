import { useEffect } from 'react';
import { applyPageMeta, clearPageMeta, type PageMeta } from '../utils/documentMeta';

// Mantiene <title> + description + Open Graph mientras la pagina esta montada y
// los devuelve a los de la marca al desmontar. Pasar null (o todo vacio) mientras
// se carga la peticion del back: no toca nada hasta que hay datos.
export const usePageMeta = (meta: PageMeta | null) => {
    const { title, description, image, url, type } = meta ?? {};

    useEffect(() => {
        if (!title && !description && !image && !url) return;

        applyPageMeta({ title, description, image, url, type });
        return () => clearPageMeta();
    }, [title, description, image, url, type]);
};
