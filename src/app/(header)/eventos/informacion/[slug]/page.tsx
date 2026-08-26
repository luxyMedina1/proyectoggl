export default async function InfoEventoPage({ params }: PageProps<"/eventos/informacion/[slug]">) {
  const { slug } = await params;
  return <div className="p-8">/eventos/informacion/{slug} — InfoEventoPage placeholder</div>;
}
