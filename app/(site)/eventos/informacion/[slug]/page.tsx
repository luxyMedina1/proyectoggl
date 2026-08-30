import type { Metadata } from "next";
import { buildMetadataEvento } from "@/utils/ogEvento";
import InfoEventoView from "./InfoEventoView";

type Props = { params: Promise<{ slug: string }> };

// Corre en el servidor: resuelve el evento por slug y emite las <meta> (title,
// description, Open Graph, Twitter, canonical) en el HTML para la vista previa al
// compartir. La UI la sigue renderizando InfoEventoView ("use client").
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildMetadataEvento(slug, "informacion");
}

export default function Page() {
  return <InfoEventoView />;
}
