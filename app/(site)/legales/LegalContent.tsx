import { getLegal, type DocumentoLegal } from "@/lib/legales/getLegal";

// Cascarón de servidor compartido por las tres rutas de legales basadas en .docx
// (términos, aviso de privacidad, políticas). Resuelve y sanea el HTML en el
// servidor (ver lib/legales/getLegal.ts) y lo pinta en la respuesta inicial.
//
// El dangerouslySetInnerHTML corre AQUÍ, en el servidor: el HTML ya viene en el
// documento (indexable) y `mammoth` no llega al bundle del navegador. Esto es lo
// que pide el Req 5.3 ("sin usar dangerouslySetInnerHTML en el navegador").
export default async function LegalContent({ documento }: { documento: DocumentoLegal }) {
  const html = await getLegal(documento);

  return (
    <div className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20">
      <div className="p-4 max-w-4xl mx-auto">
        {html ? (
          <div
            className="prose max-w-none doc-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="p-4 max-w-4xl mx-auto">
            <p className="text-2xl text-gray-800 font-semibold text-center">
              No hay ningún documento cargado aún.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
