export default async function RecintoConferencia({ params }: PageProps<"/cosmotech/recinto/[eventoId]">) {
  const { eventoId } = await params;
  return <div className="p-8">/cosmotech/recinto/{eventoId} — RecintoConferencia placeholder</div>;
}
