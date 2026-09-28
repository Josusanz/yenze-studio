import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Plus,
  Image,
  Layers,
  Box,
  Sparkles,
  Package,
  Armchair,
  Shirt,
  CalendarDays,
  Trash2,
} from "lucide-react";
import { industries, setupGroups } from "../core/industries.mjs";
export default function Start({ create, templates }: any) {
  const root = useRef<HTMLDivElement>(null);
  const draftKey =
    "yenze:start:" + (localStorage.getItem("workspace") || "current");
  const [saved] = useState<any>(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem(draftKey) || "null");
      if (
        !d ||
        d.version !== 1 ||
        typeof d.name !== "string" ||
        d.name.length > 120 ||
        !industries.some((i) => i.id === d.type) ||
        !Array.isArray(d.questions) ||
        d.questions.length > 20 ||
        !d.questions.every(
          (q: any) =>
            q && typeof q.label === "string" && typeof q.answers === "string",
        ) ||
        ![0, 1, 2].includes(d.step) ||
        typeof d.base !== "string" ||
        ![
          "guided",
          "images",
          "empty",
          "model",
          "scene",
          "shirt-3d",
          "table-3d",
        ].includes(d.source)
      )
        return null;
      return d;
    } catch {
      return null;
    }
  });
  const [storageFailed, setStorageFailed] = useState(false);
  const recipe = (kind: string) => {
    setName(
      kind === "textile"
        ? "Mi camiseta personalizada"
        : kind === "furniture"
          ? "Mi mesa a medida"
          : "Mi servicio a medida",
    );
    setType(kind);
    setQuestions(
      kind === "furniture"
        ? [
            {
              label: "Entrega",
              answers: "Recogida en tienda, Envío a domicilio",
            },
          ]
        : structuredClone(
            industries.find((i) => i.id === kind)!.questions,
          ).filter((q) => kind !== "textile" || q.label !== "Color"),
    );
    setSource(
      kind === "textile"
        ? "shirt-3d"
        : kind === "furniture"
          ? "table-3d"
          : "guided",
    );
    setEdited(true);
    setBase(kind === "textile" ? "29" : kind === "furniture" ? "240" : "90");
    setStep(1);
  };
  const [search, setSearch] = useState(""),
    [edited, setEdited] = useState(saved?.edited ?? false),
    [more, setMore] = useState(false),
    [step, setStep] = useState(saved?.step ?? 0),
    [name, setName] = useState(saved?.name ?? ""),
    [type, setType] = useState(saved?.type ?? "general"),
    [questions, setQuestions] = useState<
      Array<{ label: string; answers: string }>
    >(saved?.questions ?? structuredClone(industries[0].questions)),
    [base, setBase] = useState(saved?.base ?? "0"),
    [source, setSource] = useState(saved?.source ?? "guided");
  useEffect(() => {
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({
          version: 1,
          name,
          type,
          questions,
          base,
          source,
          step,
          edited,
        }),
      );
    } catch {
      setStorageFailed(true);
    }
  }, [name, type, questions, base, source, step, edited, draftKey]);
  useEffect(() => {
    root.current?.closest(".wizard-scroll")?.scrollTo({ top: 0 });
  }, [step]);
  const setup = {
    name: name.trim(),
    basePrice: Math.round(Number(base) * 100),
    industry: type,
    questions,
  };
  let problem = "";
  try {
    setupGroups(setup);
    if (!base.trim() || !Number.isFinite(Number(base)))
      problem = "Introduce un precio válido.";
  } catch (e) {
    problem = (e as Error).message;
  }
  const ready = !problem;
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const shown = industries
    .filter(
      (t) =>
        !search ||
        normalize(t.label + " " + t.keywords).includes(normalize(search)),
    )
    .filter((_, i) => more || search || i < 4);
  return (
    <div className="start-wizard" ref={root}>
      {(saved?.name || storageFailed) && (
        <p className="note" role="status">
          {storageFailed
            ? "Este navegador no permite conservar el asistente. Mantén esta pestaña abierta hasta crear el producto."
            : "Hemos recuperado tu idea. Continúa donde la dejaste."}
        </p>
      )}
      <div className="wizard-progress">
        {["Tu producto", "Sus opciones", "Tu punto de partida"].map(
          (label, i) => (
            <span key={label} className={step >= i ? "active" : ""}>
              <i>{step > i ? <Check size={12} /> : i + 1}</i>
              {label}
            </span>
          ),
        )}
      </div>
      {step === 0 ? (
        <>
          <span className="eyebrow">NO NECESITAS SABER DE CONFIGURADORES</span>
          <h2>
            Empieza por lo que conoces.
            <br />
            Tu producto.
          </h2>
          <p>
            Te ayudamos a convertir las decisiones de tus clientes en una
            experiencia que puedan usar.
          </p>
          <div className="starter-recipes" aria-label="Comienzos guiados">
            <button onClick={() => recipe("textile")}>
              <Shirt size={21} />
              <span>
                <strong>Una camiseta con mi diseño</strong>
                <small>Modelo 3D, tallas y originales de impresión.</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
            <button onClick={() => recipe("furniture")}>
              <Armchair size={21} />
              <span>
                <strong>Un mueble con mis acabados</strong>
                <small>Mesa 3D incluida, colores y opciones de entrega.</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
            <button onClick={() => recipe("service")}>
              <CalendarDays size={21} />
              <span>
                <strong>Un servicio a medida</strong>
                <small>Opciones, propuesta y aprobación. Sin imágenes.</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          </div>
          <label>
            ¿Qué vas a vender?
            <input
              autoFocus
              placeholder="Por ejemplo: una mesa, una bicicleta o un curso"
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>¿Cuál se parece más a tu negocio?</label>
          {more && (
            <input
              aria-label="Buscar sector"
              placeholder="Busca tu sector: café, bicicletas, regalos…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          <div className="business-types">
            {shown.map((t) => (
              <button
                key={t.id}
                aria-label={t.label}
                className={type === t.id ? "active" : ""}
                aria-pressed={type === t.id}
                onClick={() => {
                  setType(t.id);
                  if (!edited) setQuestions(structuredClone(t.questions));
                }}
              >
                {t.id === "textile" ? (
                  <Shirt size={20} />
                ) : t.id === "furniture" ? (
                  <Armchair size={20} />
                ) : t.id === "service" ? (
                  <CalendarDays size={20} />
                ) : (
                  <Package size={20} />
                )}
                <span>
                  <strong>{t.label}</strong>
                  <small>{t.description}</small>
                </span>
                {type === t.id && <Check size={14} />}
              </button>
            ))}
          </div>
          {!shown.length && (
            <p>
              No encontramos ese sector. Puedes usar «Otros productos» y
              escribir tus propias preguntas.
            </p>
          )}
          <button
            className="text"
            onClick={() => {
              setMore(!more);
              setSearch("");
            }}
          >
            {more ? "Ver menos sectores" : "Explorar los 12 sectores"}
          </button>
          {edited && (
            <p className="note">
              Conservamos las preguntas que has editado.{" "}
              <button
                className="text"
                onClick={() => {
                  setQuestions(
                    structuredClone(
                      industries.find((t) => t.id === type)!.questions,
                    ),
                  );
                  setEdited(false);
                }}
              >
                Usar las sugerencias de este sector
              </button>
            </p>
          )}
          <div className="wizard-foot">
            <small>Puedes cambiarlo todo después.</small>
            <button
              className="primary"
              disabled={!name.trim()}
              onClick={() => setStep(1)}
            >
              Continuar <ArrowUpRight size={17} />
            </button>
          </div>
          <details className="builder-details">
            <summary>Ya sé lo que quiero: abrir una plantilla</summary>
            <div className="templates">
              {templates
                .filter((t: any) =>
                  ["cabinet", "sofa", "shirt", "shirt-3d"].includes(t.id),
                )
                .map((t: any) => (
                  <button key={t.id} onClick={() => create(t.id)}>
                    <span>{t.name}</span>
                    <ArrowUpRight size={17} />
                  </button>
                ))}
            </div>
          </details>
        </>
      ) : step === 1 ? (
        <>
          <span className="eyebrow">
            PIENSA EN LAS PREGUNTAS DE TUS CLIENTES
          </span>
          <h2>¿Qué pueden elegir?</h2>
          <p>
            Te proponemos un comienzo para <strong>{name}</strong>. Cambia los
            ejemplos por tus opciones reales.
          </p>
          <div className="wizard-questions">
            {questions.map((q, i) => (
              <div className="wizard-question" key={i}>
                <div className="row">
                  <span className="question-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <button
                    className="icon"
                    aria-label={"Quitar pregunta " + (i + 1)}
                    disabled={questions.length === 1}
                    onClick={() => (
                      setEdited(true),
                      setQuestions(questions.filter((_, n) => n !== i))
                    )}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <label>
                  La pregunta
                  <input
                    aria-label={"Pregunta " + (i + 1)}
                    maxLength={80}
                    value={q.label}
                    onChange={(e) => {
                      setEdited(true);
                      setQuestions(
                        questions.map((q, n) =>
                          n === i ? { ...q, label: e.target.value } : q,
                        ),
                      );
                    }}
                  />
                </label>
                <label>
                  Sus respuestas, separadas por comas
                  <input
                    maxLength={8100}
                    aria-label={"Respuestas " + (i + 1)}
                    value={q.answers}
                    onChange={(e) => {
                      setEdited(true);
                      setQuestions(
                        questions.map((q, n) =>
                          n === i ? { ...q, answers: e.target.value } : q,
                        ),
                      );
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
          <button
            className="text"
            disabled={questions.length >= 20}
            onClick={() => (
              setEdited(true),
              setQuestions([...questions, { label: "", answers: "" }])
            )}
          >
            <Plus size={15} /> Añadir otra pregunta
          </button>
          {problem && (
            <p role="status" className="validation">
              {problem}
            </p>
          )}
          <label className="wizard-price">
            Precio desde (€)
            <input
              type="number"
              min="0"
              step="0.01"
              value={base}
              onChange={(e) => setBase(e.target.value)}
            />
            <small>Después podrás poner suplementos a cada respuesta.</small>
          </label>
          <div className="wizard-foot">
            <button className="text" onClick={() => setStep(0)}>
              <ArrowLeft size={15} /> Atrás
            </button>
            <button
              className="primary"
              disabled={!ready}
              onClick={() => setStep(2)}
            >
              Continuar <ArrowUpRight size={17} />
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="eyebrow">PUEDES EMPEZAR CON LO QUE TIENES</span>
          <h2>¿Cómo quieres mostrarlo?</h2>
          <p>
            No necesitas imágenes para crear una primera experiencia funcional.
          </p>
          <div className="source-choices">
            {[
              ...(type === "furniture"
                ? [
                    {
                      id: "table-3d",
                      icon: Armchair,
                      label: "Mesa 3D lista para adaptar",
                      text: "Tablero, patas y acabados incluidos. Cambia sus medidas y sus opciones en el editor.",
                    },
                  ]
                : []),
              ...(type === "textile"
                ? [
                    {
                      id: "shirt-3d",
                      icon: Shirt,
                      label: "Camiseta 3D lista para personalizar",
                      text: "Modelo incluido. Diseña el frontal y la espalda con textos e imágenes.",
                    },
                  ]
                : []),
              {
                id: "guided",
                icon: Sparkles,
                label: "Aún no tengo imágenes",
                text: "Empezar con una ficha y un resumen de las elecciones. Puedes publicarla así.",
              },
              {
                id: "images",
                icon: Image,
                label: "Tengo fotos de mi producto",
                text: "Cada imagen representa una variante o un acabado.",
              },
              {
                id: "empty",
                icon: Layers,
                label: "Tengo capas de imagen",
                text: "Superponer piezas y acabados para mostrar combinaciones.",
              },
              {
                id: "model",
                icon: Box,
                label: "Tengo un modelo 3D",
                text: "Detectar piezas y materiales de un archivo GLB.",
              },
              {
                id: "scene",
                icon: Plus,
                label: "Quiero construirlo en 3D",
                text: "Crear una composición con formas y medidas editables.",
              },
            ].map((v) => (
              <button
                key={v.id}
                className={source === v.id ? "active" : ""}
                onClick={() => setSource(v.id)}
              >
                <v.icon size={21} />
                <span>
                  <strong>{v.label}</strong>
                  <small>{v.text}</small>
                </span>
                <i>{source === v.id && <Check size={13} />}</i>
              </button>
            ))}
          </div>
          <div className="wizard-foot">
            <button className="text" onClick={() => setStep(1)}>
              <ArrowLeft size={15} /> Atrás
            </button>
            <button
              className="primary"
              disabled={!ready}
              onClick={() =>
                create(source, {
                  name: name.trim(),
                  basePrice: Math.round(Number(base) * 100),
                  questions,
                  industry: type,
                })
              }
            >
              Crear mi configurador <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="wizard-summary">
            <strong>Así empezará tu configurador</strong>
            <p>
              {name} · {questions.length} preguntas · desde{" "}
              {Number(base).toLocaleString("es-ES", {
                style: "currency",
                currency: "EUR",
              })}
            </p>
            <small>
              Las respuestas sugeridas son ejemplos: revisa precios y
              condiciones antes de publicar.
            </small>
          </div>
          <small className="wizard-disclaimer">
            Crearás un borrador. Nada se publica sin que lo revises.
          </small>
        </>
      )}
    </div>
  );
}
