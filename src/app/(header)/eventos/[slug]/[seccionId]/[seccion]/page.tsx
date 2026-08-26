export default async function SeleccionAsientosPage({
  params,
}: PageProps<"/eventos/[slug]/[seccionId]/[seccion]">) {
  const { slug, seccionId, seccion } = await params;
  return (
    <div className="p-8">
      /eventos/{slug}/{seccionId}/{seccion} — SeleccionAsientosPage placeholder
    </div>
  );
}
