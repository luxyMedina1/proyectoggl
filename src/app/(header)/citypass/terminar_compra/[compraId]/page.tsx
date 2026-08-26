export default async function CityPassTerminarCompra({
  params,
}: PageProps<"/citypass/terminar_compra/[compraId]">) {
  const { compraId } = await params;
  return <div className="p-8">/citypass/terminar_compra/{compraId} — CityPassTerminarCompra placeholder</div>;
}
