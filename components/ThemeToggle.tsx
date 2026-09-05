"use client";

import { useCallback, useSyncExternalStore } from "react";

type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "matizal-theme";

function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", choice);
  }
}

function readStoredChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage no disponible: se queda en "system".
  }
  return "system";
}

const THEME_CHANGE_EVENT = "matizal-theme-change";

// useSyncExternalStore evita el patrón "leer localStorage en un efecto y
// hacer setState", que dispara renders en cascada. El snapshot del server
// es siempre "system" para que el primer render coincida con el HTML
// generado por el servidor (sin flash de contenido incorrecto). Los cambios
// se notifican disparando un evento propio que el store escucha.
function subscribe(callback: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, callback);
}

export function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, readStoredChoice, () => "system" as const);

  const handleChange = useCallback((next: ThemeChoice) => {
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignorar si no hay acceso a localStorage.
    }
    // Fuerza una relectura del store para reflejar el cambio inmediatamente.
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const options: { value: ThemeChoice; label: string }[] = [
    { value: "light", label: "Claro" },
    { value: "dark", label: "Oscuro" },
    { value: "system", label: "Auto" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Tema de la aplicación"
      className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider"
    >
      {options.map((opt, idx) => (
        <span key={opt.value} className="flex items-center gap-1">
          {idx > 0 && (
            <span aria-hidden="true" className="text-(--border-strong)">
              /
            </span>
          )}
          <button
            role="radio"
            aria-checked={choice === opt.value}
            onClick={() => handleChange(opt.value)}
            className={`px-1 py-1 transition-colors cursor-pointer ${
              choice === opt.value
                ? "text-(--accent)"
                : "text-(--muted) hover:text-(--foreground)"
            }`}
          >
            {opt.label}
          </button>
        </span>
      ))}
    </div>
  );
}
