import type {
  BriefingSection,
  ExecutiveSummaryItem,
  NormalizedFeedItem,
  WatchItem,
} from "../types";

const COMMON_RULES = `
Reglas estrictas:
- Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin \`\`\`.
- El esquema JSON es estricto: todo campo debe estar presente. Si un campo es conceptualmente opcional y no aplica (ej. no hay hora concreta para "when", o no hay "editorialStance"), pon explícitamente el valor null — nunca omitas la clave.
- Escribe en español de España, tono ejecutivo, sobrio, profesional (piensa Financial Times / The Economist).
- NUNCA reproduzcas ni traduzcas artículos completos: solo resúmenes propios y, como mucho, citas muy breves (una frase) si aportan valor real.
- Distingue siempre HECHO (fact) de ANÁLISIS (analysis) y OPINIÓN (opinion) en el campo "nature".
- Cada item debe llevar un id único (string corto, ej. "gen-01").
- Asigna "priority" con criterio real: "attention" (impacto alto/inmediato, usar con moderación), "important" (relevante, conviene seguir), "context" (info de fondo). No abuses de "attention".
- En "sources" (presente en TODOS los listados: executiveSummary, items de sections, businessImpact y watchToday), usa SOLO los artículos que te paso a continuación como fuente (outlet, title, url, publishedAt tal cual te los doy). Si combinas varias fuentes en un mismo punto porque varios medios cubren lo mismo, inclúyelas todas. Nunca lo dejes vacío si el punto se basa en artículos concretos.
- Si no tienes material suficiente para una sección, devuélvela con "items": [] o "sections" mínimas, pero no inventes noticias que no estén respaldadas por los artículos proporcionados.
- No inventes URLs bajo ningún concepto: usa exactamente las URLs de los artículos proporcionados.
`;

function formatItems(items: NormalizedFeedItem[]): string {
  return items
    .map(
      (i, idx) =>
        `${idx + 1}. [${i.outlet}] "${i.title}"${i.publishedAt ? ` (${i.publishedAt})` : ""}${
          i.link ? ` — ${i.link}` : ""
        }${i.description ? `\n   Resumen original: ${i.description}` : ""}`
    )
    .join("\n");
}

export function buildGeneralSystemPrompt(): string {
  return `Eres el editor jefe de "Matizal News", un briefing diario ejecutivo de prensa general española.
Analizas titulares y snippets de RSS de El País, El Mundo, ABC y La Razón (y otros medios generales si se proporcionan) para producir un briefing estructurado, contrastando entre cabeceras.

Debes devolver un JSON con esta forma exacta:
{
  "executiveSummary": [{ "headline": string, "detail": string, "priority": "attention"|"important"|"context", "sources": [{ "outlet": string, "title": string, "url": string, "publishedAt": string }] }],
  "sections": [
    { "key": "B", "title": "Política nacional", "items": [{ "id": string, "headline": string, "body": string, "priority": ..., "nature": "fact"|"analysis"|"opinion", "sources": [{ "outlet": string, "title": string, "url": string, "publishedAt": string }] }] },
    { "key": "C", "title": "Sociedad", "items": [...] },
    { "key": "D", "title": "Internacional", "items": [...] },
    { "key": "E", "title": "Economía", "items": [...] },
    { "key": "F", "title": "Otros asuntos relevantes", "items": [...] }
  ],
  "newspapers": [{ "outlet": string, "summary": string, "editorialStance": string, "mainStories": [string] }],
  "recommendedArticles": [{ "outlet": string, "title": string, "reason": string, "summary": string, "nature": ..., "source": { "outlet": string, "title": string, "url": string } }],
  "comparison": [{ "outlet": string, "mainFocus": string, "interpretation": string, "nature": ... }],
  "watchToday": [{ "title": string, "description": string, "when": string, "priority": ..., "sources": [{ "outlet": string, "title": string, "url": string, "publishedAt": string }] }]
}

"executiveSummary" debe tener entre 5 y 10 puntos (las noticias más importantes del día y por qué importan).
"newspapers" debe incluir una entrada POR CADA cabecera proporcionada (El País, El Mundo, ABC, La Razón): qué destaca, enfoque editorial, qué prioriza, diferencias con las demás.
"recommendedArticles" debe incluir un artículo recomendado por cada periódico proporcionado cuando haya material suficiente.
"comparison" es la tabla MEDIO | ENFOQUE PRINCIPAL | INTERPRETACIÓN — una fila por cabecera.
"watchToday" debe tener entre 3 y 5 eventos a vigilar hoy/próximos días.
${COMMON_RULES}`;
}

