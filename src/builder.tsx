import { useState, useEffect } from "react";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Box,
  Layers,
  Check,
  Upload,
  CornerDownRight,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import { effectOf, evaluate, hierarchy } from "../core/layers.mjs";
const uid = () => "n_" + crypto.randomUUID().replaceAll("-", "").slice(0, 14);
const title = (file: string) =>
  file.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
const labels: Record<string, string> = {
  choice: "Una elección (sin cambio visual)",
  layer: "Superponer una capa",
  image: "Mostrar una imagen",
  material: "Cambiar un material 3D",
  visibility: "Mostrar u ocultar una pieza",
};
export function descendants(groups: any[], id: string): string[] {
  return groups
    .filter((g) => g.parent?.group === id)
    .flatMap((g) => [g.id, ...descendants(groups, g.id)]);
}
export function BuilderPanel({
  m,
  change,
  s,
  setS,
  run,
  upload,
  folder,
  uploading,
  applyModel,
  photo,
  focus,
}: any) {
  const [section, setSection] = useState(
      m.kind === "form" ||
        m.groups.some((g: any) => effectOf(m, g) !== "choice")
        ? "choices"
        : "assets",
    ),
    [selected, setSelected] = useState(m.groups[0]?.id || ""),
    [message, setMessage] = useState(""),
    [removing, setRemoving] = useState<string | null>(null),
    [piece, setPiece] = useState("");
  useEffect(() => {
    if (!focus) return;
    const found = m.groups.find(
      (g: any) => g.material === focus || g.node === focus,
    );
    if (found) {
      setSelected(found.id);
      setSection("choices");
    } else {
      setPiece(focus);
      setSection("assets");
    }
  }, [focus]);
  const g = m.groups.find((g: any) => g.id === selected),
    three = ["model-3d", "scene-3d"].includes(m.kind);
  const select = (id: string, option: string | null) => {
    let value = { ...s, [id]: option };
    try {
      value = evaluate(m, value).selection;
    } catch {}
    setS(value);
  };
  const edit = (fn: (group: any) => void) =>
    change((v: any) => fn(v.groups.find((g: any) => g.id === selected)));
  const addGroup = (parent?: any, effect = "choice", target?: string) => {
    const id = uid(),
      o = uid();
    change((v: any) =>
      v.groups.push({
        id,
        label: parent ? "Nueva subopción" : "Nueva elección",
        order: v.groups.reduce(
          (a: number, g: any) => Math.max(a, g.order + 1),
          0,
        ),
        required: true,
        default: o,
        effect,
        parent: parent || null,
        ...(effect === "material"
          ? { material: target }
          : effect === "visibility"
            ? { node: target }
            : {}),
        options: [
          {
            id: o,
            label: effect === "visibility" ? "Incluido" : "Opción 1",
            priceDelta: 0,
            ...(effect === "material"
              ? { color: "#b6b9bc" }
              : effect === "visibility"
                ? { visible: true }
                : {}),
          },
        ],
      }),
    );
    setSelected(id);
    setSection("choices");
  };
  const readImages = async (files: File[], target?: any) => {
    if (!files.length) return;
    if (files.length > 100 || files.some((f) => f.size > 20 * 1024 * 1024))
      throw Error("Hasta 100 imágenes de 20 MB por importación.");
    const effect = target
      ? effectOf(m, target)
      : m.kind === "images-2d"
        ? "image"
        : "layer";
    const dims = [];
    for (const f of files) {
      const b = await createImageBitmap(f);
      dims.push({ width: b.width, height: b.height });
      b.close();
    }
    const hasLayers = m.groups.some(
      (g: any) =>
        effectOf(m, g) === "layer" &&
        g.options.some((o: any) => Object.keys(o.assets || {}).length),
    );
    const canvas = hasLayers ? m.canvas : dims[0];
    if (
      effect === "layer" &&
      dims.some((d) => d.width !== canvas.width || d.height !== canvas.height)
    )
      throw Error(
        "Las capas deben medir " +
          canvas.width +
          " × " +
          canvas.height +
          " px. Para fotografías de tamaños diferentes, usa «Desde mis imágenes».",
      );
    if (m.views.length > 1)
      throw Error(
        "Este producto tiene varias vistas. Usa «Reemplazar imagen» en cada vista o importa la carpeta completa.",
      );
    setMessage("Subiendo imágenes…");
    try {
      const options: any[] = [];
      for (let i = 0; i < files.length; i++) {
        setMessage(`Subiendo ${i + 1} de ${files.length}…`);
        const a = await upload(files[i]);
        options.push({
          id: uid(),
          label: title(files[i].name).slice(0, 80),
          priceDelta: 0,
          assets: { [m.views[0]]: a.id },
        });
      }
      const id = target?.id || uid();
      change((v: any) => {
        if (!target) {
          v.groups.push({
            id,
            label: effect === "image" ? "Elige tu versión" : "Acabado",
            order: v.groups.reduce(
              (a: number, g: any) => Math.max(a, g.order + 1),
              0,
            ),
            required: true,
            default: options[0].id,
            effect,
            options,
          });
          if (!hasLayers) v.canvas = canvas;
        } else {
          const group = v.groups.find((g: any) => g.id === target.id);
          const empty =
            group.options.length === 1 &&
            !Object.keys(group.options[0].assets || {}).length;
          group.options = empty ? options : [...group.options, ...options];
          if (empty) group.default = options[0].id;
          if (!hasLayers && effect === "layer") v.canvas = canvas;
        }
      });
      setSelected(id);
      setSection("choices");
      setMessage(
        "Imágenes listas. Cada archivo es una opción que puedes renombrar.",
      );
    } finally {
      setMessage("");
    }
  };
  const removeGroup = (id: string) => {
    const ids = new Set([id, ...descendants(m.groups, id)]);
    change((v: any) => {
      v.groups = v.groups.filter((g: any) => !ids.has(g.id));
      v.rules = v.rules.filter(
        (r: any) => !ids.has(r.when.group) && !ids.has(r.target.group),
      );
    });
    setS({});
    setSelected("");
    setRemoving(null);
  };
  const tree = (parent: string | null = null, depth = 0): any =>
    m.groups
      .filter((g: any) => (g.parent?.group || null) === parent)
      .sort((a: any, b: any) => a.order - b.order)
      .map((group: any) => {
        const parentGroup = m.groups.find(
          (p: any) => p.id === group.parent?.group,
        );
        const parentOption = parentGroup?.options.find(
          (o: any) => o.id === group.parent?.option,
        );
        return (
          <div key={group.id}>
            <button
              className={"tree-row " + (group.id === selected ? "current" : "")}
              style={{ paddingLeft: 12 + Math.min(depth, 5) * 17 }}
              onClick={() => setSelected(group.id)}
              draggable
              onDragStart={(e) =>
                e.dataTransfer.setData("application/yenze-group", group.id)
              }
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("application/yenze-group");
                if (!id || id === group.id) return;
                run(async () => {
                  const groups = structuredClone(m.groups),
                    node = groups.find((g: any) => g.id === id);
                  if (!node) return;
                  node.parent = {
                    group: group.id,
                    option: group.options[0].id,
                  };
                  hierarchy(groups);
                  change((v: any) => (v.groups = groups));
                });
              }}
            >
              {depth ? (
                <CornerDownRight size={14} />
              ) : (
                <SlidersHorizontal size={14} />
              )}
              <span>
                {group.label}
                {parentGroup && (
                  <small>
                    {parentOption
                      ? "Si " + parentGroup.label + " = " + parentOption.label
                      : "Dentro de " + parentGroup.label}
                  </small>
                )}
              </span>
              <small>{group.options.length}</small>
              <ChevronRight size={13} />
            </button>
            {tree(group.id, depth + 1)}
          </div>
        );
      });
  const move = (direction: number) => {
    const sorted = [...m.groups].sort((a: any, b: any) => a.order - b.order),
      index = sorted.findIndex((v: any) => v.id === g.id),
      next = index + direction;
    if (next < 0 || next >= sorted.length) return;
    [sorted[index], sorted[next]] = [sorted[next], sorted[index]];
    change((v: any) => {
      v.groups = sorted.map((g: any, i: number) => ({ ...g, order: i }));
    });
  };
  const object = m.objects?.find((o: any) => o.id === piece);
  const addPiece = (type: string) => {
    const id = uid();
    change((v: any) => {
      v.objects.push({
        id,
        name:
          ({ box: "Bloque", sphere: "Esfera", cylinder: "Cilindro" } as any)[
            type
          ] +
          " " +
          (v.objects.length + 1),
        type,
        color: "#c6bba9",
        size: [1, 1, 1],
        position: [0, 0.5, 0],
        rotation: 0,
      });
    });
    setPiece(id);
  };
  return (
    <div className="builder-panel">
      <div className="builder-switch">
        <button
          className={section === "assets" ? "active" : ""}
          onClick={() => setSection("assets")}
        >
          <Box size={15} /> Producto
        </button>
        <button
          className={section === "choices" ? "active" : ""}
          onClick={() => setSection("choices")}
        >
          <SlidersHorizontal size={15} /> Elecciones{" "}
          <small>{m.groups.length}</small>
        </button>
      </div>
      {section === "assets" ? (
        <>
          <label>
            Descripción para tus clientes
            <textarea
              maxLength={300}
              rows={3}
              value={m.description || ""}
              placeholder="Explica qué pueden personalizar y qué representa la imagen."
              onChange={(e) =>
                change((v: any) => {
                  v.description = e.target.value;
                })
              }
            />
          </label>
          {m.personalization && (
            <section className="print-settings">
              <h3>Zona de impresión</h3>
              <p>
                Confirma con tu taller la superficie real. Se conserva la
                proporción 3:4 del editor.
              </p>
              <label>
                Ancho (mm)
                <input
                  type="number"
                  min="20"
                  max="500"
                  step="1"
                  value={m.personalization.printZone?.widthMm ?? 285}
                  onChange={(e) =>
                    change((v: any) => {
                      const widthMm = Number(e.target.value);
                      v.personalization.printZone = {
                        widthMm,
                        heightMm: (widthMm * 4) / 3,
                        dpi: v.personalization.printZone?.dpi ?? 300,
                      };
                    })
                  }
                />
              </label>
              <small>
                Alto:{" "}
                {Math.round(
                  ((m.personalization.printZone?.widthMm ?? 285) * 4) / 3,
                )}{" "}
                mm
              </small>
              <label>
                Resolución objetivo
                <select
                  value={m.personalization.printZone?.dpi ?? 300}
                  onChange={(e) =>
                    change((v: any) => {
                      v.personalization.printZone = {
                        widthMm: 285,
                        heightMm: 380,
                        ...v.personalization.printZone,
                        dpi: Number(e.target.value),
                      };
                    })
                  }
                >
                  <option value={300}>300 ppp</option>
                  <option value={150}>150 ppp</option>
                </select>
              </label>
            </section>
          )}
          {m.kind === "form" && (
            <section className="form-design-settings">
              <span className="eyebrow">TU ESCAPARATE, SIN IMÁGENES</span>
              <label>
                Presentación
                <select
                  value={m.presentation?.layout || "editorial"}
                  onChange={(e) =>
                    change((v: any) => {
                      v.presentation = {
                        layout: e.target.value,
                        tone: v.presentation?.tone || "ink",
                      };
                    })
                  }
                >
                  <option value="editorial">
                    Editorial · resumen y elecciones
                  </option>
                  <option value="compact">
                    Compacta · ideal para insertar
                  </option>
                </select>
              </label>
              <label>
                Estilo
                <select
                  value={m.presentation?.tone || "ink"}
                  onChange={(e) =>
                    change((v: any) => {
                      v.presentation = {
                        layout: v.presentation?.layout || "editorial",
                        tone: e.target.value,
                      };
                    })
                  }
                >
                  <option value="ink">Tinta · azul profundo</option>
                  <option value="olive">Oliva · natural</option>
                  <option value="plum">Ciruela · editorial</option>
                </select>
              </label>
              <small>
                Se aplica a la página pública y al configurador insertado en tu
                web.
              </small>
            </section>
          )}
          <span className="eyebrow">01 · DALE FORMA</span>
          <h2>
            {m.kind === "form"
              ? "Empieza sin imágenes."
              : m.kind === "scene-3d"
                ? "Construye pieza a pieza."
                : m.kind === "model-3d"
                  ? "Tu modelo, listo para elegir."
                  : m.kind === "images-2d"
                    ? "Tus fotos ya son un comienzo."
                    : "Cada capa, una posibilidad."}
          </h2>
          <p>
            {m.kind === "images-2d"
              ? "Sube fotos de las variantes. El cliente verá la imagen de la opción que elija."
              : m.kind === "layers-2d"
                ? "Sube imágenes transparentes para construir tu producto por partes. Agrupa los acabados de cada pieza."
                : m.kind === "model-3d"
                  ? "Detectamos las piezas y los materiales que contiene tu archivo. Tú decides qué puede cambiar el cliente."
                  : "Empieza con formas, ajusta sus medidas y combínalas. También puedes partir de una composición editable."}
          </p>
          {m.kind === "form" && (
            <div className="no-assets-start">
              <Check size={22} />
              <h3>Tu ficha ya funciona sin fotos.</h3>
              <p>
                El cliente podrá elegir, ver su resumen y solicitar un
                presupuesto. Cuando tengas imágenes, añádelas aquí.
              </p>
              <button
                className="button"
                onClick={() => change((v: any) => (v.kind = "images-2d"))}
              >
                <ImageIcon size={16} /> Ahora quiero añadir fotos
              </button>
            </div>
          )}
          {!three && m.kind !== "form" && (
            <>
              <label
                className="drop-zone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  run(() => readImages(Array.from(e.dataTransfer.files)));
                }}
              >
                <ImageIcon size={28} />
                <strong>
                  {m.kind === "images-2d"
                    ? "Arrastra tus fotos aquí"
                    : "Arrastra las variantes de una capa"}
                </strong>
                <span>o selecciona varios archivos · PNG, WebP, JPG</span>
                <input
                  aria-label="Subir imágenes del producto"
                  type="file"
                  multiple
                  accept="image/png,image/webp,image/jpeg"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    run(() => readImages(files));
                    e.target.value = "";
                  }}
                />
              </label>
              {m.kind === "layers-2d" && (
                <details className="builder-details">
                  <summary>Ya tengo una carpeta organizada</summary>
                  <p>
                    01_grupo/opcion/frontal.png. Todas las capas con las mismas
                    vistas y dimensiones. Sustituye el contenido del borrador;
                    puedes deshacer.
                  </p>
                  <input
                    aria-label="Importar carpeta de capas"
                    type="file"
                    multiple
                    {...({ webkitdirectory: "" } as any)}
                    onChange={(e) =>
                      run(() => folder(Array.from(e.target.files || [])))
                    }
                  />
                  <small>{uploading}</small>
                </details>
              )}
              <div className="source-summary">
                <Layers size={17} />
                <span>
                  {
                    m.groups.filter((g: any) =>
                      ["layer", "image"].includes(effectOf(m, g)),
                    ).length
                  }{" "}
                  grupos visuales · {m.views.length} vistas
                </span>
              </div>
            </>
          )}
          {m.kind === "model-3d" && !m.personalization && (
            <>
              <label className="drop-zone">
                <Upload size={26} />
                <strong>
                  {m.model ? "Reemplazar modelo 3D" : "Subir mi modelo 3D"}
                </strong>
                <span>GLB autocontenido · hasta 20 MB</span>
                <input
                  aria-label="Subir modelo GLB"
                  type="file"
                  accept=".glb"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file)
                      run(async () => {
                        const a = await upload(file);
                        applyModel(a);
                        setMessage(
                          `Modelo reconocido: ${a.materials.length} materiales y ${a.nodes?.length || 0} piezas.`,
                        );
                      });
                  }}
                />
              </label>
              {m.model && (
                <>
                  <div className="recognition">
                    <Check size={18} />
                    <div>
                      <strong>Modelo reconocido</strong>
                      <small>
                        {m.modelInfo?.materials?.length ?? m.groups.length}{" "}
                        materiales · {m.modelInfo?.nodes?.length || 0} piezas
                        detectadas
                      </small>
                    </div>
                  </div>
                  <details className="builder-details" open>
                    <summary>Qué puede configurar el cliente</summary>
                    {(
                      m.modelInfo?.materials ||
                      m.groups
                        .filter((g: any) => g.material)
                        .map((g: any) => g.material)
                    ).map((name: string) => (
                      <div className="detected-row" key={name}>
                        <span>
                          {name}
                          <small>Material</small>
                        </span>
                        <button
                          className="text"
                          onClick={() => {
                            const existing = m.groups.find(
                              (g: any) => g.material === name,
                            );
                            if (existing) {
                              setSelected(existing.id);
                              setSection("choices");
                            } else addGroup(undefined, "material", name);
                          }}
                        >
                          Editar colores <ChevronRight size={13} />
                        </button>
                      </div>
                    ))}
                    {m.modelInfo?.nodes?.map((node: any) => (
                      <div className="detected-row" key={node.name}>
                        <span>
                          {node.label}
                          <small>Pieza</small>
                        </span>
                        <button
                          className="text"
                          onClick={() =>
                            addGroup(undefined, "visibility", node.name)
                          }
                        >
                          Hacer opcional <Plus size={13} />
                        </button>
                      </div>
                    ))}
                  </details>
                  <p className="help-note">
                    Detectar un modelo significa leer sus piezas y materiales.
                    Un objeto exportado como una sola malla sigue siendo una
                    sola pieza.
                  </p>
                </>
              )}
              {photo}
            </>
          )}
          {m.kind === "scene-3d" && (
            <>
              <div className="primitive-buttons">
                {[
                  ["box", "Bloque"],
                  ["sphere", "Esfera"],
                  ["cylinder", "Cilindro"],
                ].map(([type, name]) => (
                  <button
                    className="button"
                    key={type}
                    onClick={() => addPiece(type)}
                  >
                    <Plus size={14} />
                    {name}
                  </button>
                ))}
              </div>
              {!m.objects.length && (
                <button
                  className="starter-scene"
                  onClick={() => {
                    change((v: any) => {
                      v.objects = [
                        {
                          id: uid(),
                          name: "Tablero",
                          type: "box",
                          color: "#c9b38f",
                          size: [1.6, 0.08, 0.8],
                          position: [0, 0.76, 0],
                          rotation: 0,
                        },
                        ...[-0.68, 0.68].flatMap((x) =>
                          [-0.28, 0.28].map((z) => ({
                            id: uid(),
                            name: "Pata " + x + " " + z,
                            type: "cylinder",
                            color: "#354454",
                            size: [0.06, 0.72, 0.06],
                            position: [x, 0.36, z],
                            rotation: 0,
                          })),
                        ),
                      ];
                    });
                  }}
                >
                  <Box />
                  <span>
                    Empezar con una mesa editable
                    <small>Cinco piezas. Todas las medidas son tuyas.</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              )}
              <div className="piece-list">
                {m.objects.map((o: any) => (
                  <button
                    key={o.id}
                    className={piece === o.id ? "active" : ""}
                    onClick={() => setPiece(o.id)}
                  >
                    <i style={{ background: o.color }} />
                    {o.name}
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
              {object && (
                <div className="piece-inspector">
                  <label>
                    Nombre de la pieza
                    <input
                      value={object.name}
                      onChange={(e) =>
                        change(
                          (v: any) =>
                            (v.objects.find((o: any) => o.id === piece).name =
                              e.target.value),
                        )
                      }
                    />
                  </label>
                  <label>
                    Color
                    <input
                      type="color"
                      value={object.color}
                      onChange={(e) =>
                        change(
                          (v: any) =>
                            (v.objects.find((o: any) => o.id === piece).color =
                              e.target.value),
                        )
                      }
                    />
                  </label>
                  {[
                    ["size", "Medidas (metros)"],
                    ["position", "Posición (metros)"],
                  ].map(([field, label]) => (
                    <div key={field}>
                      <label>{label}</label>
                      <div className="xyz">
                        {["X", "Y", "Z"].map((axis, i) => (
                          <label key={axis}>
                            {axis}
                            <input
                              aria-label={label + " " + axis}
                              type="number"
                              step="0.01"
                              min={field === "size" ? 0.01 : -100}
                              max={field === "size" ? 20 : 100}
                              value={object[field][i]}
                              onChange={(e) =>
                                change(
                                  (v: any) =>
                                    (v.objects.find((o: any) => o.id === piece)[
                                      field
                                    ][i] = Number(e.target.value)),
                                )
                              }
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <label>
                    Giro (grados)
                    <input
                      type="number"
                      min="-360"
                      max="360"
                      value={object.rotation}
                      onChange={(e) =>
                        change(
                          (v: any) =>
                            (v.objects.find(
                              (o: any) => o.id === piece,
                            ).rotation = Number(e.target.value)),
                        )
                      }
                    />
                  </label>
                  <button
                    className="button"
                    onClick={() => addGroup(undefined, "material", piece)}
                  >
                    Permitir elegir su color
                  </button>
                  <button
                    className="text"
                    onClick={() => addGroup(undefined, "visibility", piece)}
                  >
                    Permitir añadir o quitar esta pieza
                  </button>
                  <button
                    className="text danger"
                    onClick={() => {
                      change((v: any) => {
                        v.objects = v.objects.filter(
                          (o: any) => o.id !== piece,
                        );
                        const remove = new Set(
                          v.groups
                            .filter(
                              (g: any) =>
                                g.material === piece || g.node === piece,
                            )
                            .flatMap((g: any) => [
                              g.id,
                              ...descendants(v.groups, g.id),
                            ]),
                        );
                        v.groups = v.groups.filter(
                          (g: any) => !remove.has(g.id),
                        );
                        v.rules = v.rules.filter(
                          (r: any) =>
                            !remove.has(r.when.group) &&
                            !remove.has(r.target.group),
                        );
                      });
                      setPiece("");
                      setS({});
                    }}
                  >
                    <Trash2 size={14} /> Eliminar pieza y opciones vinculadas
                  </button>
                </div>
              )}
              <p className="help-note">
                Este constructor permite composiciones con formas y medidas.
                Para geometría compleja, importa un modelo preparado en tu
                herramienta 3D.
              </p>
            </>
          )}
          {message && (
            <p role="status" className="success">
              {message}
            </p>
          )}
          <button
            className="primary full"
            onClick={() => setSection("choices")}
          >
            Ahora, qué podrá elegir el cliente <ChevronRight size={17} />
          </button>
        </>
      ) : (
        <>
          <div className="builder-heading">
            <div>
              <span className="eyebrow">02 · DISEÑA LAS ELECCIONES</span>
              <h2>Un camino, muchas posibilidades.</h2>
            </div>
            <button
              className="icon"
              aria-label="Añadir elección"
              onClick={() => addGroup()}
            >
              <Plus />
            </button>
          </div>
          <p>
            Añade una elección y define qué cambia. Dentro de cada opción puedes
            crear otra elección.
          </p>
          <div className="option-tree">
            {tree()}
            {!m.groups.length && (
              <button className="tree-empty" onClick={() => addGroup()}>
                <Plus />
                <strong>Tu primera elección</strong>
                <small>Material, tamaño, acabado, extras…</small>
              </button>
            )}
          </div>
          <button className="text" onClick={() => addGroup()}>
            <Plus size={15} /> Añadir elección principal
          </button>
          {g && (
            <div className="choice-inspector">
              <div className="row">
                <span className="eyebrow">EDITANDO ESTA ELECCIÓN</span>
                <div>
                  <button
                    aria-label="Subir elección"
                    className="icon"
                    onClick={() => move(-1)}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    aria-label="Bajar elección"
                    className="icon"
                    onClick={() => move(1)}
                  >
                    <ArrowDown size={15} />
                  </button>
                  <button
                    aria-label="Eliminar elección"
                    className="icon danger"
                    onClick={() => setRemoving(g.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <label>
                ¿Qué elige el cliente?
                <input
                  aria-label="Nombre del grupo"
                  value={g.label}
                  onChange={(e) => edit((v) => (v.label = e.target.value))}
                  placeholder="Por ejemplo: Material"
                />
              </label>
              <label>
                ¿Qué cambia al elegir?
                <select
                  value={effectOf(m, g)}
                  onChange={(e) => {
                    const effect = e.target.value;
                    edit((v) => {
                      v.effect = effect;
                      v.options = v.options.map((o: any) => ({
                        ...o,
                        ...(effect === "material"
                          ? { color: o.color || "#b6b9bc" }
                          : effect === "visibility"
                            ? { visible: o.visible ?? true }
                            : {}),
                      }));
                      if (effect === "material")
                        v.material =
                          m.kind === "scene-3d"
                            ? m.objects[0]?.id
                            : m.modelInfo?.materials?.[0];
                      if (effect === "visibility")
                        v.node =
                          m.kind === "scene-3d"
                            ? m.objects[0]?.id
                            : m.modelInfo?.nodes?.[0]?.name;
                    });
                  }}
                >
                  {Object.entries(labels)
                    .filter(([type]) =>
                      m.kind === "form"
                        ? type === "choice"
                        : three
                          ? ["choice", "material", "visibility"].includes(type)
                          : ["choice", "image", "layer"].includes(type),
                    )
                    .map(([type, label]) => (
                      <option key={type} value={type}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              {["material", "visibility"].includes(effectOf(m, g)) && (
                <label>
                  {effectOf(m, g) === "material"
                    ? "Material que cambia"
                    : "Pieza que cambia"}
                  <select
                    value={
                      (effectOf(m, g) === "material" ? g.material : g.node) ||
                      ""
                    }
                    onChange={(e) =>
                      edit(
                        (v) =>
                          (v[
                            effectOf(m, g) === "material" ? "material" : "node"
                          ] = e.target.value),
                      )
                    }
                  >
                    <option value="">Selecciona una pieza o material</option>
                    {(m.kind === "scene-3d"
                      ? m.objects.map((o: any) => ({ id: o.id, label: o.name }))
                      : effectOf(m, g) === "material"
                        ? (m.modelInfo?.materials || [g.material])
                            .filter(Boolean)
                            .map((n: string) => ({ id: n, label: n }))
                        : (m.modelInfo?.nodes || []).map((n: any) => ({
                            id: n.name,
                            label: n.label,
                          }))
                    ).map((n: any) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <details className="builder-details" open={!!g.parent}>
                <summary>
                  {g.parent
                    ? "Cuándo aparece esta subopción"
                    : "Mostrar siempre o dentro de otra opción"}
                </summary>
                <label>
                  Elección padre
                  <select
                    value={g.parent?.group || ""}
                    onChange={(e) =>
                      edit(
                        (v) =>
                          (v.parent = e.target.value
                            ? { group: e.target.value, option: null }
                            : null),
                      )
                    }
                  >
                    <option value="">Siempre · nivel principal</option>
                    {m.groups
                      .filter(
                        (p: any) =>
                          p.id !== g.id &&
                          !descendants(m.groups, g.id).includes(p.id),
                      )
                      .map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                  </select>
                </label>
                {g.parent && (
                  <label>
                    Mostrar cuando el cliente elija
                    <select
                      value={g.parent.option || ""}
                      onChange={(e) =>
                        edit((v) => (v.parent.option = e.target.value || null))
                      }
                    >
                      <option value="">Cualquier opción del padre</option>
                      {m.groups
                        .find((p: any) => p.id === g.parent.group)
                        ?.options.map((o: any) => (
                          <option value={o.id} key={o.id}>
                            {o.label}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </details>
              <div className="section-title">
                <h3>Sus opciones</h3>
                <small>{g.options.length}</small>
              </div>
              {g.options.map((o: any, i: number) => (
                <div className="builder-option" key={o.id}>
                  <div className="option-top">
                    <button
                      className={
                        "option-indicator " +
                        ((s[g.id] ?? g.default) === o.id ? "selected" : "")
                      }
                      aria-label={"Vista previa " + o.label}
                      onClick={() => select(g.id, o.id)}
                    >
                      {(s[g.id] ?? g.default) === o.id ? (
                        <Check size={13} />
                      ) : (
                        i + 1
                      )}
                    </button>
                    <input
                      aria-label="Nombre de opción"
                      value={o.label}
                      onChange={(e) =>
                        edit((v) => (v.options[i].label = e.target.value))
                      }
                    />
                    <button
                      className="icon"
                      aria-label={"Eliminar opción " + o.label}
                      disabled={g.options.length === 1}
                      onClick={() => {
                        const branch = m.groups.filter(
                          (v: any) =>
                            v.parent?.group === g.id &&
                            v.parent.option === o.id,
                        );
                        if (branch.length) {
                          setMessage(
                            "Esta opción contiene subopciones. Muévelas o elimina sus elecciones antes.",
                          );
                          return;
                        }
                        change((v: any) => {
                          const group = v.groups.find(
                            (v: any) => v.id === g.id,
                          );
                          group.options = group.options.filter(
                            (v: any) => v.id !== o.id,
                          );
                          if (group.default === o.id)
                            group.default = group.options[0].id;
                          v.rules = v.rules.filter(
                            (r: any) =>
                              !(
                                r.when.group === g.id && r.when.option === o.id
                              ) &&
                              !(
                                r.target.group === g.id &&
                                r.target.option === o.id
                              ),
                          );
                        });
                        setS({});
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="option-fields">
                    <label>
                      Suplemento (€)
                      <input
                        aria-label={"Suplemento " + o.label}
                        type="number"
                        min="0"
                        step="0.01"
                        value={o.priceDelta / 100}
                        onChange={(e) =>
                          edit(
                            (v) =>
                              (v.options[i].priceDelta = Math.round(
                                Number(e.target.value) * 100,
                              )),
                          )
                        }
                      />
                    </label>
                    {effectOf(m, g) === "material" && (
                      <label>
                        Color
                        <input
                          aria-label="Color de opción"
                          type="color"
                          value={o.color || "#b6b9bc"}
                          onChange={(e) =>
                            edit((v) => (v.options[i].color = e.target.value))
                          }
                        />
                      </label>
                    )}
                    {effectOf(m, g) === "visibility" && (
                      <label>
                        La pieza
                        <select
                          value={String(o.visible)}
                          onChange={(e) =>
                            edit(
                              (v) =>
                                (v.options[i].visible =
                                  e.target.value === "true"),
                            )
                          }
                        >
                          <option value="true">Se muestra</option>
                          <option value="false">Se oculta</option>
                        </select>
                      </label>
                    )}
                  </div>
                  {["layer", "image"].includes(effectOf(m, g)) && (
                    <div className="option-images">
                      {m.views.map((view: string) => (
                        <label key={view} className="option-image">
                          {o.assets?.[view] ? (
                            <img src={"/api/assets/" + o.assets[view]} />
                          ) : (
                            <ImageIcon size={24} />
                          )}
                          <span>
                            {o.assets?.[view] ? "Reemplazar" : "Subir"} · {view}
                          </span>
                          <input
                            aria-label={"Imagen de " + o.label + " " + view}
                            type="file"
                            accept="image/png,image/webp,image/jpeg"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f)
                                run(async () => {
                                  const a = await upload(f);
                                  if (
                                    effectOf(m, g) === "layer" &&
                                    (a.width !== m.canvas.width ||
                                      a.height !== m.canvas.height)
                                  )
                                    throw Error(
                                      "La capa debe medir " +
                                        m.canvas.width +
                                        " × " +
                                        m.canvas.height +
                                        " px.",
                                    );
                                  edit((v) => {
                                    v.options[i].assets = {
                                      ...v.options[i].assets,
                                      [view]: a.id,
                                    };
                                  });
                                });
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                  <button
                    className="add-child"
                    onClick={() => addGroup({ group: g.id, option: o.id })}
                  >
                    <CornerDownRight size={15} /> Añadir subopción a «{o.label}»
                  </button>
                </div>
              ))}
              <button
                className="button full"
                onClick={() => {
                  edit((v) =>
                    v.options.push({
                      id: uid(),
                      label: "Opción " + (v.options.length + 1),
                      priceDelta: 0,
                      ...(effectOf(m, g) === "material"
                        ? { color: "#b6b9bc" }
                        : effectOf(m, g) === "visibility"
                          ? { visible: false }
                          : {}),
                    }),
                  );
                }}
              >
                {" "}
                <Plus size={15} />{" "}
                {effectOf(m, g) === "material"
                  ? "Añadir color"
                  : "Añadir opción"}
              </button>
              {["layer", "image"].includes(effectOf(m, g)) && (
                <label className="upload-small">
                  Añadir varias opciones desde imágenes
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/webp,image/jpeg"
                    onChange={(e) =>
                      run(() => readImages(Array.from(e.target.files || []), g))
                    }
                  />
                </label>
              )}
              <label>
                Seleccionada al empezar
                <select
                  value={g.default}
                  onChange={(e) => edit((v) => (v.default = e.target.value))}
                >
                  {g.options.map((o: any) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={g.required}
                  onChange={(e) => edit((v) => (v.required = e.target.checked))}
                />{" "}
                El cliente debe elegir una opción
              </label>
              {message && (
                <p role="status" className="help-note">
                  {message}
                </p>
              )}
            </div>
          )}
          <div className="base-price">
            <label>
              Precio base del producto (€)
              <input
                type="number"
                min="0"
                step="0.01"
                value={m.basePrice / 100}
                onChange={(e) =>
                  change(
                    (v: any) =>
                      (v.basePrice = Math.round(Number(e.target.value) * 100)),
                  )
                }
              />
            </label>
            <small>
              Se suman solo las opciones de la rama que elija el cliente.
            </small>
          </div>
        </>
      )}
      {removing && (
        <div
          className="inline-confirm"
          role="alertdialog"
          aria-label="Eliminar elección"
        >
          <strong>¿Eliminar esta elección?</strong>
          <p>
            También se quitarán sus {descendants(m.groups, removing).length}{" "}
            elecciones hijas y las reglas vinculadas. Puedes deshacerlo.
          </p>
          <button className="primary" onClick={() => removeGroup(removing)}>
            Eliminar elección y sus hijos
          </button>
          <button className="text" onClick={() => setRemoving(null)}>
            Conservar
          </button>
        </div>
      )}
    </div>
  );
}

export function LiveChoices({ m, s, onSelect }: any) {
  let r: any;
  try {
    r = evaluate(m, s);
  } catch {
    return <p>Revisa la estructura del producto.</p>;
  }
  const money = (n: number) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(n / 100);
  return (
    <>
      {hierarchy(m.groups)
        .filter((g: any) => r.visibleGroups.includes(g.id))
        .map((g: any, i: number) => (
          <section
            className={"buyer-group " + (g.parent ? "nested-choice" : "")}
            key={g.id}
          >
            <h3>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {g.label}
            </h3>
            {g.parent && (
              <small className="branch-caption">
                {
                  m.groups
                    .find((p: any) => p.id === g.parent.group)
                    ?.options.find(
                      (o: any) => o.id === r.selection[g.parent.group],
                    )?.label
                }
              </small>
            )}
            <div className="choices">
              {g.options.map((o: any) => (
                <button
                  key={o.id}
                  aria-pressed={r.selection[g.id] === o.id}
                  className={r.selection[g.id] === o.id ? "chosen" : ""}
                  onClick={() => onSelect(g.id, o.id)}
                >
                  {o.assets?.[m.views[0]] ? (
                    <img
                      className="choice-thumb"
                      src={"/api/assets/" + o.assets[m.views[0]]}
                    />
                  ) : (
                    o.color && <i style={{ background: o.color }} />
                  )}
                  <span>
                    {o.label}
                    <small>
                      {o.priceDelta ? "+" + money(o.priceDelta) : "Incluido"}
                    </small>
                  </span>
                  {r.selection[g.id] === o.id && <Check size={15} />}
                </button>
              ))}
              {!g.required && (
                <button
                  className={r.selection[g.id] === null ? "chosen" : ""}
                  onClick={() => onSelect(g.id, null)}
                >
                  <span>No añadir</span>
                  {r.selection[g.id] === null && <Check size={15} />}
                </button>
              )}
            </div>
          </section>
        ))}
    </>
  );
}
