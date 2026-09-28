import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Image,
  Layers,
  Box,
  Plus,
  Package,
  Armchair,
  Shirt,
  CalendarDays,
} from "lucide-react";
import { industries } from "../core/industries.mjs";

export default function Start({ create, templates }: any) {
  const root = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const draftKey =
    "yenze:start:" + (localStorage.getItem("workspace") || "current");
  const [saved] = useState<any>(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem(draftKey) || "null");
      if (
        !d ||
        ![1, 2].includes(d.version) ||
        typeof d.name !== "string" ||
        d.name.length > 120 ||
        !industries.some((i) => i.id === d.type)
      )
        return null;
      return {
        ...d,
        step: d.step ? 1 : 0,
        source: [
          "guided",
          "images",
          "empty",
          "model",
          "scene",
          "shirt-3d",
          "table-3d",
        ].includes(d.source)
          ? d.source
          : "",
      };
    } catch {
      return null;
    }
  });
  const [name, setName] = useState(saved?.name || "");
  const [type, setType] = useState(saved?.type || "general");
  const [source, setSource] = useState(saved?.source || "");
  const [step, setStep] = useState(saved?.step || 0);
  const [more, setMore] = useState(false),
    [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [storageFailed, setStorageFailed] = useState(false);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({ version: 2, name, type, source, step }),
      );
    } catch {
      setStorageFailed(true);
    }
  }, [name, type, source, step, draftKey]);
  useEffect(() => {
    root.current?.closest(".wizard-scroll")?.scrollTo({ top: 0 });
  }, [step]);
  const recipe = (kind: string) => {
    setName(
      kind === "textile"
        ? "Mi camiseta personalizada"
        : kind === "furniture"
          ? "Mi mesa a medida"
          : "Mi servicio a medida",
    );
    setType(kind);
    setSource(
      kind === "textile"
        ? "shirt-3d"
        : kind === "furniture"
          ? "table-3d"
          : "guided",
    );
    setStep(1);
  };
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
  const choices = [
    {
      id: "images",
      icon: Image,
      label: "Tengo fotos de mi producto",
      text: "Sube una foto para empezar. Después podrás añadir variantes.",
      next: "Subir mis fotos",
    },
    {
      id: "model",
      icon: Box,
      label: "Tengo un modelo 3D",
      text: "Importa un GLB. Verás sus piezas y materiales antes de elegir qué personalizar.",
      next: "Subir mi modelo 3D",
    },
    {
      id: "empty",
      icon: Layers,
      label: "Tengo capas de imagen",
      text: "Combina imágenes transparentes de las piezas de tu producto.",
      next: "Subir mis capas",
    },
    {
      id: "scene",
      icon: Plus,
      label: "Quiero construirlo en 3D",
      text: "Crea una composición con formas y medidas. No necesitas un archivo para empezar.",
      next: "Abrir el constructor 3D",
    },
    {
      id: "table-3d",
      icon: Armchair,
      label: "Mesa 3D lista para adaptar",
      text: "Empieza viendo una mesa real en el lienzo. Ajusta piezas, medidas y acabados.",
      next: "Abrir mi mesa 3D",
    },
    {
      id: "shirt-3d",
      icon: Shirt,
      label: "Camiseta 3D lista para personalizar",
      text: "Modelo incluido. Añade textos e imágenes al frontal y la espalda.",
      next: "Abrir mi camiseta 3D",
    },
    {
      id: "guided",
      icon: CalendarDays,
      label: "Continuar sin imágenes",
      text: "Para servicios o productos que todavía no tienen fotos. Usa una ficha con opciones y precio.",
      next: "Crear mi ficha",
    },
  ];
  const selected = choices.find((v) => v.id === source);
  const begin = async (template = source, templateName = name.trim()) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      // Only the image-free route needs suggested questions to render a first summary.
      // Visual imports derive their controls from the actual files, not an unrelated sector questionnaire.
      const questions =
        template === "guided"
          ? industries.find((i) => i.id === type)!.questions
          : undefined;
      await create(template, {
        name: templateName,
        industry: type,
        basePrice: type === "service" ? 9000 : 0,
        questions,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="start-wizard" ref={root}>
      {(saved?.name || storageFailed) && (
        <p className="note" role="status">
          {storageFailed
            ? "Mantén esta pestaña abierta: el navegador no permite recuperar este inicio."
            : "Hemos recuperado tu idea. Continúa donde la dejaste."}
        </p>
      )}
      <div className="wizard-progress">
        {["Tu producto", "Dale forma", "Después, sus opciones"].map(
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
          <span className="eyebrow">PRIMERO, TU PRODUCTO</span>
          <h2>Vamos a darle forma.</h2>
          <p>
            Trae tus imágenes, un modelo 3D o empieza con una base. Las opciones
            vienen después, con tu producto delante.
          </p>
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
                onClick={() => setType(t.id)}
              >
                <Package size={20} />
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
              Puedes elegir «Otros productos» y adaptar el contenido a tu
              negocio.
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
          <div className="wizard-foot">
            <small>No necesitas definir las opciones todavía.</small>
            <button
              className="primary"
              disabled={!name.trim()}
              onClick={() => setStep(1)}
            >
              Continuar <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="starter-recipes" aria-label="Comienzos guiados">
            <button onClick={() => recipe("textile")}>
              <Shirt size={21} />
              <span>
                <strong>Una camiseta con mi diseño</strong>
                <small>Empieza con el modelo 3D incluido.</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
            <button onClick={() => recipe("furniture")}>
              <Armchair size={21} />
              <span>
                <strong>Un mueble con mis acabados</strong>
                <small>Una mesa que puedes adaptar en el lienzo.</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
            <button onClick={() => recipe("service")}>
              <CalendarDays size={21} />
              <span>
                <strong>Un servicio a medida</strong>
                <small>Una ficha sin necesidad de imágenes.</small>
              </span>
              <ArrowUpRight size={16} />
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
                  <button
                    key={t.id}
                    disabled={busy}
                    onClick={() => begin(t.id, name.trim() || t.name)}
                  >
                    <span>{t.name}</span>
                    <ArrowUpRight size={17} />
                  </button>
                ))}
            </div>
          </details>
        </>
      ) : (
        <>
          <span className="eyebrow">UN PUNTO DE PARTIDA PARA {name}</span>
          <h2>¿Qué tienes para empezar?</h2>
          <p>
            Elige tu punto de partida. En el siguiente paso subirás los archivos
            o trabajarás directamente sobre el producto.
          </p>
          <div className="source-choices">
            {choices.map((v) => (
              <button
                key={v.id}
                className={source === v.id ? "active" : ""}
                aria-pressed={source === v.id}
                disabled={busy}
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
            <button className="text" disabled={busy} onClick={() => setStep(0)}>
              <ArrowLeft size={15} /> Atrás
            </button>
            <button
              className="primary"
              disabled={!selected || !name.trim() || busy}
              onClick={() => begin()}
            >
              {busy
                ? "Preparando tu espacio…"
                : selected?.next || "Elige cómo empezar"}
              <ArrowUpRight size={17} />
            </button>
          </div>
          <small className="wizard-disclaimer">
            Abriremos un borrador privado para trabajar en tu producto. Nada se
            publica sin que lo revises.
          </small>
        </>
      )}
      {error && (
        <p role="alert" className="validation">
          {error}
        </p>
      )}
    </div>
  );
}
