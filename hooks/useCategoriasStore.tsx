import apiApplication from "../api/apiApplication";


export const useCategoriasStore = () => {

    const getListaCategorias = async () => {
        try {
            const { data } = await apiApplication.get('/categorias/get_all');
            return data;
        } catch (error) {
            throw new Error('Error al obtener la lista de categorias');
        }
    }

    return {
        getListaCategorias,
    }
}
