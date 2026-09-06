import { BrandMark } from "./BrandMark";
import { ExternalTextLink } from "./TextLink";

export function SiteFooter() {
  return (
    <footer className="border-t border-(--border) mt-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <BrandMark size={22} className="opacity-80" />
          <div>
            <p className="font-serif text-sm font-semibold">Matizal News</p>
            <p className="font-mono text-[11px] uppercase tracking-wider text-(--muted)">
              news.matizal.com
            </p>
          </div>
        </div>

        <div className="font-mono text-[11px] uppercase tracking-wider text-(--muted) flex flex-col sm:items-end gap-1">
          <p>Edición diaria ejecutiva — prensa y mercados</p>
          <ExternalTextLink href="https://matizal.com" target="_blank" rel="noopener noreferrer" active>
            matizal.com →
          </ExternalTextLink>
        </div>
      </div>
    </footer>
  );
}
