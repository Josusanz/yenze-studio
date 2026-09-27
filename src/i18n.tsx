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
  return (
    <label className="language-select">
      <span className="sr-only">{lang === "en" ? "Language" : "Idioma"}</span>
      <select
        aria-label={lang === "en" ? "Language" : "Idioma"}
        value={lang}
        onChange={(event) => {
          const next = event.target.value;
          try {
            localStorage.setItem("yenze-language", next);
          } catch {}
          const url = new URL(location.href);
          url.searchParams.set("lang", next);
          location.assign(url.href);
        }}
      >
        <option value="en">EN</option>
        <option value="es">ES</option>
      </select>
    </label>
  );
}
