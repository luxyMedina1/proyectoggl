export default async function SpeakersConferencia({ params }: PageProps<"/cosmotech/speakers/[eventoId]">) {
  const { eventoId } = await params;
  return <div className="p-8">/cosmotech/speakers/{eventoId} — SpeakersConferencia placeholder</div>;
}