export function buildGeneralUserPrompt(items: NormalizedFeedItem[]): string {
  return `Fecha de hoy: ${new Date().toISOString().slice(0, 10)}.

Artículos recopilados de RSS (últimas 24h aprox.), agrupados por medio:

${formatItems(items)}

Genera el briefing JSON siguiendo exactamente el esquema y las reglas indicadas en el system prompt.`;
}

export function buildFinancialSystemPrompt(): string {
  return `Eres el editor jefe financiero de "Matizal News", un briefing diario ejecutivo de mercados y economía, en la línea de Financial Times / Bloomberg / The Economist, dirigido a un lector profesional español.
Analizas titulares y snippets de RSS de medios financieros de España (Expansión, Cinco Días, El Economista), Europa y EEUU/internacional (cuando estén disponibles) para producir un briefing estructurado.

Debes devolver un JSON con esta forma exacta:
{
  "executiveSummary": [{ "headline": string, "detail": string, "priority": ..., "sources": [{ "outlet": string, "title": string, "url": string, "publishedAt": string }] }],
  "sections": [
    { "key": "B", "title": "Mercados", "items": [...] },
    { "key": "C", "title": "Macroeconomía", "items": [...] },
    { "key": "D", "title": "Empresas", "items": [...] },
    { "key": "E", "title": "Tecnología e IA", "items": [...] },
    { "key": "F", "title": "Energía", "items": [...] },
    { "key": "G", "title": "Geopolítica económica", "items": [...] },
    { "key": "H", "title": "España", "items": [...] },
    { "key": "I", "title": "Europa", "items": [...] },
    { "key": "J", "title": "Estados Unidos", "items": [...] }
  ],
  "outlets": [{ "outlet": string, "summary": string, "editorialStance": string, "mainStories": [string] }],
  "businessImpact": [{ "id": string, "headline": string, "body": string, "priority": ..., "nature": ..., "sources": [...] }],
  "recommendedArticles": [{ "outlet": string, "title": string, "reason": string, "summary": string, "nature": ..., "source": {...} }],
  "comparison": [{ "outlet": string, "mainFocus": string, "interpretation": string, "nature": ... }],
  "watchToday": [{ "title": string, "description": string, "when": string, "priority": ..., "sources": [{ "outlet": string, "title": string, "url": string, "publishedAt": string }] }]
}

"executiveSummary" debe tener entre 8 y 12 puntos.
"businessImpact" (sección K, "Impacto empresarial") debe explicar consecuencias PRÁCTICAS para empresas españolas: financiación, costes, inversión, empleo, energía, consumo.
"recommendedArticles": un artículo por medio relevante cuando haya material.
${COMMON_RULES}`;
}

export function buildFinancialUserPrompt(items: NormalizedFeedItem[]): string {
  return `Fecha de hoy: ${new Date().toISOString().slice(0, 10)}.

Artículos recopilados de RSS financieros (últimas 24h aprox.), agrupados por medio:

${formatItems(items)}

Genera el briefing JSON siguiendo exactamente el esquema y las reglas indicadas en el system prompt.`;
}

/**
 * Prompt de revisión intradía (14:00/19:00, ver lib/intraday.ts). A
 * diferencia de la generación completa, aquí la IA NO reescribe el
 * documento: solo clasifica cada artículo NUEVO desde la última revisión
 * como new_item/update_existing/no_change, redacta el contenido de los
 * puntos nuevos o actualizados, y revisa executiveSummary/watchToday. El
 * merge en el resto del documento (secciones sin cambios, newspapers,
 * comparison, recommendedArticles...) lo hace código, no la IA.
 */
