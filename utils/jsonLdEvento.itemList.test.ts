import { describe, it, expect } from "vitest";
import {
  construirItemListEventosJsonLd,
  type EventoParaItemList,
} from "@/utils/jsonLdEvento";
import { rutaEvento } from "@/utils/eventoSlug";

// Cobertura del helper del ItemList de la home (doc 05).
//
// Property: para toda lista de eventos, construirItemListEventosJsonLd produce un
// objeto ItemList de schema.org con un ListItem por evento, en el mismo orden,
// con `position` 1-indexada, `url` absoluta construida con el mismo `rutaEvento`
// del resto del sitio y `name` igual al nombre del evento.

const SITE_URL = "https://taquillavip.com";

const EVENTOS: EventoParaItemList[] = [
  { id: 10, nombre: "Concierto de Rock" },
  { id: 22, slug: "festival-jazz", nombre: "Festival de Jazz" },
  { id: 7, nombre: "Obra de Teatro", artista: { nombre: "Compañía X" } },
  { id: 99, nombre: null }, // sin nombre: cae al id en la URL, name omitido
];

describe("construirItemListEventosJsonLd", () => {
  it("emite un ItemList de schema.org", () => {
    const jsonLd = construirItemListEventosJsonLd(EVENTOS, SITE_URL);
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("ItemList");
  });

  it("un ListItem por evento, en orden, con position 1-indexada y url absoluta", () => {
    const jsonLd = construirItemListEventosJsonLd(EVENTOS, SITE_URL);
    const items = jsonLd.itemListElement as Array<Record<string, unknown>>;

    expect(items).toHaveLength(EVENTOS.length);
    items.forEach((item, i) => {
      expect(item["@type"]).toBe("ListItem");
      expect(item.position).toBe(i + 1);
      expect(item.url).toBe(`${SITE_URL}${rutaEvento(EVENTOS[i])}`);
      expect(item.name).toBe(EVENTOS[i].nombre ?? undefined);
    });
  });

  it("lista vacía o nula => ItemList con itemListElement vacío", () => {
    for (const entrada of [[], undefined as unknown as EventoParaItemList[]]) {
      const jsonLd = construirItemListEventosJsonLd(entrada, SITE_URL);
      expect(jsonLd["@type"]).toBe("ItemList");
      expect(jsonLd.itemListElement).toEqual([]);
    }
  });

  it("es serializable con JSON.stringify sin lanzar (se emite en un <script ld+json>)", () => {
    const jsonLd = construirItemListEventosJsonLd(EVENTOS, SITE_URL);
    expect(() => JSON.stringify(jsonLd)).not.toThrow();
    // `name: undefined` se omite al serializar.
    const round = JSON.parse(JSON.stringify(jsonLd));
    expect(round.itemListElement[3]).not.toHaveProperty("name");
  });
});
