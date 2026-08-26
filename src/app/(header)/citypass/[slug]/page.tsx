export default async function CityPassPage({ params }: PageProps<"/citypass/[slug]">) {
  const { slug } = await params;
  return <div className="p-8">/citypass/{slug} — CityPassPage placeholder</div>;
}
