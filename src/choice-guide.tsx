import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Plus,
  Trash2,
  Palette,
  Ruler,
  Truck,
  CalendarDays,
  Box,
  SlidersHorizontal,
} from "lucide-react";
import {
  choicePreset,
  choiceTargets,
  buildGuidedChoice,
} from "../core/choice-guide.mjs";
const uid = () => "n_" + crypto.randomUUID().replaceAll("-", "").slice(0, 14);
export default function ChoiceGuide({ m, onCreate, onCancel }: any) {
  const root = useRef<HTMLDivElement>(null);
  const drafts = useRef<Record<string, any>>({});
  const [choosing, setChoosing] = useState(true);
  const [kind, setKind] = useState(""),
    [draft, setDraft] = useState<any>(null),
    [attempted, setAttempted] = useState(false);
  const [sample, setSample] = useState(0);
  useEffect(() => {
    root.current?.scrollIntoView({ block: "start" });
    root.current?.focus();
  }, []);
  useEffect(() => {
    if (!choosing)
      root.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [choosing]);
  const targets =
    draft && draft.effect !== "choice" ? choiceTargets(m, draft.effect) : [];
  const pick = (value: string) => {
    if (kind && draft) drafts.current[kind] = draft;
    const d = choicePreset(value);
    setKind(value);
    setDraft(
      drafts.current[value] || {
        ...d,
        target: choiceTargets(m, d.effect)[0]?.id || "",
      },
    );
    setChoosing(false);
    setAttempted(false);
    setSample(0);
  };
  const update = (i: number, patch: any) =>
    setDraft({
      ...draft,
      options: draft.options.map((o: any, n: number) =>
        n === i ? { ...o, ...patch } : o,
      ),
    });
  let problem = "";
  if (draft) {
    try {
      buildGuidedChoice(m, draft, () => "preview");
    } catch (e) {
      problem = (e as Error).message;
    }
  }
  const intents = [
    {
      id: "size",
      label: "Tallas o tamaños",
      text: "Una lista como S, M, L y XL. No cambia la geometría.",
      icon: Ruler,
    },
    ...(m.kind === "form"
      ? [
          {
            id: "service",
            label: "Modalidades de servicio",
            text: "Por ejemplo, online o presencial.",
            icon: CalendarDays,
          },
        ]
      : []),
    ...(["model-3d", "scene-3d"].includes(m.kind)
      ? [
          {
            id: "material",
            label: "Colores de una pieza",
            text: "El color cambia sobre tu modelo 3D.",
            icon: Palette,
          },
          {
            id: "visibility",
            label: "Un accesorio opcional",
            text: "Muestra u oculta una pieza que ya existe.",
            icon: Box,
          },
        ]
      : []),
    {
      id: "delivery",
      label: "Opciones de entrega",
      text: "Recogida o envío, con su suplemento.",
      icon: Truck,
    },
    {
      id: "custom",
      label: "Otra elección",
      text: "Escribe tus propias opciones y precios.",
      icon: SlidersHorizontal,
    },
  ];
  return (
    <div
      className="choice-guide"
      ref={root}
      tabIndex={-1}
      role="region"
      aria-label="Crear una elección paso a paso"
    >
      <button className="text" onClick={onCancel}>
        <ArrowLeft size={16} /> Volver a mis elecciones
      </button>
      <span className="eyebrow">UNA DECISIÓN CADA VEZ</span>
      <h2>{choosing ? "¿Qué quieres ofrecer?" : "Hazlo a tu manera."}</h2>
      <p>
        {choosing
          ? "Elige un comienzo. Puedes cambiar todos los nombres y precios."
          : "Pon los nombres y suplementos que verá tu cliente."}
      </p>
      {choosing ? (
        <div className="choice-intents">
          {intents.map((i) => {
            const unavailable =
              ["material", "visibility"].includes(i.id) &&
              !choiceTargets(m, i.id).length;
            return (
              <button
                key={i.id}
                className={kind === i.id ? "active" : ""}
                aria-pressed={kind === i.id}
                disabled={unavailable}
                onClick={() => pick(i.id)}
              >
                <i.icon size={19} />
                <span>
                  <strong>{i.label}</strong>
                  <small>
                    {unavailable
                      ? "No quedan piezas sin configurar para esta elección."
                      : i.text}
                  </small>
                </span>
                {kind === i.id && <Check size={16} />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="choice-selected-kind">
          <strong>{intents.find((i) => i.id === kind)?.label}</strong>
          <button className="text" onClick={() => setChoosing(true)}>
            Cambiar tipo
          </button>
        </div>
      )}
      {draft && !choosing && (
        <>
          <label>
            Nombre que verá tu cliente
            <input
              aria-label="Nombre de la nueva elección"
              maxLength={80}
              value={draft.label}
              placeholder="Por ejemplo: Tamaño"
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
          </label>
          {draft.effect !== "choice" && (
            <label>
              ¿En qué pieza?
              <select
                value={draft.target}
                onChange={(e) => setDraft({ ...draft, target: e.target.value })}
              >
                {targets.map((t: any) => (
                  <option value={t.id} key={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="help-note">
            La primera opción será la selección inicial. Un suplemento de 0 €
            significa que está incluido.
          </p>
          <div className="guided-answers">
            {draft.options.map((o: any, i: number) => (
              <div className="guided-answer" key={i}>
                <label>
                  Opción {i + 1}
                  <input
                    aria-label={"Nombre de respuesta " + (i + 1)}
                    maxLength={80}
                    value={o.label}
                    placeholder={
                      i === 0
                        ? "Por ejemplo: Esencial"
                        : "Por ejemplo: Completa"
                    }
                    onChange={(e) => update(i, { label: e.target.value })}
                  />
                </label>
                <label>
                  Extra (€)
                  <input
                    aria-label={"Extra de respuesta " + (i + 1)}
                    type="number"
                    min="0"
                    step="0.01"
                    value={o.price}
                    onChange={(e) => update(i, { price: e.target.value })}
                  />
                </label>
                {draft.effect === "material" && (
                  <label>
                    Color
                    <input
                      aria-label={"Color de respuesta " + (i + 1)}
                      type="color"
                      value={o.color}
                      onChange={(e) => update(i, { color: e.target.value })}
                    />
                  </label>
                )}
                {draft.effect === "visibility" && (
                  <label>
                    Pieza
                    <select
                      aria-label={"Visibilidad de respuesta " + (i + 1)}
                      value={String(o.visible)}
                      onChange={(e) =>
                        update(i, { visible: e.target.value === "true" })
                      }
                    >
                      <option value="false">Oculta</option>
                      <option value="true">Visible</option>
                    </select>
                  </label>
                )}
                <button
                  className="icon"
                  aria-label={"Quitar respuesta " + (i + 1)}
                  disabled={draft.options.length <= 2}
                  onClick={() => {
                    setDraft({
                      ...draft,
                      options: draft.options.filter(
                        (_: any, n: number) => n !== i,
                      ),
                    });
                    setSample(0);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="text"
            disabled={draft.options.length >= 100}
            onClick={() =>
              setDraft({
                ...draft,
                options: [
                  ...draft.options,
                  {
                    label: "",
                    price: "0",
                    ...(draft.effect === "material"
                      ? { color: "#b6b9bc" }
                      : draft.effect === "visibility"
                        ? { visible: true }
                        : {}),
                  },
                ],
              })
            }
          >
            <Plus size={15} /> Añadir otra respuesta
          </button>
          <div
            className="choice-sample"
            aria-label="Vista previa de la nueva elección"
          >
            <span className="eyebrow">ASÍ SE ELEGIRÁ</span>
            <strong>{draft.label || "Tu elección"}</strong>
            {draft.options.map((o: any, i: number) => (
              <button
                key={i}
                className={sample === i ? "active" : ""}
                aria-pressed={sample === i}
                onClick={() => setSample(i)}
              >
                {o.color && <i style={{ background: o.color }} />}
                <span>{o.label || "Opción " + (i + 1)}</span>
                <small>
                  {Number(o.price) > 0
                    ? "+" +
                      Number(o.price).toLocaleString("es-ES", {
                        style: "currency",
                        currency: "EUR",
                      })
                    : "Incluido"}
                </small>
                {sample === i && <Check size={15} />}
              </button>
            ))}
            <p>
              Esta vista previa no cambia tu producto. Al añadirla, podrás
              probarla en el lienzo.
            </p>
          </div>
          {attempted && problem && (
            <p className="validation" role="alert">
              {problem}
            </p>
          )}
          <div className="choice-guide-actions">
            <button className="text" onClick={onCancel}>
              Cancelar
            </button>
            <button
              className="primary"
              onClick={() => {
                setAttempted(true);
                if (!problem) onCreate(buildGuidedChoice(m, draft, uid));
              }}
            >
              Añadir a mi producto
            </button>
          </div>
        </>
      )}
    </div>
  );
}
