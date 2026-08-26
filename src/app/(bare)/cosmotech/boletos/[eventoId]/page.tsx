export default async function FormConferenciaPage({ params }: PageProps<"/cosmotech/boletos/[eventoId]">) {
  const { eventoId } = await params;
  return <div className="p-8">/cosmotech/boletos/{eventoId} — FormConferenciaPage placeholder</div>;
}
