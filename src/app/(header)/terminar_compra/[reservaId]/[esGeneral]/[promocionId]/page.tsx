export default async function TerminarCompra({
  params,
}: PageProps<"/terminar_compra/[reservaId]/[esGeneral]/[promocionId]">) {
  const { reservaId, esGeneral, promocionId } = await params;
  return (
    <div className="p-8">
      /terminar_compra/{reservaId}/{esGeneral}/{promocionId} — TerminarCompra placeholder
    </div>
  );
}
