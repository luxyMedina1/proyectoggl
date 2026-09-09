import LegalContent from "../LegalContent";

// Server Component: el .docx del aviso de privacidad se convierte en servidor
// (mammoth) y su HTML entra en la respuesta inicial. Ver lib/legales/getLegal.ts.
export default function Page() {
  return <LegalContent documento="avisoPrivacidad" />;
}
