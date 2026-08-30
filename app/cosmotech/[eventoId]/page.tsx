import type { Metadata } from "next";
import DetalleConferencia from "@/eventos/pages/conferencias/DetalleConferencia";

type Props = { params: Promise<{ eventoId: string }> };

// Se ejecuta en el servidor en cada request: trae los datos de la conferencia
// para que el enlace compartido muestre su nombre, descripcion e imagen reales.
// El componente hijo (DetalleConferencia) sigue siendo "use client" y vuelve a
// pedir los datos para renderizar; aqui solo se resuelven las <meta> del <head>.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventoId } = await params;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_URL_BACKEND}/api/v1/eventos/conferencia/detalle/${eventoId}`,
      {
        headers: { "x-api-key": process.env.NEXT_PUBLIC_API_KEY ?? "" },
        // Cachea la respuesta 5 min para no golpear el backend en cada crawl.
        next: { revalidate: 300 },
        // Si el backend no responde, no demorar el render (cae a las <meta> globales).
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!res.ok) return {};

    const c = await res.json();
    const titulo: string = c?.nombre || "Conferencia";
    const descripcion: string = c?.descripcion || DESCRIPCION_FALLBACK;
    const imagen: string = c?.imagenBanner || c?.imagenLogo || "/event_default.webp";

    return {
      title: titulo,
      description: descripcion,
      openGraph: {
        type: "website",
        siteName: process.env.NEXT_PUBLIC_TITLE_APP || "TaquillaVip",
        locale: "es_MX",
        title: titulo,
        description: descripcion,
        images: [{ url: imagen, alt: titulo }],
      },
      twitter: {
        card: "summary_large_image",
        title: titulo,
        description: descripcion,
        images: [imagen],
      },
    };
  } catch {
    // Si el backend no responde, se usan las <meta> globales del layout.
    return {};
  }
}

const DESCRIPCION_FALLBACK = "Compra boletos para conciertos, deportes y espectaculos.";

export default function Page() {
  return <DetalleConferencia />;
}
