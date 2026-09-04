"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { PriorityLevel } from "@/lib/types";

type FilterChoice = PriorityLevel | "all";

const ATTR = "data-priority-filter";
const CHANGE_EVENT = "matizal-priority-filter-change";

function apply(choice: FilterChoice) {
  if (choice === "all") {
    document.documentElement.removeAttribute(ATTR);
  } else {
    document.documentElement.setAttribute(ATTR, choice);
  }
}

function readCurrent(): FilterChoice {
  const value = document.documentElement.getAttribute(ATTR);
  if (value === "attention" || value === "important" || value === "context") {
    return value;
  }
  return "all";
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

const OPTIONS: { value: FilterChoice; label: string; dot?: string }[] = [
  { value: "all", label: "Todo" },
  { value: "attention", label: "Atención", dot: "🔴" },
  { value: "important", label: "Importante", dot: "🟠" },
  { value: "context", label: "Contexto", dot: "🟢" },
];

/**
 * Filtro de lectura rápida: permite saltar directo a lo marcado como
 * "Requiere atención" sin desplazarse por todo el contexto de fondo. Actúa
 * en el cliente vía CSS (ver .priority-item en globals.css) — no vuelve a
 * pedir datos ni desmonta contenido, solo lo oculta visualmente, así que
 * cambiar de filtro es instantáneo y el estado no sobrevive a un reload
 * (arranca siempre en "Todo", correcto para no confundir con contenido
 * "desaparecido" en una visita nueva).
 */
export function PriorityFilter() {
  const choice = useSyncExternalStore(subscribe, readCurrent, () => "all" as const);

  const handleChange = useCallback((next: FilterChoice) => {
    apply(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label="Filtrar por prioridad"
      className="flex flex-wrap items-center gap-1.5"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={choice === opt.value}
          onClick={() => handleChange(opt.value)}
          className={`inline-flex items-center gap-1 px-2.5 py-1 border font-mono text-[10px] uppercase tracking-wider transition-colors cursor-pointer ${
            choice === opt.value
              ? "border-(--accent) text-(--accent)"
              : "border-(--border) text-(--muted) hover:text-(--foreground)"
          }`}
        >
          {opt.dot && <span aria-hidden="true">{opt.dot}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
