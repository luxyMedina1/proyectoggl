export default async function DetalleConferencia({ params }: PageProps<"/cosmotech/[eventoId]">) {
  const { eventoId } = await params;
  return <div className="p-8">/cosmotech/{eventoId} — DetalleConferencia placeholder</div>;
}
