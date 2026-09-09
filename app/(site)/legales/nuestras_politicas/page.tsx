import LegalContent from "../LegalContent";

// Server Component: el .docx de políticas de uso se convierte en servidor
// (mammoth) y su HTML entra en la respuesta inicial. Ver lib/legales/getLegal.ts.
export default function Page() {
  return <LegalContent documento="politicasDeUso" />;
}
