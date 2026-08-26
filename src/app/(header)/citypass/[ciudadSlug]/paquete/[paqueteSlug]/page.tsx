export default async function CityPassPaquetePage({
  params,
}: PageProps<"/citypass/[ciudadSlug]/paquete/[paqueteSlug]">) {
  const { ciudadSlug, paqueteSlug } = await params;
  return (
    <div className="p-8">
      /citypass/{ciudadSlug}/paquete/{paqueteSlug} — CityPassPaquetePage placeholder
    </div>
  );
}
