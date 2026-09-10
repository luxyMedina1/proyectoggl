import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Swal from "sweetalert2";
import apiApplication from "../../../../api/apiApplication";
import type { ConferenciaDetalle } from "../../../../types/Conferencia";

export const useConferencia = () => {
  const { eventoId } = useParams<{ eventoId: string }>();
  const [conferencia, setConferencia] = useState<ConferenciaDetalle | null>(null);
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
        const { data } = await apiApplication.get(`/eventos/conferencia/recinto/${eventoId}`);
        setConferencia(data);
        // console.log("🚀 ~ getConferenciaDetalle ~ data:", data)
      } catch (error) {
        console.error("Error al obtener los datos:", error);
        let message = "Ha ocurrido un error al obtener los datos.";

        const backendMessage = (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message;
        if (backendMessage) {
          message = backendMessage;
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
