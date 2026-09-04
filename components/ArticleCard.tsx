import type { RecommendedArticle } from "@/lib/types";
import { SourceLink } from "./SourceLink";

const NATURE_LABEL: Record<string, string> = {
  fact: "Información",
  analysis: "Análisis",
  opinion: "Opinión",
};

export function ArticleCard({ article }: { article: RecommendedArticle }) {
  return (
    <article className="border border-(--border) p-5 flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-(--accent)">
          {article.outlet}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-(--muted) border border-(--border) px-1.5 py-0.5">
          {NATURE_LABEL[article.nature] ?? article.nature}
        </span>
      </div>
      <h3 className="font-serif text-lg font-medium leading-snug">{article.title}</h3>
      <p className="text-sm text-(--muted) italic">{article.reason}</p>
      <p className="text-sm text-(--ink-2) leading-relaxed flex-1">{article.summary}</p>
      <div className="pt-2 border-t border-(--border) font-mono text-[11px] uppercase tracking-wider">
        <SourceLink source={article.source} />
      </div>
    </article>
  );
}
