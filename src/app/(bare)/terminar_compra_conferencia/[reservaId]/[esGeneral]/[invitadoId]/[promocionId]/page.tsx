export default async function TerminarCompraConferencia({
  params,
}: PageProps<"/terminar_compra_conferencia/[reservaId]/[esGeneral]/[invitadoId]/[promocionId]">) {
  const { reservaId, esGeneral, invitadoId, promocionId } = await params;
  return (
    <div className="p-8">
      /terminar_compra_conferencia/{reservaId}/{esGeneral}/{invitadoId}/{promocionId} —
      TerminarCompraConferencia placeholder
    </div>
  );
}
