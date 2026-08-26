import { useEffect, useState } from "react";
import { useLocation } from '@/utils/nextRouterCompat';
import mammoth from "mammoth";
import { useColorConfig } from "../../../context/ColorContext";

function TerminosCondiciones() {
  const { config } = useColorConfig();
  const { pathname } = useLocation();
  const [htmlContent, setHtmlContent] = useState<string>("");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const loadDocx = async () => {
      if (!config?.terminosYCondiciones) return;
      try {
        const response = await fetch(config.terminosYCondiciones);
        const arrayBuffer = await response.arrayBuffer();
        const { value } = await mammoth.convertToHtml({ arrayBuffer });
        setHtmlContent(value);
      } catch (error) {
        console.error("Error cargando el documento .docx:", error);
        setHtmlContent("<p class='text-2xl text-gray-800 font-semibold text-center'>Error al cargar el aviso de privacidad.</p>");
      }
    };
    loadDocx();
  }, [config?.terminosYCondiciones]);

  return (
    <div className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20">
      <div className="p-4 max-w-4xl mx-auto">
        {htmlContent ? (
          <div
            className="prose max-w-none doc-content"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        ) : (
          <div className="p-4 max-w-4xl mx-auto">
            <p className="text-2xl text-gray-800 font-semibold text-center">No hay ningún documento cargado aún.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TerminosCondiciones;