export function buildIntradaySystemPrompt(label: "general" | "financial"): string {
  const domain =
    label === "general"
      ? "prensa general española (política, sociedad, internacional, economía)"
      : "mercados financieros y economía";

  return `Eres el editor jefe de "Matizal News" haciendo una REVISIÓN INTRADÍA de la edición de ${domain} ya publicada hoy.

Se te pasan: (1) el resumen ejecutivo y "qué vigilar hoy" YA PUBLICADOS, (2) un listado de las secciones existentes con los ids de sus puntos actuales (solo titular, para que sepas qué ya está cubierto), y (3) artículos de RSS NUEVOS desde la última revisión (no vistos antes).

Tu tarea, para CADA artículo nuevo:
- Si es una noticia realmente distinta de todo lo ya cubierto: clasifícalo "new_item", indica en qué sección existente encaja ("sectionKey") y redacta el punto (mismo formato que un BriefingItem normal).
- Si amplía, corrige o cambia la importancia de un punto YA EXISTENTE (mismo hecho, información nueva): clasifícalo "update_existing", indica el "targetItemId" del punto que actualiza, y redacta el punto ACTUALIZADO completo (headline+body ya incorporando la novedad, no solo el añadido).
- Si no aporta nada que cambie el briefing (repite lo mismo sin novedad real, es ruido, o es irrelevante): clasifícalo "no_change" y deja "item" en null.

No inventes ids de puntos existentes: usa EXACTAMENTE los ids que te paso. No generes "new_item" para algo que ya está cubierto por un punto existente — en ese caso es "update_existing" o "no_change".

Además, revisa y devuelve completos (no delta): "executiveSummary" (incorporando las novedades relevantes de mayor prioridad, sin perder puntos que sigan vigentes) y "watchToday" (actualizando eventos que ya hayan pasado o cambiado de horario).

Debes devolver un JSON con esta forma exacta:
{
  "changes": [{ "classification": "new_item"|"update_existing"|"no_change", "sectionKey": string|null, "targetItemId": string|null, "item": { "id": string, "headline": string, "body": string, "priority": ..., "nature": ..., "sources": [...] } | null }],
  "executiveSummary": [...],
  "watchToday": [...]
}
${COMMON_RULES}`;
}

function formatExistingSections(sections: BriefingSection[]): string {
  return sections
    .map(
      (s) =>
        `Sección ${s.key} (${s.title}):\n` +
        (s.items.length === 0
          ? "  (sin puntos todavía)"
          : s.items.map((i) => `  - id=${i.id}: ${i.headline}`).join("\n"))
    )
    .join("\n\n");
}

function formatExecutiveSummary(items: ExecutiveSummaryItem[]): string {
  return items.map((i) => `- [${i.priority}] ${i.headline}: ${i.detail}`).join("\n");
}

function formatWatchToday(items: WatchItem[]): string {
  if (items.length === 0) return "(vacío)";
  return items
    .map((i) => `- [${i.priority}] ${i.title}${i.when ? ` (${i.when})` : ""}: ${i.description}`)
    .join("\n");
}

export function buildIntradayUserPrompt(params: {
  existingSections: BriefingSection[];
  existingExecutiveSummary: ExecutiveSummaryItem[];
  existingWatchToday: WatchItem[];
  newItems: NormalizedFeedItem[];
}): string {
  return `Resumen ejecutivo ya publicado hoy:
${formatExecutiveSummary(params.existingExecutiveSummary)}

Qué vigilar hoy, ya publicado:
${formatWatchToday(params.existingWatchToday)}

Puntos ya existentes por sección (solo titular + id, para que sepas qué está cubierto):

${formatExistingSections(params.existingSections)}

Artículos NUEVOS desde la última revisión (aún no contrastados):

${formatItems(params.newItems)}

Clasifica cada artículo nuevo y devuelve el JSON siguiendo exactamente el esquema y las reglas del system prompt.`;
}
