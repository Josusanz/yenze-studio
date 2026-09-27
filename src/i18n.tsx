import english from "./locales/en.json";
export type Language = "es" | "en";
export function getLanguage(): Language {
  const requested = new URLSearchParams(location.search).get("lang");
  if (requested === "en" || requested === "es") return requested;
  try {
    const saved = localStorage.getItem("yenze-language");
    if (saved === "en" || saved === "es") return saved;
  } catch {}
  return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}
export const t = (text: string): string =>
  getLanguage() === "en"
    ? ((english as Record<string, string>)[text] ?? text)
    : text;
export function LanguageSelect() {
  const lang = getLanguage();
  const change = (next: Language) => {
    if (next === lang) return;
    try {
      localStorage.setItem("yenze-language", next);
    } catch {}
    const url = new URL(location.href);
    url.searchParams.set("lang", next);
    location.assign(url.href);
  };
  return (
    <div
      className="language-toggle"
      role="group"
      aria-label={lang === "en" ? "Language" : "Idioma"}
    >
      <button
        type="button"
        lang="es"
        aria-label="Español"
        aria-pressed={lang === "es"}
        onClick={() => change("es")}
      >
        ES
      </button>
      <button
        type="button"
        lang="en"
        aria-label="English"
        aria-pressed={lang === "en"}
        onClick={() => change("en")}
      >
        EN
      </button>
    </div>
  );
}
