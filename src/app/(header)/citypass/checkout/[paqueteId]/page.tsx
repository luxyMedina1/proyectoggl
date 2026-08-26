export default async function CityPassCheckoutPage({ params }: PageProps<"/citypass/checkout/[paqueteId]">) {
  const { paqueteId } = await params;
  return <div className="p-8">/citypass/checkout/{paqueteId} — CityPassCheckoutPage placeholder</div>;
}
