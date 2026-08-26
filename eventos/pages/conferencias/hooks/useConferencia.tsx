import { useEffect, useState } from "react";
import { useParams } from '@/utils/nextRouterCompat';
import Swal from "sweetalert2";
import apiApplication from "../../../../api/apiApplication";

interface RouteParams {
  [key: string]: string | undefined;
  eventoId: string;
}

interface Conferencia {
  id: Number;
  nombre: string;
  fecha: string;
  descripcion: string;
  ubicacion: string;
  patrocinadores: any[];
  contactos: any[];
  redes_sociales: any[];
  imagenBanner: string;
  imagenLogo: string;
  programa: Programa[];
  imagenMapa: string;
  beneficios: any[];
}
interface Programa {
  fecha: string;
  sesiones: Sesion[];
}
interface Sesion {
  id: number;
  hora: string;
  titulo: string;
  descripcion: string;
  expositores: any[];
}

export const useConferencia = () => {
  const { eventoId } = useParams<RouteParams>();
  const [conferencia, setConferencia] = useState<Conferencia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventoId) {
      setError("ID de conferencia no encontrado en la ruta.");
      setLoading(false);
      return;
    }

    const getConferenciaDetalle = async () => {
      try {
        const { data } = await apiApplication.get(`/eventos/conferencia/detalle/${eventoId}`);
        setConferencia(data);
        // console.log("🚀 ~ getConferenciaDetalle ~ data:", data)
      } catch (error: any) {
        console.error("Error al obtener los datos:", error);
        let message = "Ha ocurrido un error al obtener los datos.";

        if (error.response && error.response.data) {
          message = error.response.data.message || message;
        }

        setError(message);
        Swal.fire("Error", message, "error");
      } finally {
        setLoading(false);
      }
    };

    getConferenciaDetalle();
  }, [eventoId]);

  return { conferencia, error, loading };
};
