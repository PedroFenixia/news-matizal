import type { Metadata } from "next";
import Link from "next/link";
import { listAllDatesPaged, listEditionMeta, listDates } from "@/lib/storage/editions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fue noticia",
  description: "Histórico completo de ediciones diarias de prensa y mercados.",
  alternates: { canonical: "/archivo" },
};

const PAGE_SIZE = 20;

function formatDateLabel(fecha: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${fecha}T12:00:00Z`));
}

export default async function ArchivoPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const requestedPage = Math.max(1, Number(pageParam) || 1);

  const { dates, page, totalPages, totalDates } = listAllDatesPaged(
    requestedPage,
    PAGE_SIZE
  );
  const generalDates = listDates("general");
  const financialDates = listDates("financial");

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14">
      <header className="border-b border-(--border-strong) pb-8 mb-8">
        <span className="font-mono text-xs uppercase tracking-widest text-(--accent)">
          Fue noticia
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight mt-3">
          Histórico de ediciones
        </h1>
        <p className="text-(--ink-2) mt-3 max-w-xl leading-relaxed">
          Cada edición se conserva de forma permanente durante el periodo de
          retención vigente. Selecciona una fecha para consultar la edición
          financiera y de prensa general de ese día.
        </p>
      </header>

      {totalDates === 0 ? (
        <p className="text-(--muted) italic">Todavía no hay ediciones disponibles.</p>
      ) : (
        <>
          <ul className="flex flex-col">
            {dates.map((fecha) => {
              const hasGeneral = generalDates.includes(fecha);
              const hasFinancial = financialDates.includes(fecha);
              const generalEditions = hasGeneral ? listEditionMeta("general", fecha) : [];
              const financialEditions = hasFinancial ? listEditionMeta("financial", fecha) : [];
              const totalEditions = generalEditions.length + financialEditions.length;

              return (
                <li
                  key={fecha}
                  className="py-5 border-b border-(--border) last:border-b-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div>
                    <p className="font-serif text-lg capitalize">{formatDateLabel(fecha)}</p>
                    {totalEditions > 1 && (
                      <p className="font-mono text-[11px] uppercase tracking-wider text-(--muted) mt-1">
                        {totalEditions} edicion{totalEditions === 1 ? "" : "es"} publicadas
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3 font-mono text-xs uppercase tracking-wider">
                    {hasFinancial && (
                      <Link
                        href={`/financiero/${fecha}`}
                        className="border border-(--border-strong) px-3 py-2 transition-colors hover:border-(--accent) hover:text-(--accent)"
                      >
                        Financiero
                      </Link>
                    )}
                    {hasGeneral && (
                      <Link
                        href={`/prensa-general/${fecha}`}
                        className="border border-(--border-strong) px-3 py-2 transition-colors hover:border-(--accent) hover:text-(--accent)"
                      >
                        Prensa general
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <nav
              aria-label="Paginación del histórico"
              className="flex items-center justify-between gap-4 mt-8 pt-6 border-t border-(--border) font-mono text-xs uppercase tracking-wider"
            >
              {page > 1 ? (
                <Link
                  href={page - 1 === 1 ? "/archivo" : `/archivo?page=${page - 1}`}
                  className="border border-(--border-strong) px-3 py-2 transition-colors hover:border-(--accent) hover:text-(--accent)"
                >
                  ← Anterior
                </Link>
              ) : (
                <span />
              )}

              <span className="text-(--muted)">
                Página {page} de {totalPages}
              </span>

              {page < totalPages ? (
                <Link
                  href={`/archivo?page=${page + 1}`}
                  className="border border-(--border-strong) px-3 py-2 transition-colors hover:border-(--accent) hover:text-(--accent)"
                >
                  Siguiente →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
