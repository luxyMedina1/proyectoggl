export default async function ProgramaConferencia({ params }: PageProps<"/cosmotech/programa/[eventoId]">) {
  const { eventoId } = await params;
  return <div className="p-8">/cosmotech/programa/{eventoId} — ProgramaConferencia placeholder</div>;
}
