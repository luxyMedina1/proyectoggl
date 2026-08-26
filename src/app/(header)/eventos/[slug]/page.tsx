export default async function DetalleEventoPage({ params }: PageProps<"/eventos/[slug]">) {
  const { slug } = await params;
  return <div className="p-8">/eventos/{slug} — DetalleEventoPage placeholder</div>;
}
