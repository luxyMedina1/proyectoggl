export default async function HotelesConferencia({ params }: PageProps<"/cosmotech/hoteles/[eventoId]">) {
  const { eventoId } = await params;
  return <div className="p-8">/cosmotech/hoteles/{eventoId} — HotelesConferencia placeholder</div>;
}
