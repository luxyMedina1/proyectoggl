// URL base del backend compuesta EN EL SERVIDOR.
//
// En servidor `fetch` exige una URL absoluta: un fallback relativo `/api/v1`
// produce `TypeError: Failed to parse URL`, que los `try/catch` de los
// consumidores tragan → sitio con marca por defecto y sitemap vacío, "éxito"
// aparente. Por eso aquí se LANZA si falta la variable: un fallo de configuración
// debe ser visible en el arranque/build, no degradarse en silencio.
//
// El fallback relativo `/api/v1` se conserva EXCLUSIVAMENTE en el cliente
// (`api/apiApplication.ts`), donde una ruta relativa sí es válida en el navegador.
export const apiBase = (): string => {
  const url = process.env.NEXT_PUBLIC_URL_BACKEND;
  if (!url) throw new Error("Falta NEXT_PUBLIC_URL_BACKEND");
  return `${url}/api/v1`;
};
