// Convierte un nombre de ciudad a slug para la URL (ej. "Ciudad de Mexico" -> "ciudad-de-mexico").
export const slugify = (text: string): string =>
    text
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

// Reconstruye un nombre legible a partir de un slug (ej. "ciudad-de-mexico" -> "Ciudad De Mexico").
export const deslugify = (slug: string = ""): string =>
    slug
        .split("-")
        .filter(Boolean)
        .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1))
        .join(" ");
