import { lazy, Suspense, useState } from "react";
import { Check, Rotate3D } from "lucide-react";
import { t } from "./i18n";
const Model = lazy(() => import("./model"));
const colors = [
  { id: "chalk", label: "Tiza", color: "#eeece7", print: "#273e35" },
  { id: "blue", label: "Azul noche", color: "#36556b", print: "#faf7ec" },
  { id: "sage", label: "Salvia", color: "#8a9c87", print: "#243b32" },
  { id: "ink", label: "Tinta", color: "#252a32", print: "#faf7ec" },
];
const product = {
  schemaVersion: 1,
  kind: "model-3d",
  name: "Studio tee",
  currency: "EUR",
  basePrice: 2900,
  model: "hero-shirt",
  canvas: { width: 1000, height: 1000 },
  views: ["frontal"],
  rules: [],
  personalization: {
    type: "shirt",
    version: 1,
    model: "atelier-shirt-v2",
    cleanStart: true,
    design: { version: 1, layers: [] },
  },
  groups: [
    {
      id: "fabric",
      label: "Color",
      order: 0,
      required: true,
      effect: "material",
      material: "Cotton",
      default: "chalk",
      options: colors.map((c) => ({ ...c, priceDelta: 0 })),
    },
  ],
};
export default function HeroConfigurator() {
  const [color, setColor] = useState("chalk"),
    [text, setText] = useState("MAKE IT\nYOURS"),
    [side, setSide] = useState("front");
  const finish = colors.find((c) => c.id === color)!;
  const selection = {
    fabric: color,
    $print: {
      version: 1,
      layers: text.trim()
        ? [
            {
              id: "hero_text",
              side: "front",
              type: "text",
              text,
              color: finish.print,
              font: "sans",
              x: 0.5,
              y: 0.32,
              width: 0.8,
              rotation: 0,
            },
          ]
        : [],
    },
  };
  return (
    <div
      className="hero-configurator"
      aria-label={t("Configurador 3D de camiseta")}
    >
      <div className="hero-configurator-head">
        <span className="live-dot" />
        <span>{t("PRUÉBALO AQUÍ · 3D REAL")}</span>
        <span>STUDIO TEE / 01</span>
      </div>
      <div className="hero-shirt-stage">
        <Suspense
          fallback={
            <div className="hero-model-loading" role="status">
              {t("Preparando tu camiseta…")}
            </div>
          }
        >
          <Model
            m={product}
            s={selection}
            printSide={side}
            modelUrl="/models/atelier-shirt-v2.glb"
          />
        </Suspense>
        <div
          className="hero-view-switch"
          role="group"
          aria-label={t("Vista de la camiseta")}
        >
          <button
            aria-pressed={side === "front"}
            onClick={() => setSide("front")}
          >
            {t("Frontal")}
          </button>
          <button
            aria-pressed={side === "back"}
            onClick={() => setSide("back")}
          >
            {t("Espalda")}
          </button>
          <button
            aria-pressed={side === "orbit"}
            onClick={() => setSide("orbit")}
          >
            <Rotate3D size={15} />
            {t("Girar en 3D")}
          </button>
        </div>
        <span className="hero-shirt-hint">
          {side === "orbit"
            ? t("Arrastra la camiseta para girarla")
            : side === "back"
              ? t("El diseño está en el frontal")
              : t("Cambia el color. Escribe algo tuyo.")}
        </span>
      </div>
      <div className="hero-shirt-options">
        <div className="hero-shirt-color-row">
          <span>
            {t("Color")} <strong>{t(finish.label)}</strong>
          </span>
          <div role="group" aria-label={t("Color de la camiseta")}>
            {colors.map((c) => (
              <button
                key={c.id}
                aria-label={t(c.label)}
                aria-pressed={color === c.id}
                onClick={() => setColor(c.id)}
                style={{ background: c.color, color: c.print }}
              >
                {color === c.id && <Check size={15} />}
              </button>
            ))}
          </div>
        </div>
        <label className="hero-text-input">
          <span>
            {t("Tu texto en la camiseta")}
            <small>{text.length}/32</small>
          </span>
          <input
            aria-label={t("Tu texto en la camiseta")}
            value={text.replace(/\n/g, " ")}
            maxLength={32}
            placeholder={t("Escribe tu idea")}
            onChange={(e) => {
              setText(e.target.value);
              setSide("front");
            }}
          />
        </label>
        <p>
          {t("Demo sin registro. Los cambios se muestran sobre el modelo 3D.")}
        </p>
      </div>
      <small className="hero-model-credit">
        3D:{" "}
        <a
          href="https://sketchfab.com/3d-models/tshirt-5a21282b2e454d1696547148f617d3d0"
          target="_blank"
          rel="noreferrer"
        >
          Tabbuso
        </a>{" "}
        ·{" "}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noreferrer"
        >
          CC BY 4.0
        </a>{" "}
        · {t("Adaptado por Yenze")}
      </small>
    </div>
  );
}
