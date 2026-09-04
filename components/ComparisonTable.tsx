import type { EditorialComparisonRow } from "@/lib/types";

const NATURE_LABEL: Record<string, string> = {
  fact: "Hecho",
  analysis: "Análisis",
  opinion: "Opinión",
};

export function ComparisonTable({ rows }: { rows: EditorialComparisonRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="table-scroll border border-(--border)">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-(--border-strong)">
            <th className="text-left font-mono text-[11px] uppercase tracking-wider font-medium px-4 py-3 whitespace-nowrap">
              Medio
            </th>
            <th className="text-left font-mono text-[11px] uppercase tracking-wider font-medium px-4 py-3">
              Enfoque principal
            </th>
            <th className="text-left font-mono text-[11px] uppercase tracking-wider font-medium px-4 py-3">
              Interpretación
            </th>
            <th className="text-left font-mono text-[11px] uppercase tracking-wider font-medium px-4 py-3 whitespace-nowrap">
              Naturaleza
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={`${row.outlet}-${idx}`}
              className="border-b border-(--border) last:border-b-0"
            >
              <td className="px-4 py-3 font-medium whitespace-nowrap">{row.outlet}</td>
              <td className="px-4 py-3 text-(--ink-2)">{row.mainFocus}</td>
              <td className="px-4 py-3 text-(--ink-2)">{row.interpretation}</td>
              <td className="px-4 py-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-(--muted) border border-(--border) px-1.5 py-0.5 whitespace-nowrap">
                  {NATURE_LABEL[row.nature] ?? row.nature}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
