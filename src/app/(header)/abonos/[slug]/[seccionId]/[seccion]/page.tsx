export default async function AbonoSeccionAsientoPage({
  params,
}: PageProps<"/abonos/[slug]/[seccionId]/[seccion]">) {
  const { slug, seccionId, seccion } = await params;
  return (
    <div className="p-8">
      /abonos/{slug}/{seccionId}/{seccion} — AbonoSeccionAsientoPage placeholder
    </div>
  );
}
