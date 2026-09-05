/**
 * Encabezado de sección numerado ("01 Resumen ejecutivo", "02 Mercados"...).
 * El número es el ORDEN real de aparición en el documento, no una letra fija
 * — evita el bug de numeración con huecos/duplicados que tenía el símbolo
 * "§" con letras (A, G, H, K, O...) cuando las secciones no letradas se
 * intercalaban con las generadas dinámicamente por IA.
 */
export function SectionHeading({
  order,
  title,
}: {
  order: number;
  title: string;
}) {
  return (
    <div className="flex items-baseline gap-3 mb-6">
      <span className="section-mark text-2xl">{String(order).padStart(2, "0")}</span>
      <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
        {title}
      </h2>
    </div>
  );
}
