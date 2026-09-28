import { checkUpload, printLimitMB } from "./upload-limits";
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import {
  Type,
  ImagePlus,
  ArrowLeft,
  Check,
  Trash2,
  Copy,
  Undo2,
  Redo2,
  Rotate3D,
  Move,
  ArrowUp,
  ArrowDown,
  Download,
  Shirt,
} from "lucide-react";
const Model = lazy(() => import("./model"));
import { printQuality } from "../core/print-quality.mjs";
import { validatePrint, resolvePrint } from "../core/print-design.mjs";
import {
  normalizePrintImage,
  printCanvas,
  printLayerHeight,
} from "./print-canvas";
import "./textile.css";
const uid = () => crypto.randomUUID().replaceAll("-", "");
const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
export function TextileButton({
  m,
  productId,
  merchant = false,
  s = {},
  onApply,
  label = "Diseñar mi camiseta",
}: any) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="textile-launch" onClick={() => setOpen(true)}>
        <Shirt size={18} />
        <span>
          {label}
          <small>Texto, imágenes y tu propia firma</small>
        </span>
        <span>↗</span>
      </button>
      {open &&
        createPortal(
          <TextileEditor
            m={m}
            productId={productId}
            merchant={merchant}
            s={s}
            close={() => setOpen(false)}
            apply={(d: any) => {
              onApply(d);
              setOpen(false);
            }}
          />,
          document.body,
        )}
    </>
  );
}
function TextileEditor({ m, s, productId, merchant, close, apply }: any) {
  const initial = () => resolvePrint(m, s);
  const [design, setDesign] = useState<any>(initial),
    [history, setHistory] = useState<any[]>([]),
    [future, setFuture] = useState<any[]>([]),
    [side, setSide] = useState("front"),
    [orbit, setOrbit] = useState(false),
    [selected, setSelected] = useState(""),
    [inline, setInline] = useState(false),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false),
    [region, setRegion] = useState<any>(null);
  const current = useRef(design),
    inlineInput = useRef<HTMLTextAreaElement>(null),
    file = useRef<HTMLInputElement>(null),
    dialog = useRef<HTMLDivElement>(null),
    drag = useRef<any>(null);
  current.current = design;
  useEffect(() => {
    if (inline) {
      if (innerWidth < 760)
        inlineInput.current?.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
      inlineInput.current?.focus({ preventScroll: true });
      inlineInput.current?.select();
    }
  }, [inline, selected]);
  useEffect(() => {
    const active = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = old;
      active?.focus();
    };
  }, []);
  const commit = (next: any) => {
    try {
      const validated = validatePrint(next);
      const before = current.current;
      setHistory((h) => [...h.slice(-29), before]);
      setFuture([]);
      setDesign(validated);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const patch = (values: any) =>
    commit({
      ...design,
      layers: design.layers.map((l: any) =>
        l.id === selected ? { ...l, ...values } : l,
      ),
    });
  const add = (layer: any) => {
    const id = uid();
    commit({
      ...current.current,
      layers: [
        ...current.current.layers,
        {
          side,
          type: "text",
          text: "",
          color: "#23384d",
          font: "sans",
          x: 0.5,
          y: 0.45,
          width: 0.7,
          rotation: 0,
          ...layer,
          id,
        },
      ],
    });
    setSelected(id);
    setOrbit(false);
    setInline(!layer.type || layer.type === "text");
  };
  const upload = async (f?: File) => {
    if (!f) return;
    setWorking(true);
    setError("");
    try {
      checkUpload(f, printLimitMB);
      const src = await normalizePrintImage(f);
      if (!productId)
        throw Error("Guarda el producto antes de subir un original.");
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(Error("No se pudo leer la imagen."));
        reader.readAsDataURL(f);
      });
      const response = await fetch(
        `/api/${merchant ? "products" : "public"}/${productId}/print-assets`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(merchant
              ? { "X-Workspace": localStorage.getItem("workspace") || "" }
              : {}),
          },
          body: JSON.stringify({ name: f.name, data }),
        },
      );
      const saved = await response.json();
      if (!response.ok)
        throw Error(
          saved.error || "No se pudo guardar el original. Inténtalo de nuevo.",
        );
      add({ type: "image", src, original: saved.original });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  };
  const quality = printQuality(design, m.personalization);
  const layer = design.layers.find((l: any) => l.id === selected),
    visible = design.layers.filter((l: any) => l.side === side);
  const undo = () => {
    if (!history.length) return;
    const before = current.current;
    setFuture((f) => [before, ...f]);
    setDesign(history.at(-1));
    setHistory((h) => h.slice(0, -1));
  };
  const redo = () => {
    if (!future.length) return;
    const before = current.current;
    setHistory((h) => [...h, before]);
    setDesign(future[0]);
    setFuture((f) => f.slice(1));
  };
  const remove = () => {
    commit({
      ...design,
      layers: design.layers.filter((l: any) => l.id !== selected),
    });
    setSelected("");
  };
  const moveOrder = (delta: number) => {
    const layers = [...design.layers],
      i = layers.findIndex((l: any) => l.id === selected),
      j = i + delta;
    if (j < 0 || j >= layers.length) return;
    [layers[i], layers[j]] = [layers[j], layers[i]];
    commit({ ...design, layers });
  };
  return (
    <div
      className="textile-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Atelier de camisetas"
      tabIndex={-1}
      ref={dialog}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
        if (e.key === "Tab") {
          const els = Array.from(
            dialog.current!.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled),textarea,select,[tabindex="0"]',
            ),
          ).filter((el) => el.offsetParent !== null);
          const first = els[0],
            last = els.at(-1);
          if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === dialog.current)
          ) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <header className="textile-header">
        <button className="text" onClick={close}>
          <ArrowLeft size={18} />
          Volver
        </button>
        <div className="textile-wordmark">
          yenze <span>ATELIER / 01</span>
        </div>
        <button
          className="primary"
          disabled={working}
          onClick={() => apply(validatePrint(design))}
        >
          Usar este diseño <Check size={16} />
        </button>
      </header>
      <div className="textile-workspace">
        <aside className="textile-tools">
          <span className="eyebrow">HECHO POR TI</span>
          <h1>
            Una prenda.
            <br />
            Tu expresión.
          </h1>
          <p>Añade algo tuyo. Muévelo sobre la camiseta.</p>
          <div className="textile-add">
            <button
              disabled={design.layers.length >= 20}
              onClick={() => add({})}
            >
              <Type size={21} />
              Añadir texto
            </button>
            <button
              disabled={working || design.layers.length >= 20}
              onClick={() => file.current?.click()}
            >
              <ImagePlus size={21} />
              {working ? "Preparando…" : "Subir imagen"}
            </button>
          </div>
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Imagen para la camiseta"
            hidden
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <small>
            También puedes soltar una imagen sobre la prenda. PNG, JPG o WebP ·
            hasta {printLimitMB} MB.
          </small>
          <div className="textile-layer-list">
            <span className="eyebrow">
              {side === "front" ? "FRONTAL" : "ESPALDA"} · {visible.length}{" "}
              ELEMENTOS
            </span>
            {!visible.length && (
              <p>Un lienzo en blanco. Empieza con un texto o una imagen.</p>
            )}
            {visible.map((l: any) => (
              <button
                key={l.id}
                className={selected === l.id ? "active" : ""}
                onClick={() => {
                  setSelected(l.id);
                  setOrbit(false);
                }}
              >
                {l.type === "text" ? (
                  <Type size={16} />
                ) : (
                  <ImagePlus size={16} />
                )}
                <span>
                  {l.type === "text" ? l.text || "Texto vacío" : "Imagen"}
                </span>
                <Move size={13} />
              </button>
            ))}
          </div>
          {layer && (
            <section
              className="textile-properties"
              aria-label="Propiedades del elemento"
            >
              {layer.type === "text" && (
                <>
                  <label>
                    Tu texto
                    <textarea
                      aria-label="Tu texto"
                      value={layer.text}
                      maxLength={100}
                      rows={3}
                      onChange={(e) => patch({ text: e.target.value })}
                    />
                  </label>
                  <div className="row">
                    <label>
                      Tipografía
                      <select
                        value={layer.font}
                        onChange={(e) => patch({ font: e.target.value })}
                      >
                        <option value="sans">Moderna</option>
                        <option value="serif">Editorial</option>
                        <option value="mono">Monoespaciada</option>
                      </select>
                    </label>
                    <label>
                      Tinta
                      <input
                        type="color"
                        value={layer.color}
                        onChange={(e) => patch({ color: e.target.value })}
                      />
                    </label>
                  </div>
                </>
              )}
              <label>
                Tamaño{" "}
                <input
                  type="range"
                  aria-label="Tamaño del diseño"
                  min=".08"
                  max=".95"
                  step=".01"
                  value={layer.width}
                  onChange={(e) => patch({ width: Number(e.target.value) })}
                />
              </label>
              <label>
                Giro · {layer.rotation}°
                <input
                  type="range"
                  aria-label="Giro del diseño"
                  min="-180"
                  max="180"
                  value={layer.rotation}
                  onChange={(e) => patch({ rotation: Number(e.target.value) })}
                />
              </label>
              <div className="textile-actions">
                <button
                  title="Duplicar"
                  aria-label="Duplicar elemento"
                  onClick={() =>
                    add({
                      ...layer,
                      id: undefined,
                      x: clamp(layer.x + 0.05),
                      y: clamp(layer.y + 0.05),
                    })
                  }
                >
                  <Copy size={17} />
                </button>
                <button
                  title="Al frente"
                  aria-label="Subir capa"
                  onClick={() => moveOrder(1)}
                >
                  <ArrowUp size={17} />
                </button>
                <button
                  title="Al fondo"
                  aria-label="Bajar capa"
                  onClick={() => moveOrder(-1)}
                >
                  <ArrowDown size={17} />
                </button>
                <button
                  title="Eliminar"
                  aria-label="Eliminar elemento"
                  onClick={remove}
                >
                  <Trash2 size={17} />
                </button>
                <button
                  className="text"
                  onClick={() => patch({ x: 0.5, y: 0.5 })}
                >
                  Centrar
                </button>
              </div>
            </section>
          )}
          {error && (
            <p role="alert" className="validation">
              {error}
            </p>
          )}
          <section className="print-quality" aria-label="Calidad de impresión">
            <strong>Tu zona de impresión</strong>
            <p>
              {quality.zone.widthMm} × {quality.zone.heightMm} mm ·{" "}
              {quality.zone.dpi} ppp
            </p>
            <small>
              Medidas propuestas por el comercio. La vista 3D es orientativa.
            </small>
            {quality.issues.length > 0 ? (
              <ul>
                {quality.issues.map((issue: any, i: number) => (
                  <li key={i}>{issue.message}</li>
                ))}
              </ul>
            ) : (
              <p>
                {design.layers.some((l: any) => l.type === "image")
                  ? "Imágenes con resolución suficiente para esta zona."
                  : "Los textos se exportan a la resolución de esta zona."}
              </p>
            )}
            <small>
              Los originales nuevos se conservan sin reducir. El taller recibe
              el archivo y su posición.
            </small>
          </section>
          <div className="textile-export">
            {m.personalization.model === "atelier-shirt-v2" && (
              <small>
                Modelo{" "}
                <a
                  href="https://sketchfab.com/3d-models/tshirt-5a21282b2e454d1696547148f617d3d0"
                  target="_blank"
                  rel="noreferrer"
                >
                  Tshirt · Tabbuso
                </a>{" "}
                ·{" "}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  CC BY 4.0
                </a>
                . Adaptado para Yenze.
              </small>
            )}
            <button
              className="text"
              onClick={async () => {
                try {
                  const canvas = await printCanvas(design, side, 1536, 2048);
                  const a = document.createElement("a");
                  a.download = `diseno-${side}.png`;
                  a.href = canvas.toDataURL("image/png");
                  a.click();
                } catch {
                  setError(
                    "No se pudo exportar el diseño. Revisa las imágenes.",
                  );
                }
              }}
            >
              <Download size={15} />
              Descargar diseño de esta cara
            </button>
            <small>
              Vista de diseño. La escala y resolución finales deben revisarse
              con tu imprenta.
            </small>
          </div>
        </aside>
        <main
          className="textile-stage"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void upload(e.dataTransfer.files[0]);
          }}
        >
          <div className="textile-stage-head">
            <span>{m.name}</span>
            <div>
              <button
                className="text"
                onClick={() => add({})}
                disabled={design.layers.length >= 20}
              >
                <Type size={16} />
                Texto
              </button>
              <button
                className="icon"
                aria-label="Deshacer diseño"
                disabled={!history.length}
                onClick={undo}
              >
                <Undo2 size={18} />
              </button>
              <button
                className="icon"
                aria-label="Rehacer diseño"
                disabled={!future.length}
                onClick={redo}
              >
                <Redo2 size={18} />
              </button>
            </div>
          </div>
          <Suspense fallback={<p className="loading">Preparando la prenda…</p>}>
            <Model
              m={m}
              s={{ ...s, $print: design }}
              printSide={orbit ? "orbit" : side}
              onPrintRegion={setRegion}
            />
          </Suspense>
          {!orbit && region && (
            <div
              className="print-region"
              style={region}
              aria-label="Zona de diseño"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setSelected("");
                  setInline(false);
                }
              }}
              onDoubleClick={(e) => {
                if (e.target === e.currentTarget && design.layers.length < 20) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  add({
                    x: clamp((e.clientX - rect.left) / rect.width),
                    y: clamp((e.clientY - rect.top) / rect.height),
                  });
                }
              }}
            >
              {!visible.length && (
                <button className="canvas-start-text" onClick={() => add({})}>
                  <Type size={22} />
                  <strong>Tu idea empieza aquí</strong>
                  <span>Haz clic para escribir</span>
                </button>
              )}
              <span className="print-region-label">ZONA DE DISEÑO</span>
              {visible.map((l: any) => (
                <button
                  key={l.id}
                  aria-label={
                    "Mover " + (l.type === "text" ? l.text : "imagen")
                  }
                  className={
                    "print-handle " + (selected === l.id ? "active" : "")
                  }
                  style={{
                    left: l.x * 100 + "%",
                    top: l.y * 100 + "%",
                    width: l.width * 100 + "%",
                    height: printLayerHeight(l) * 100 + "%",
                    transform: `translate(-50%,-50%) rotate(${l.rotation}deg)`,
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(l.id);
                      setInline(l.type === "text");
                      return;
                    }
                    if (
                      [
                        "ArrowLeft",
                        "ArrowRight",
                        "ArrowUp",
                        "ArrowDown",
                      ].includes(e.key)
                    ) {
                      e.preventDefault();
                      setSelected(l.id);
                      commit({
                        ...design,
                        layers: design.layers.map((a: any) =>
                          a.id === l.id
                            ? {
                                ...a,
                                x: clamp(
                                  a.x +
                                    (e.key === "ArrowRight"
                                      ? 0.01
                                      : e.key === "ArrowLeft"
                                        ? -0.01
                                        : 0),
                                ),
                                y: clamp(
                                  a.y +
                                    (e.key === "ArrowDown"
                                      ? 0.01
                                      : e.key === "ArrowUp"
                                        ? -0.01
                                        : 0),
                                ),
                              }
                            : a,
                        ),
                      });
                    }
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setSelected(l.id);
                    setInline(false);
                    e.currentTarget.setPointerCapture(e.pointerId);
                    drag.current = {
                      id: l.id,
                      x: e.clientX,
                      y: e.clientY,
                      start: current.current,
                      l,
                    };
                  }}
                  onPointerMove={(e) => {
                    const d = drag.current;
                    if (!d || d.id !== l.id) return;
                    setDesign({
                      ...d.start,
                      layers: d.start.layers.map((a: any) =>
                        a.id === d.id
                          ? {
                              ...a,
                              x: clamp(
                                d.l.x + (e.clientX - d.x) / region.width,
                              ),
                              y: clamp(
                                d.l.y + (e.clientY - d.y) / region.height,
                              ),
                            }
                          : a,
                      ),
                    });
                  }}
                  onPointerUp={(e) => {
                    if (!drag.current) return;
                    const d = drag.current;
                    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) {
                      setDesign(d.start);
                      setSelected(l.id);
                      setInline(l.type === "text");
                    } else {
                      const before = d.start;
                      setHistory((h) => [...h.slice(-29), before]);
                      setFuture([]);
                    }
                    drag.current = null;
                  }}
                  onPointerCancel={() => {
                    if (drag.current) setDesign(drag.current.start);
                    drag.current = null;
                  }}
                >
                  <span>{selected === l.id ? <Move size={15} /> : null}</span>
                </button>
              ))}
            </div>
          )}
          {!orbit && region && layer && layer.side === side && (
            <div
              className="canvas-edit-popover"
              role="region"
              aria-label="Editar sobre la camiseta"
              style={{
                left: Math.max(
                  12,
                  Math.min(
                    region.left + layer.x * region.width - 140,
                    region.left * 2 + region.width - 292,
                  ),
                ),
                top: Math.max(
                  65,
                  region.top +
                    layer.y * region.height -
                    (region.height * printLayerHeight(layer)) / 2 -
                    (inline ? 200 : 56),
                ),
              }}
            >
              {inline && layer.type === "text" && (
                <>
                  <textarea
                    ref={inlineInput}
                    aria-label="Texto sobre la camiseta"
                    placeholder="Escribe tu texto…"
                    maxLength={100}
                    rows={2}
                    value={layer.text}
                    onChange={(e) => patch({ text: e.target.value })}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Escape" ||
                        (e.key === "Enter" && !e.shiftKey)
                      ) {
                        e.preventDefault();
                        e.stopPropagation();
                        setInline(false);
                      }
                    }}
                  />
                  <div className="canvas-type-controls">
                    <select
                      aria-label="Tipografía sobre la camiseta"
                      value={layer.font}
                      onChange={(e) => patch({ font: e.target.value })}
                    >
                      <option value="sans">Moderna</option>
                      <option value="serif">Editorial</option>
                      <option value="mono">Monoespaciada</option>
                    </select>
                    <input
                      type="color"
                      aria-label="Color del texto sobre la camiseta"
                      value={layer.color}
                      onChange={(e) => patch({ color: e.target.value })}
                    />
                    <button
                      onClick={() => setInline(false)}
                      aria-label="Terminar de editar texto"
                    >
                      <Check size={17} />
                    </button>
                  </div>
                  <small>
                    Enter para terminar · Mayús+Enter para otra línea
                  </small>
                </>
              )}
              <div className="canvas-quick-actions">
                {layer.type === "text" && !inline && (
                  <button onClick={() => setInline(true)}>
                    <Type size={15} />
                    Editar texto
                  </button>
                )}
                <button
                  aria-label="Reducir elemento"
                  onClick={() =>
                    patch({ width: clamp(layer.width - 0.05, 0.08, 0.95) })
                  }
                >
                  −
                </button>
                <button
                  aria-label="Ampliar elemento"
                  onClick={() =>
                    patch({ width: clamp(layer.width + 0.05, 0.08, 0.95) })
                  }
                >
                  +
                </button>
                <button
                  aria-label="Duplicar desde el lienzo"
                  onClick={() =>
                    add({
                      ...layer,
                      x: clamp(layer.x + 0.05),
                      y: clamp(layer.y + 0.05),
                    })
                  }
                >
                  <Copy size={15} />
                </button>
                <button aria-label="Eliminar desde el lienzo" onClick={remove}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          )}
          <div className="textile-view-switch">
            {["front", "back"].map((v) => (
              <button
                key={v}
                className={!orbit && side === v ? "active" : ""}
                onClick={() => {
                  setSide(v);
                  setOrbit(false);
                  setSelected("");
                  setInline(false);
                }}
              >
                {v === "front" ? "Frontal" : "Espalda"}
              </button>
            ))}
            <button
              className={orbit ? "active" : ""}
              onClick={() => setOrbit(!orbit)}
            >
              <Rotate3D size={16} />
              Girar en 3D
            </button>
          </div>
          <p className="textile-stage-note">
            {orbit
              ? "Arrastra para explorar la prenda en 360°"
              : "Haz clic en un texto para editarlo · Arrastra para mover"}
          </p>
        </main>
      </div>
    </div>
  );
}
