import { test } from "node:test";
import assert from "node:assert/strict";
import { detectNewItems, applySectionChanges } from "../lib/intraday";
import type { Briefing, BriefingSection, NormalizedFeedItem } from "../lib/types";

function makeBaseGeneral(sections: BriefingSection[]): Briefing {
  return {
    type: "general",
    date: "2026-09-05",
    updatedAt: "2026-09-05T08:00:00.000Z",
    editionId: "initial",
    editionLabel: "Edición inicial",
    editionSequence: 0,
    executiveSummary: [
      { headline: "Resumen", detail: "Detalle", priority: "important", sources: [] },
    ],
    sections,
    newspapers: [],
    recommendedArticles: [],
    comparison: [],
    watchToday: [],
    sources: [
      { outlet: "El País", url: "https://elpais.com/a" },
      { outlet: "El Mundo", url: "https://elmundo.es/b" },
    ],
    isDemo: false,
  };
}

test("detectNewItems: descarta artículos cuya URL ya está entre las fuentes conocidas", () => {
  const previous = makeBaseGeneral([
    {
      key: "B",
      title: "Política nacional",
      items: [
        {
          id: "b-1",
          headline: "Ya cubierto",
          body: "...",
          priority: "important",
          sources: [{ outlet: "El País", url: "https://elpais.com/ya-cubierto" }],
        },
      ],
    },
  ]);

  const fetched: NormalizedFeedItem[] = [
    { outlet: "El País", title: "Ya cubierto", link: "https://elpais.com/ya-cubierto" },
    { outlet: "ABC", title: "Novedad real", link: "https://abc.es/novedad" },
    { outlet: "La Razón", title: "Sin enlace verificable" }, // sin link: nunca se descarta
  ];

  const result = detectNewItems(fetched, previous);

  assert.equal(result.length, 2);
  assert.ok(result.some((r) => r.link === "https://abc.es/novedad"));
  assert.ok(result.some((r) => r.title === "Sin enlace verificable"));
  assert.ok(!result.some((r) => r.link === "https://elpais.com/ya-cubierto"));
});

test("detectNewItems: también mira executiveSummary/watchToday/sources, no solo secciones", () => {
  const previous = makeBaseGeneral([{ key: "B", title: "Política nacional", items: [] }]);
  previous.executiveSummary[0].sources = [
    { outlet: "El País", url: "https://elpais.com/en-resumen" },
  ];

  const fetched: NormalizedFeedItem[] = [
    { outlet: "El País", title: "Ya en el resumen", link: "https://elpais.com/en-resumen" },
  ];

  const result = detectNewItems(fetched, previous);
  assert.equal(result.length, 0);
});

test("applySectionChanges: new_item se añade a la sección indicada con revisionTag 'new'", () => {
  const sections: BriefingSection[] = [
    { key: "B", title: "Política nacional", items: [] },
    { key: "C", title: "Sociedad", items: [] },
  ];

  const { sections: result, newCount, updatedCount } = applySectionChanges(sections, [
    {
      classification: "new_item",
      sectionKey: "C",
      targetItemId: null,
      item: {
        id: "c-nuevo",
        headline: "Noticia nueva",
        body: "Cuerpo",
        priority: "important",
        nature: "fact",
        sources: [],
      },
    },
  ]);

  assert.equal(newCount, 1);
  assert.equal(updatedCount, 0);
  const sectionC = result.find((s) => s.key === "C")!;
  assert.equal(sectionC.items.length, 1);
  assert.equal(sectionC.items[0].revisionTag, "new");
  assert.equal(result.find((s) => s.key === "B")!.items.length, 0);
});

test("applySectionChanges: update_existing reemplaza el item por id con revisionTag 'updated'", () => {
  const sections: BriefingSection[] = [
    {
      key: "B",
      title: "Política nacional",
      items: [
        { id: "b-1", headline: "Titular viejo", body: "Cuerpo viejo", priority: "context", sources: [] },
      ],
    },
  ];

  const { sections: result, newCount, updatedCount } = applySectionChanges(sections, [
    {
      classification: "update_existing",
      sectionKey: "B",
      targetItemId: "b-1",
      item: {
        id: "b-1",
        headline: "Titular actualizado",
        body: "Cuerpo actualizado",
        priority: "attention",
        nature: null,
        sources: [],
      },
    },
  ]);

  assert.equal(newCount, 0);
  assert.equal(updatedCount, 1);
  const item = result.find((s) => s.key === "B")!.items[0];
  assert.equal(item.headline, "Titular actualizado");
  assert.equal(item.priority, "attention");
  assert.equal(item.revisionTag, "updated");
});

test("applySectionChanges: no_change no altera nada", () => {
  const sections: BriefingSection[] = [
    { key: "B", title: "Política nacional", items: [] },
  ];

  const { sections: result, newCount, updatedCount } = applySectionChanges(sections, [
    { classification: "no_change", sectionKey: null, targetItemId: null, item: null },
  ]);

  assert.equal(newCount, 0);
  assert.equal(updatedCount, 0);
  assert.equal(result[0].items.length, 0);
});

test("applySectionChanges: correction reemplaza el item con revisionTag 'correction' (no 'updated')", () => {
  const sections: BriefingSection[] = [
    {
      key: "B",
      title: "Política nacional",
      items: [
        { id: "b-1", headline: "Se anuncia el cierre", body: "...", priority: "important", sources: [] },
      ],
    },
  ];

  const { sections: result, updatedCount, correctionCount } = applySectionChanges(sections, [
    {
      classification: "correction",
      sectionKey: "B",
      targetItemId: "b-1",
      item: {
        id: "b-1",
        headline: "El cierre finalmente NO se produce",
        body: "Información corregida",
        priority: "attention",
        nature: null,
        sources: [],
      },
    },
  ]);

  assert.equal(updatedCount, 0);
  assert.equal(correctionCount, 1);
  assert.equal(result[0].items[0].revisionTag, "correction");
  assert.equal(result[0].items[0].headline, "El cierre finalmente NO se produce");
});

test("applySectionChanges: discarded no altera nada, solo se cuenta", () => {
  const sections: BriefingSection[] = [{ key: "B", title: "Política nacional", items: [] }];

  const { sections: result, discardedCount, newCount } = applySectionChanges(sections, [
    { classification: "discarded", sectionKey: null, targetItemId: null, item: null },
    { classification: "discarded", sectionKey: null, targetItemId: null, item: null },
  ]);

  assert.equal(discardedCount, 2);
  assert.equal(newCount, 0);
  assert.equal(result[0].items.length, 0);
});

test("applySectionChanges: targetItemId inexistente no pierde el contenido (se trata como nuevo)", () => {
  const sections: BriefingSection[] = [
    { key: "B", title: "Política nacional", items: [] },
  ];

  const { sections: result, newCount, updatedCount } = applySectionChanges(sections, [
    {
      classification: "update_existing",
      sectionKey: "B",
      targetItemId: "id-que-no-existe",
      item: {
        id: "b-2",
        headline: "Contenido igualmente redactado",
        body: "...",
        priority: "important",
        nature: null,
        sources: [],
      },
    },
  ]);

  assert.equal(newCount, 1);
  assert.equal(updatedCount, 0);
  assert.equal(result[0].items.length, 1);
  assert.equal(result[0].items[0].revisionTag, "new");
});
