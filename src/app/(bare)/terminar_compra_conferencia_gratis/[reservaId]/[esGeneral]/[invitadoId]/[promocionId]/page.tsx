export default async function TerminarCompraConferenciaGratis({
  params,
}: PageProps<"/terminar_compra_conferencia_gratis/[reservaId]/[esGeneral]/[invitadoId]/[promocionId]">) {
  const { reservaId, esGeneral, invitadoId, promocionId } = await params;
  return (
    <div className="p-8">
      /terminar_compra_conferencia_gratis/{reservaId}/{esGeneral}/{invitadoId}/{promocionId} —
      TerminarCompraConferenciaGratis placeholder
    </div>
  );
}
