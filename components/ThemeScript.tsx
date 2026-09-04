/**
 * Script inline ejecutado antes de pintar, para evitar el flash de tema
 * incorrecto. Lee la preferencia guardada en localStorage ("light" | "dark"
 * | "system") y aplica data-theme en <html> en consecuencia.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("matizal-theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {}
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
