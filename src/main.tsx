import { downloadProduction } from "./production-download";
import { parentOrigin, useEmbed } from "./embed";
import { TextileButton } from "./textile";
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Plus,
  ArrowUpRight,
  ArrowLeft,
  Layers,
  SlidersHorizontal,
  ShoppingBag,
  Users,
  Settings,
  LayoutDashboard,
  LogOut,
  X,
  Check,
  Box,
  Copy,
  ExternalLink,
  Undo2,
  Redo2,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";
import "@fontsource-variable/dm-sans";
import { evaluate } from "../core/layers.mjs";
import { planLayers } from "../core/layers.mjs";
import "./style.css";
import { BuilderPanel, LiveChoices } from "./builder";
import Start from "./start";
import Landing from "./landing";
const money = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    n / 100,
  );
async function api(path: string, method = "GET", data?: any) {
  const r = await fetch("/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Workspace": localStorage.getItem("workspace") || "",
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const v = await r.json();
  if (!r.ok) throw Error(v.error || "No se pudo completar la operación");
  return v;
}
const go = (params: Record<string, string>) => {
  location.href = "/?" + new URLSearchParams(params);
};
function result(m: any, s: any): any {
  try {
    return evaluate(m, s);
  } catch {
    return {
      valid: false,
      total: null,
      layers: [],
      visibleGroups: [],
      selection: {},
      errors: ["Revisa las opciones"],
    };
  }
}
function Preview({
  m,
  s = {},
  view = "frontal",
  onPick,
}: {
  m: any;
  s?: any;
  view?: string;
  onPick?: (name: string) => void;
}) {
  const r = result(m, s);
  if (m.kind === "form") {
    const chosen = m.groups.filter(
      (g: any) =>
        Object.hasOwn(r.selection, g.id) && r.selection[g.id] !== null,
    );
    return (
      <div
        className={
          "summary-stage form-summary tone-" + (m.presentation?.tone || "ink")
        }
      >
        <div className="summary-masthead">
          <span className="eyebrow">UNA PROPUESTA A TU MEDIDA</span>
          <span className="summary-edition">01 / CONFIGURA</span>
        </div>
        <div className="summary-symbol">
          <span>{m.name.slice(0, 1).toUpperCase()}</span>
        </div>
        <h2>{m.name}</h2>
        <p>{m.description || "Cada elección hace que sea más tuyo."}</p>
        <div className="summary-selections">
          {chosen.map((g: any, i: number) => (
            <div key={g.id}>
              <span className="summary-index">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{g.label}</span>
              <strong>
                {g.options.find((o: any) => o.id === r.selection[g.id])?.label}
              </strong>
            </div>
          ))}
        </div>
        <div className="summary-estimate">
          <span>
            Tu selección
            <strong>
              {chosen.length} {chosen.length === 1 ? "detalle" : "detalles"} a
              tu medida
            </strong>
          </span>
          <b aria-live="polite">{r.valid ? money(r.total) : "—"}</b>
        </div>
        <small>
          El importe final y las condiciones se confirman al continuar.
        </small>
      </div>
    );
  }
  if (["model-3d", "scene-3d"].includes(m.kind))
    return <Model m={m} s={s} onPick={onPick} />;
  return (
    <div className="preview">
      {r.layers?.map((l: any, i: number) => (
        <img
          key={i}
          src={"/api/assets/" + (l.assets?.[view] || l.asset || l.src || "")}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ))}
      {!m.groups.length && (
        <div className="empty">
          <Layers />
          <p>Tu próxima idea empieza aquí.</p>
        </div>
      )}
    </div>
  );
}
function Model({ m, s, onPick }: any) {
  const [Component, setComponent] = useState<any>(null);
  useEffect(() => {
    import("./model").then((v) => setComponent(() => v.default));
  }, []);
  return Component ? (
    <Component m={m} s={s} onPick={onPick} />
  ) : (
    <div className="preview empty">Cargando visor 3D…</div>
  );
}
function Modal({ title, children, onClose }: any) {
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="Cerrar">
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function App() {
  const [me, setMe] = useState<any>(undefined),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [auth, setAuth] = useState(false);
  const q = new URLSearchParams(location.search),
    page = q.get("page") || "dashboard";
  const running = useRef(false);
  const run = async (fn: () => Promise<any>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      return await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const refresh = async () => {
    const v = await api("/me");
    if (
      v.organizations.length &&
      !v.organizations.some(
        (o: any) => o.id === localStorage.getItem("workspace"),
      )
    )
      localStorage.setItem("workspace", v.organizations[0].id);
    setMe(v);
  };
  useEffect(() => {
    run(refresh);
  }, []);
  const ctx = { me, run, notify: setNotice };
  if (me === undefined)
    return (
      <div className="loading">
        yenze<span>Preparando tu estudio…</span>
        {error && <p>{error}</p>}
      </div>
    );
  if (q.has("verify")) return <EmailVerification token={q.get("verify")!} />;
  const namedPath = location.pathname.match(
    /^\/p\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/,
  );
  if (namedPath) q.set("catalog", namedPath[1] + "/" + namedPath[2]);
  const publicView = q.has("product") || q.has("store") || q.has("catalog");
  const merchant = me.organizations.length > 0;
  const marketing =
    page === "home" ||
    (!me.user &&
      !publicView &&
      !q.has("reset") &&
      !["login", "signup", "portal"].includes(page));
  if (marketing) return <Landing loggedIn={!!me.user} />;
  return (
    <>
      <div
        className={
          publicView
            ? "public-shell"
            : q.has("edit")
              ? "shell editing-shell"
              : "shell"
        }
      >
        {!publicView && me.user && merchant && (
          <aside className="sidebar">
            <a className="logo" href="/">
              yenze<span>STUDIO</span>
            </a>
            <select
              aria-label="Empresa"
              value={localStorage.getItem("workspace") || ""}
              onChange={(e) => {
                localStorage.setItem("workspace", e.target.value);
                location.href = "/";
              }}
            >
              {me.organizations.map((o: any) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <nav>
              {[
                ["dashboard", "Tu estudio", LayoutDashboard],
                ["products", "Configuradores", Layers],
                ["orders", "Pedidos", ShoppingBag],
                ["customers", "Clientes", Users],
                ["settings", "Conexiones", Settings],
              ].map(([id, label, Icon]: any) => (
                <a
                  key={id}
                  className={page === id ? "active" : ""}
                  href={"/?page=" + id}
                >
                  <Icon size={19} />
                  {label}
                </a>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <a href="/?page=portal">
                Mi espacio de cliente <ArrowUpRight size={16} />
              </a>
              <button
                className="text"
                onClick={() =>
                  run(async () => {
                    await api("/auth/logout", "POST", {});
                    location.href = "/";
                  })
                }
              >
                <LogOut size={16} /> Cerrar sesión
              </button>
              <small>{me.user.email}</small>
            </div>
          </aside>
        )}
        <main>
          {me.user && me.emailConfigured && !me.emailVerified && (
            <div className="verification-banner">
              <span>Confirma tu correo para proteger tus pedidos.</span>
              <button
                className="text"
                onClick={() =>
                  run(async () => {
                    await api("/auth/verification", "POST", {});
                    setNotice(
                      "Te hemos enviado un enlace. Revisa tu correo y la carpeta de spam.",
                    );
                  })
                }
              >
                Enviarme un enlace
              </button>
            </div>
          )}
          {publicView ? (
            <Public {...ctx} q={q} login={() => setAuth(true)} />
          ) : q.has("reset") ? (
            <Auth {...ctx} reset={q.get("reset")} done={() => go({})} />
          ) : !me.user ? (
            <Auth {...ctx} done={refresh} />
          ) : !merchant || page === "portal" ? (
            <Portal {...ctx} />
          ) : page === "settings" ? (
            <SettingsPage {...ctx} />
          ) : page === "orders" ? (
            <Orders {...ctx} />
          ) : page === "customers" ? (
            <Customers {...ctx} />
          ) : q.has("edit") ? (
            <Editor {...ctx} id={q.get("edit")} />
          ) : (
            <Studio {...ctx} page={page} />
          )}
        </main>
      </div>
      {error && (
        <div className="toast error" role="alert">
          {error}
          <button onClick={() => setError("")}>
            <X size={17} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button onClick={() => setNotice("")}>
            <X size={17} />
          </button>
        </div>
      )}
      {busy && <div className="progress" />}
      {auth && (
        <Modal title="Guarda lo que imaginas" onClose={() => setAuth(false)}>
          <Auth
            {...ctx}
            compact
            done={async () => {
              await refresh();
              setAuth(false);
            }}
          />
        </Modal>
      )}
    </>
  );
}
function Auth({ run, done, compact = false, reset }: any) {
  const [signup, setSignup] = useState(
      !compact && new URLSearchParams(location.search).get("page") !== "login",
    ),
    [business, setBusiness] = useState(!compact),
    [forgot, setForgot] = useState(false),
    [sent, setSent] = useState(false);
  return (
    <div className={"auth " + (compact ? "compact" : "")}>
      {!compact && (
        <div className="auth-story">
          <a className="logo" href="/">
            yenze<span>STUDIO</span>
          </a>
          <div>
            <span className="eyebrow">DEL PRODUCTO A LA POSIBILIDAD</span>
            <h1>
              Tu producto.
              <br />
              Todas sus
              <br />
              <em>posibilidades.</em>
            </h1>
            <p>
              Crea experiencias que tus clientes puedan hacer suyas. Del primer
              acabado al último detalle.
            </p>
          </div>
          <span>Un estudio para crear. Un lugar para vender.</span>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const d = Object.fromEntries(new FormData(e.currentTarget));
          run(async () => {
            if (reset) {
              await api("/auth/reset", "POST", {
                token: reset,
                password: d.password,
              });
              go({});
              return;
            }
            if (forgot) {
              await api("/auth/forgot", "POST", d);
              setSent(true);
              return;
            }
            await api("/auth/" + (signup ? "signup" : "login"), "POST", {
              ...d,
              company: signup && business ? d.company : undefined,
            });
            await done();
          });
        }}
      >
        <span className="eyebrow">BIENVENIDO A TU SIGUIENTE IDEA</span>
        <h2>
          {reset
            ? "Una nueva contraseña"
            : forgot
              ? "Recupera tu acceso"
              : signup
                ? "Vamos a crear algo tuyo."
                : "Qué bien tenerte de vuelta."}
        </h2>
        <p>
          {reset
            ? "El enlace es válido durante 30 minutos."
            : forgot
              ? "Te enviaremos un enlace si existe una cuenta."
              : "Tus configuraciones, clientes y pedidos, en un mismo lugar."}
        </p>
        {sent ? (
          <p className="success">Revisa tu correo electrónico.</p>
        ) : (
          <>
            {signup && !forgot && !reset && (
              <>
                <label>
                  Tu nombre
                  <input name="name" required autoComplete="name" />
                </label>
                {!compact && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={business}
                      onChange={(e) => setBusiness(e.target.checked)}
                    />{" "}
                    Quiero crear configuradores para mi negocio
                  </label>
                )}
                {business && (
                  <label>
                    Nombre del negocio
                    <input name="company" required />
                  </label>
                )}
              </>
            )}
            {!reset && (
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                />
              </label>
            )}
            {!forgot && (
              <label>
                Contraseña
                <input
                  aria-label="Contraseña"
                  name="password"
                  type="password"
                  minLength={10}
                  maxLength={128}
                  required
                  autoComplete={signup ? "new-password" : "current-password"}
                />
                <small>Al menos 10 caracteres.</small>
              </label>
            )}
            <button className="primary" type="submit">
              {reset
                ? "Guardar contraseña"
                : forgot
                  ? "Enviar enlace"
                  : signup
                    ? "Crear mi espacio"
                    : "Entrar"}{" "}
              <ArrowUpRight size={19} />
            </button>
          </>
        )}
        {!reset && (
          <div className="auth-links">
            <button
              type="button"
              className="text"
              onClick={() => {
                setSignup(!signup);
                setForgot(false);
                setSent(false);
              }}
            >
              {signup ? "Ya tengo una cuenta" : "Crear una cuenta"}
            </button>
            <button
              type="button"
              className="text"
              onClick={() => setForgot(true)}
            >
              He olvidado mi contraseña
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
function Studio({ run, notify, page }: any) {
  const [products, setProducts] = useState<any[]>([]),
    [stats, setStats] = useState<any>({}),
    [templates, setTemplates] = useState<any[]>([]),
    [create, setCreate] = useState(
      new URLSearchParams(location.search).has("new"),
    ),
    [trash, setTrash] = useState<any[] | null>(null),
    [deleting, setDeleting] = useState<any>(null);
  useEffect(() => {
    run(async () => {
      const [p, s, t] = await Promise.all([
        api("/products"),
        api("/dashboard"),
        api("/templates"),
      ]);
      setProducts(p);
      setStats(s);
      setTemplates(t);
    });
  }, []);
  return (
    <div className="content">
      <header className="page-head">
        <div>
          <span className="eyebrow">TU ESTUDIO, EN MOVIMIENTO</span>
          <h1>
            {page === "products"
              ? "Hechos para elegir."
              : "Las buenas ideas toman forma."}
          </h1>
          <p>Cada producto, una experiencia propia.</p>
        </div>
        <button className="primary" onClick={() => setCreate(true)}>
          <Plus size={18} /> Crear configurador
        </button>
      </header>
      {page !== "products" && (
        <>
          <div className="metrics">
            {[
              ["Configuradores", stats.products || 0],
              ["Publicados", stats.published || 0],
              ["Presupuestos abiertos", stats.requests || 0],
              ["Ventas cobradas", money(stats.sales || 0)],
            ].map(([a, b]) => (
              <div key={a}>
                <small>{a}</small>
                <strong>{b}</strong>
              </div>
            ))}
          </div>
          <div className="banner">
            <div>
              <span className="eyebrow">MENOS PASOS. MÁS POSIBILIDADES.</span>
              <h2>
                Empieza con algo bien pensado.
                <br />
                Termina con algo completamente tuyo.
              </h2>
              <button className="text" onClick={() => setCreate(true)}>
                Explorar las plantillas <ArrowUpRight size={18} />
              </button>
            </div>
            <div className="sculpture">
              <div />
              <div />
              <div />
            </div>
          </div>
        </>
      )}
      <div className="section-title">
        <h2>
          Tus configuradores <small>{products.length}</small>
        </h2>
        <button
          className="text"
          onClick={() => run(async () => setTrash(await api("/trash")))}
        >
          <Trash2 size={14} /> Papelera
        </button>
      </div>
      <div className="product-grid">
        {products.map((p) => (
          <div key={p.id} className="product-card">
            <a href={"/?edit=" + p.id}>
              <div className="card-art">
                <Preview m={p.draft} />
                <span className={"badge " + (p.active ? "live" : "")}>
                  {p.active ? "Publicado" : "Borrador"}
                </span>
              </div>
              <div className="card-foot">
                <div>
                  <small>{p.niche}</small>
                  <h3>{p.name}</h3>
                  <span>Desde {money(p.draft.basePrice)}</span>
                </div>
                <ArrowUpRight />
              </div>
            </a>
            <div className="card-actions">
              <a className="text" href={"/?edit=" + p.id}>
                Abrir constructor <ArrowUpRight size={14} />
              </a>
              <button
                aria-label={"Eliminar " + p.name}
                className="icon danger"
                onClick={() => setDeleting(p)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        <button className="new-card" onClick={() => setCreate(true)}>
          <Plus />
          <h3>Una nueva posibilidad</h3>
          <span>Elige una plantilla o trae tus capas.</span>
        </button>
      </div>
      {create && (
        <Modal
          title="Crea algo que tus clientes hagan suyo"
          onClose={() => setCreate(false)}
        >
          <Start
            templates={templates}
            create={(template: string, setup?: any) =>
              run(async () => {
                const p = await api("/products", "POST", {
                  template,
                  name: setup?.name,
                  setup,
                });
                try {
                  sessionStorage.removeItem(
                    "yenze:start:" +
                      (localStorage.getItem("workspace") || "current"),
                  );
                } catch {}
                go({ edit: p.id });
              })
            }
          />
        </Modal>
      )}

      {deleting && (
        <Modal
          title="¿Eliminar este configurador?"
          onClose={() => setDeleting(null)}
        >
          <p>
            <strong>{deleting.name}</strong> dejará de estar publicado y pasará
            a la papelera. Los pedidos y configuraciones guardados se conservan.
            Puedes restaurarlo después.
          </p>
          <div className="row">
            <button className="button" onClick={() => setDeleting(null)}>
              Conservar
            </button>
            <button
              className="primary"
              onClick={() =>
                run(async () => {
                  await api("/products/" + deleting.id, "DELETE", {});
                  setProducts(products.filter((p) => p.id !== deleting.id));
                  setDeleting(null);
                  setStats(await api("/dashboard"));
                  notify("Configurador enviado a la papelera");
                })
              }
            >
              Eliminar configurador
            </button>
          </div>
        </Modal>
      )}
      {trash && (
        <Modal title="Papelera" onClose={() => setTrash(null)}>
          <p>
            Al restaurar, el configurador vuelve como borrador. Tú decides
            cuándo publicarlo de nuevo.
          </p>
          {!trash.length && (
            <div className="empty">La papelera está vacía.</div>
          )}
          {trash.map((p) => (
            <div className="connection" key={p.id}>
              <span>
                {p.name}
                <small>{new Date(p.deleted_at).toLocaleDateString("es")}</small>
              </span>
              <button
                className="button"
                onClick={() =>
                  run(async () => {
                    await api("/products/" + p.id + "/restore", "POST", {});
                    setProducts(await api("/products"));
                    setTrash(await api("/trash"));
                    notify("Configurador restaurado como borrador");
                  })
                }
              >
                Restaurar
              </button>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}
function Editor({ id, run, notify }: any) {
  const inspector = useRef<HTMLDivElement>(null);
  const manifestRef = useRef<any>(null),
    saving = useRef(false);
  const history = useRef<any[]>([]),
    future = useRef<any[]>([]);
  const [focus, setFocus] = useState("");
  const [p, setP] = useState<any>(null),
    [m, setM] = useState<any>(null),
    [s, setS] = useState<any>({}),
    [tab, setTab] = useState("options"),
    [view, setView] = useState("frontal"),
    [dirty, setDirty] = useState(false),
    [uploading, setUploading] = useState("");
  const updateManifest = (value: any) => {
    manifestRef.current = value;
    setM(value);
  };
  useEffect(() => {
    run(async () => {
      const v = await api("/products/" + id);
      setP(v);
      updateManifest(v.draft);
    });
  }, [id]);
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [dirty]);
  useEffect(() => {
    inspector.current?.scrollTo({ top: 0 });
  }, [tab]);
  if (!m) return <div className="loading">Abriendo tu producto…</div>;
  const change = (fn: (v: any) => void) => {
    const current = manifestRef.current;
    const v = structuredClone(current);
    history.current.push(structuredClone(current));
    if (history.current.length > 80) history.current.shift();
    future.current = [];
    fn(v);
    updateManifest(v);
    setDirty(true);
  };
  const save = async () => {
    if (saving.current) throw Error("Espera a que termine el guardado actual.");
    saving.current = true;
    const snapshot = manifestRef.current;
    try {
      const v = await api("/products/" + id, "PATCH", {
        revision: p.revision,
        manifest: snapshot,
        mode: p.mode,
      });
      setP(v);
      if (manifestRef.current === snapshot) {
        updateManifest(v.draft);
        setDirty(false);
      }
      return v;
    } finally {
      saving.current = false;
    }
  };
  const upload = async (file: File) => {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return api("/assets", "POST", { name: file.name, data });
  };
  const applyModel = (a: any) => {
    change((v) => {
      v.model = a.id;
      v.modelInfo = {
        materials: a.materials,
        nodes: a.nodes || [],
        triangles: a.triangles || 0,
      };
      const kept = v.groups.filter((g: any) => g.effect === "choice");
      const keptIds = new Set(kept.map((g: any) => g.id));
      for (const g of kept)
        if (g.parent && !keptIds.has(g.parent.group)) g.parent = null;
      v.rules = v.rules.filter(
        (r: any) => keptIds.has(r.when.group) && keptIds.has(r.target.group),
      );
      v.groups = [
        ...kept,
        ...a.materials
          .slice(0, 40 - kept.length)
          .map((material: string, i: number) => ({
            id:
              "material_" +
              crypto.randomUUID().replaceAll("-", "").slice(0, 10),
            label: material,
            material,
            order: kept.length + i,
            required: true,
            default: "original",
            options: [
              {
                id: "original",
                label: "Original",
                color: a.colors?.[material] || "#b6b9bc",
                priceDelta: 0,
              },
            ],
          })),
      ];
    });
    setS({});
  };
  const folder = async (files: File[]) => {
    if (!files.length) return;
    if (files.length > 500 || files.some((f) => f.size > 20 * 1024 * 1024))
      throw Error("Máximo 500 archivos de hasta 20 MB.");
    setUploading("Analizando las capas…");
    try {
      const root = files[0].webkitRelativePath.split("/")[0];
      const entries: any[] = [];
      for (const f of files.filter((f) => /\.(png|webp)$/i.test(f.name))) {
        const bitmap = await createImageBitmap(f);
        entries.push({
          file: f,
          path: f.webkitRelativePath.slice(root.length + 1),
          width: bitmap.width,
          height: bitmap.height,
        });
        bitmap.close();
      }
      const plan = planLayers(entries, {
        name: m.name,
        basePrice: m.basePrice,
      });
      const manifest = plan;
      const ids: Record<string, string> = {};
      for (let i = 0; i < entries.length; i++) {
        setUploading(`Subiendo ${i + 1} de ${entries.length} capas…`);
        ids[entries[i].path] = (await upload(entries[i].file)).id;
      }
      for (const g of manifest.groups)
        for (const o of g.options)
          for (const v in o.assets) o.assets[v] = ids[o.assets[v]];
      change((v) => {
        for (const key of Object.keys(v)) delete v[key];
        Object.assign(v, manifest);
      });
      setS({});
      setDirty(true);
      notify(
        "Capas importadas al borrador. Revisa los precios antes de publicar.",
      );
    } finally {
      setUploading("");
    }
  };
  const total = result(m, s);
  return (
    <div className="editor">
      <header className="editor-head">
        <a href="/?page=products" className="icon" aria-label="Volver">
          <ArrowLeft />
        </a>
        <div>
          <input
            aria-label="Nombre del producto"
            value={m.name}
            onChange={(e) => change((v) => (v.name = e.target.value))}
          />
          <small>
            {dirty
              ? "Cambios sin guardar"
              : `Borrador guardado · versión ${p.revision}`}
          </small>
        </div>
        <div className="head-actions">
          <button
            className="icon"
            aria-label="Deshacer"
            disabled={!history.current.length}
            onClick={() => {
              future.current.push(structuredClone(m));
              updateManifest(history.current.pop());
              setS({});
              setDirty(true);
            }}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon"
            aria-label="Rehacer"
            disabled={!future.current.length}
            onClick={() => {
              history.current.push(structuredClone(m));
              updateManifest(future.current.pop());
              setS({});
              setDirty(true);
            }}
          >
            <Redo2 size={17} />
          </button>
          {p.active && (
            <a
              className="button"
              target="_blank"
              href={p.publicPath || "/?product=" + id}
            >
              Ver publicado <ExternalLink size={15} />
            </a>
          )}
          <button
            className="button"
            onClick={() =>
              run(async () => {
                await save();
                notify("Borrador guardado");
              })
            }
          >
            Guardar
          </button>
          <button
            className="primary"
            onClick={() =>
              run(async () => {
                const v = dirty ? await save() : p;
                setP(
                  await api("/products/" + id + "/publish", "POST", {
                    revision: v.revision,
                  }),
                );
                notify("Configurador publicado. Ya puedes compartirlo.");
              })
            }
          >
            Publicar <ArrowUpRight size={17} />
          </button>
        </div>
      </header>
      <div className="editor-body">
        <section className="canvas">
          <div className="canvas-label">
            <span className="eyebrow">VISTA PREVIA INTERACTIVA</span>
            <span>
              {["model-3d", "scene-3d"].includes(m.kind)
                ? "3D · Arrastra para girar"
                : m.kind === "form"
                  ? "Ficha de producto · Sin imágenes"
                  : "2D · Vista previa en tiempo real"}
            </span>
          </div>
          <Preview
            m={m}
            s={s}
            view={view}
            onPick={(name) => {
              setFocus(name);
              setTab("options");
            }}
          />
          {m.personalization && (
            <TextileButton
              m={m}
              s={s}
              label="Diseñar la camiseta"
              productId={id}
              merchant
              onApply={(design: any) => {
                change((v: any) => {
                  v.personalization.design = design;
                });
                setS((old: any) => {
                  const next = { ...old };
                  delete next.$print;
                  return next;
                });
              }}
            />
          )}
          <div className="canvas-bottom">
            <div>
              {m.views.length > 1 &&
                m.views.map((v: string) => (
                  <button
                    className={view === v ? "selected" : "button"}
                    key={v}
                    onClick={() => setView(v)}
                  >
                    {v}
                  </button>
                ))}
            </div>
            <strong>
              {total.valid ? money(total.total) : "Revisa la combinación"}
            </strong>
          </div>
        </section>
        <aside className="inspector">
          <div className="tabs">
            {[
              ["options", "Construir"],
              ["test", "Probar"],
              ["rules", "Reglas"],
              ["publish", "Publicación"],
            ].map(([v, l]) => (
              <button
                key={v}
                className={tab === v ? "active" : ""}
                onClick={() => setTab(v)}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="inspector-content" ref={inspector}>
            {tab === "options" ? (
              <BuilderPanel
                m={m}
                change={change}
                s={s}
                setS={setS}
                run={run}
                upload={upload}
                folder={folder}
                uploading={uploading}
                applyModel={applyModel}
                focus={focus}
                photo={
                  <PhotoModel
                    productId={id}
                    run={run}
                    upload={upload}
                    apply={applyModel}
                  />
                }
              />
            ) : tab === "test" ? (
              <div className="test-panel">
                <span className="eyebrow">COMO LO VERÁ TU CLIENTE</span>
                <h2>Recorre las posibilidades.</h2>
                <p>
                  Prueba los padres y sus ramas antes de publicar. Las
                  elecciones ocultas no se cobran.
                </p>
                <LiveChoices
                  m={m}
                  s={s}
                  onSelect={(id: string, option: string | null) =>
                    setS(result(m, { ...s, [id]: option }).selection)
                  }
                />
                {!total.valid && (
                  <p className="validation">{total.errors.join(" ")}</p>
                )}
                <button className="text" onClick={() => setS({})}>
                  Volver a las opciones iniciales
                </button>
              </div>
            ) : tab === "rules" ? (
              <>
                <span className="eyebrow">COMBINACIONES CON SENTIDO</span>
                <h2>Guía sin complicar.</h2>
                <p>
                  Impide combinaciones incompatibles o exige una opción
                  concreta.
                </p>
                {m.rules.map((r: any, i: number) => (
                  <div className="rule" key={i}>
                    <label>
                      Cuando
                      <select
                        value={r.when.group + ":" + r.when.option}
                        onChange={(e) =>
                          change((v) => {
                            const [group, option] = e.target.value.split(":");
                            v.rules[i].when = { group, option };
                          })
                        }
                      >
                        {m.groups.flatMap((g: any) =>
                          g.options.map((o: any) => (
                            <option key={g.id + o.id} value={g.id + ":" + o.id}>
                              {g.label} · {o.label}
                            </option>
                          )),
                        )}
                      </select>
                    </label>
                    <select
                      value={r.type}
                      onChange={(e) =>
                        change((v) => (v.rules[i].type = e.target.value))
                      }
                    >
                      <option value="excludes">No permite</option>
                      <option value="requires">Necesita</option>
                    </select>
                    <select
                      value={r.target.group + ":" + r.target.option}
                      onChange={(e) =>
                        change((v) => {
                          const [group, option] = e.target.value.split(":");
                          v.rules[i].target = { group, option };
                        })
                      }
                    >
                      {m.groups.flatMap((g: any) =>
                        g.options.map((o: any) => (
                          <option key={g.id + o.id} value={g.id + ":" + o.id}>
                            {g.label} · {o.label}
                          </option>
                        )),
                      )}
                    </select>
                    <input
                      aria-label="Explicación de la regla"
                      placeholder="Explica esta regla al comprador"
                      value={r.message || ""}
                      onChange={(e) =>
                        change((v) => (v.rules[i].message = e.target.value))
                      }
                    />
                    <button
                      className="text"
                      onClick={() => change((v) => v.rules.splice(i, 1))}
                    >
                      Eliminar regla
                    </button>
                  </div>
                ))}
                <button
                  className="button"
                  disabled={m.groups.length < 2}
                  onClick={() =>
                    change((v) =>
                      v.rules.push({
                        type: "excludes",
                        when: {
                          group: v.groups[0].id,
                          option: v.groups[0].options[0].id,
                        },
                        target: {
                          group: v.groups[1].id,
                          option: v.groups[1].options[0].id,
                        },
                        message: "Esta combinación no está disponible.",
                      }),
                    )
                  }
                >
                  <Plus size={15} /> Añadir regla
                </button>
              </>
            ) : (
              <>
                <span className="eyebrow">LISTO PARA SALIR AL MUNDO</span>
                <h2>Tu producto, donde estén tus clientes.</h2>
                <label>
                  Al terminar la configuración
                  <select
                    value={p.mode}
                    onChange={(e) => {
                      setP({ ...p, mode: e.target.value });
                      setDirty(true);
                    }}
                  >
                    <option value="quote">Solicitar presupuesto</option>
                    <option value="purchase">Comprar con Stripe</option>
                  </select>
                </label>
                <p>
                  La compra directa requiere una cuenta Stripe conectada y
                  habilitada. El modo presupuesto funciona sin Stripe.
                </p>
                <label>
                  Enlace público
                  <input
                    readOnly
                    value={
                      location.origin + (p.publicPath || "/?product=" + id)
                    }
                  />
                </label>
                <label>
                  Inserta en tu web
                  <textarea
                    readOnly
                    rows={5}
                    value={`<iframe src="${location.origin}${p.publicPath || "/?product=" + id}${p.publicPath ? "?" : "&"}embed=1" width="100%" height="800" style="border:0" title="Configura tu producto"></iframe>`}
                  />
                </label>
                <p>
                  Autoriza el dominio de tu web en Conexiones antes de insertar
                  el configurador en producción.
                </p>
                {p.active && (
                  <button
                    className="button"
                    onClick={() =>
                      run(async () => {
                        await api("/products/" + id + "/unpublish", "POST", {});
                        setP({ ...p, active: false });
                        notify("Publicación retirada");
                      })
                    }
                  >
                    Retirar publicación
                  </button>
                )}
                <button
                  className="button"
                  onClick={() =>
                    run(async () => {
                      const copy = await api(
                        "/products/" + id + "/duplicate",
                        "POST",
                        {},
                      );
                      go({ edit: copy.id });
                    })
                  }
                >
                  <Copy size={16} /> Duplicar producto
                </button>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
function PhotoModel({ productId, run, upload, apply }: any) {
  const [enabled, setEnabled] = useState(false),
    [files, setFiles] = useState<File[]>([]),
    [consent, setConsent] = useState(false),
    [job, setJob] = useState<any>(null),
    [message, setMessage] = useState("");
  const key = "generation:" + productId;
  useEffect(() => {
    api("/generations/config")
      .then((v) => setEnabled(v.enabled))
      .catch((e) => setMessage(e.message));
    try {
      const saved = localStorage.getItem(key);
      if (saved) setJob(JSON.parse(saved));
    } catch {}
  }, [key]);
  const update = (j: any) => {
    setJob(j);
    localStorage.setItem(key, JSON.stringify(j));
  };
  return (
    <section className="photo-model">
      <span className="eyebrow">DE LA FOTO AL VOLUMEN</span>
      <h3>Crea una primera versión en 3D.</h3>
      <p>
        Sube de una a cuatro fotos del mismo objeto, desde distintos ángulos. El
        resultado necesita revisión; no sustituye un modelo técnico ni garantiza
        medidas.
      </p>
      {!enabled ? (
        <div className="note">
          Activa Meshy para esta empresa en la configuración del servidor. La
          generación utiliza créditos del proveedor.
        </div>
      ) : (
        <>
          <label>
            Fotos del producto
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(e) => {
                setFiles(Array.from(e.target.files || []));
                setConsent(false);
              }}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{" "}
            Autorizo enviar estas fotos a Meshy y usar sus créditos para generar
            el modelo.
          </label>
          <button
            className="button"
            disabled={!consent || files.length < 1 || files.length > 4}
            onClick={() =>
              run(async () => {
                let requestKey = sessionStorage.getItem(key + ":request");
                if (!requestKey) {
                  requestKey = crypto.randomUUID();
                  sessionStorage.setItem(key + ":request", requestKey);
                }
                setMessage("Subiendo fotos…");
                try {
                  const assets = [];
                  for (const f of files) assets.push((await upload(f)).id);
                  setMessage("Enviando a Meshy…");
                  const j = await api("/generations", "POST", {
                    requestKey,
                    assets,
                    consent: true,
                  });
                  update(j);
                  setMessage(
                    "Generación enviada. Puedes volver más tarde y actualizar el estado.",
                  );
                  setConsent(false);
                } finally {
                  setMessage(
                    "Consulta el estado antes de volver a solicitar una generación.",
                  );
                }
              })
            }
          >
            Generar 3D con Meshy
          </button>
        </>
      )}
      {message && <p>{message}</p>}
      {job && (
        <div className="note">
          <strong>
            {job.status} · {job.progress || 0}%
          </strong>
          <p>Referencia {job.id.slice(0, 8)}</p>
          {job.error && <p>{job.error}</p>}
          <button
            className="text"
            onClick={() =>
              run(async () => update(await api("/generations/" + job.id)))
            }
          >
            Actualizar estado
          </button>
          {job.status === "SUCCEEDED" && (
            <button
              className="primary full"
              onClick={() =>
                run(async () => {
                  apply(
                    await api("/generations/" + job.id + "/import", "POST", {}),
                  );
                  setMessage(
                    "Modelo incorporado al borrador. Revísalo antes de publicar.",
                  );
                })
              }
            >
              Usar este modelo
            </button>
          )}
          {["SUCCEEDED", "FAILED", "CANCELED"].includes(job.status) && (
            <button
              className="text"
              onClick={() => {
                sessionStorage.removeItem(key + ":request");
                localStorage.removeItem(key);
                setJob(null);
                setConsent(false);
              }}
            >
              Preparar otra generación
            </button>
          )}
          {job.status === "UNCONFIRMED" && (
            <p>
              Revisa la tarea en Meshy antes de intentarlo de nuevo. El envío
              pudo haberse procesado.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
function Public({ q, run, notify, me, login }: any) {
  const [data, setData] = useState<any>(null),
    [s, setS] = useState<any>({}),
    [view, setView] = useState("frontal");
  useEmbed(data);
  const requestedId = q.get("product"),
    catalog = q.get("catalog");
  const id = data?.id || requestedId,
    embed = q.has("embed");
  useEffect(() => {
    run(async () => {
      const endpoint = catalog
        ? "/catalog/" + catalog
        : requestedId
          ? "/public/" + requestedId
          : "/store/" + q.get("store");
      const v = await api(
        endpoint + (q.has("c") ? "?c=" + encodeURIComponent(q.get("c")!) : ""),
      );
      setData(v);
      if (v.id) {
        const id = v.id;
        try {
          const saved =
            q.get("selection") || sessionStorage.getItem("selection:" + id);
          if (v.sharedSelection) setS(v.sharedSelection);
          else if (saved) setS(result(v.manifest, JSON.parse(saved)).selection);
        } catch {}
        setView(v.manifest.views[0]);
        if (requestedId || q.has("selection")) {
          const params = new URLSearchParams(location.search);
          params.delete("product");
          if (params.has("selection")) {
            try {
              const legacy = result(
                v.manifest,
                JSON.parse(params.get("selection")!),
              );
              if (legacy.valid) {
                const shared = await api("/public/" + id + "/share", "POST", {
                  version: v.version,
                  selection: legacy.selection,
                });
                params.delete("selection");
                params.set(
                  "c",
                  new URL(shared.path, location.origin).searchParams.get("c")!,
                );
              }
            } catch {
              /* Keep legacy links usable if sharing is temporarily unavailable. */
            }
          }
          history.replaceState(
            null,
            "",
            v.publicPath + (params.size ? "?" + params : ""),
          );
        }
      }
    });
  }, [requestedId, catalog]);
  if (!data) return <div className="loading">Abriendo la colección…</div>;
  const select = (key: string, val: string | null) => {
    const next = result(data.manifest, { ...s, [key]: val }).selection;
    setS(next);
    try {
      sessionStorage.setItem("selection:" + id, JSON.stringify(next));
    } catch {
      notify(
        "Tu selección sigue aquí. Guárdala en tu cuenta para conservarla.",
      );
    }
  };
  const save = async (order: boolean) => {
    if (embed && order && q.get("cart") === "1") {
      const target = parentOrigin(data);
      if (!target)
        throw Error("Autoriza el dominio de esta web en Conexiones.");
      const ticket = await api("/public/" + id + "/cart-ticket", "POST", {
        version: data.version,
        selection: s,
      });
      window.parent.postMessage(
        { protocol: "yenze:1", type: "cart", ticket: ticket.ticket },
        target,
      );
      notify("Selección enviada a la tienda. Espera su confirmación.");
      return;
    }
    if (embed) {
      const tab = window.open("about:blank", "_blank");
      if (tab) tab.opener = null;
      try {
        const link = await api("/public/" + id + "/share", "POST", {
          version: data.version,
          selection: s,
        });
        if (tab) tab.location.href = location.origin + link.path;
      } catch (e) {
        tab?.close();
        throw e;
      }
      return;
    }
    if (!me.user) {
      login();
      return;
    }
    const c = await api("/configurations", "POST", {
      productId: id,
      version: data.version,
      selection: s,
    });
    if (order) {
      const o = await api("/customer/orders", "POST", {
        configurationId: c.id,
      });
      go({ page: "portal", order: o.id });
    } else notify("Guardado en tu espacio de cliente");
  };
  const r = id
    ? result(data.manifest, s)
    : { valid: false, total: 0, errors: [] };
  return (
    <div
      className="store"
      style={{ "--accent": data.organization.accent } as React.CSSProperties}
    >
      {!embed && (
        <header className="store-head">
          <a className="brand" href={"/?store=" + data.organization.slug}>
            {data.organization.name}
            <span>MADE YOURS.</span>
          </a>
          <button
            className="text"
            onClick={() => (me.user ? go({ page: "portal" }) : login())}
          >
            Mi espacio <ArrowUpRight size={17} />
          </button>
        </header>
      )}
      {!id ? (
        <div className="content">
          <span className="eyebrow">LA COLECCIÓN</span>
          <h1>
            Una buena base.
            <br />
            Tu toque personal.
          </h1>
          <div className="product-grid">
            {data.products.map((p: any) => (
              <a
                key={p.id}
                className="product-card"
                href={p.publicPath || "/?product=" + p.id}
              >
                <Preview m={p.manifest} />
                <div className="card-foot">
                  <h3>{p.name}</h3>
                  <ArrowUpRight />
                </div>
              </a>
            ))}
            {!data.products.length && (
              <p>Esta colección todavía no tiene productos publicados.</p>
            )}
          </div>
        </div>
      ) : (
        <div
          className={
            "buyer-layout " +
            (data.manifest.kind === "form"
              ? "form-layout form-" +
                (data.manifest.presentation?.layout || "editorial") +
                " tone-" +
                (data.manifest.presentation?.tone || "ink")
              : "")
          }
        >
          <div className="buyer-canvas">
            <span className="eyebrow">DISEÑADO PARA HACERLO TUYO</span>
            <Preview m={data.manifest} s={s} view={view} />
            <div className="view-buttons">
              {data.manifest.views.length > 1 &&
                data.manifest.views.map((v: string) => (
                  <button
                    key={v}
                    className={v === view ? "selected" : "button"}
                    onClick={() => setView(v)}
                  >
                    {v}
                  </button>
                ))}
            </div>
          </div>
          <div className="buyer-options">
            <span className="eyebrow">
              {data.manifest.kind === "form"
                ? "DISEÑA TU PROPUESTA"
                : "CADA DETALLE CUENTA"}
            </span>
            <h1>{data.manifest.name}</h1>
            <p>
              {data.manifest.description ||
                "Elige lo que va contigo. Mira cómo cambia."}
            </p>
            {data.manifest.personalization && (
              <TextileButton
                m={data.manifest}
                productId={id}
                s={s}
                onApply={(design: any) => {
                  const next = { ...s, $print: design };
                  setS(next);
                  try {
                    sessionStorage.setItem(
                      "selection:" + id,
                      JSON.stringify(next),
                    );
                  } catch {
                    notify(
                      "Diseño aplicado. Guárdalo en tu cuenta para conservarlo.",
                    );
                  }
                }}
              />
            )}
            {data.manifest.kind === "form" && (
              <div className="form-path">
                <span>Elige tus opciones</span>
                <span>Revisa tu propuesta</span>
                <span>Continuamos contigo</span>
              </div>
            )}
            <LiveChoices m={data.manifest} s={s} onSelect={select} />
            {!r.valid && (
              <p className="validation">
                {r.errors
                  ?.map((e: any) => (typeof e === "string" ? e : e.message))
                  .join(" ")}
              </p>
            )}
            <div className="buyer-total">
              <small>
                {data.mode === "quote" ? "Precio orientativo" : "Total"}
              </small>
              <strong>{r.valid ? money(r.total) : "—"}</strong>
            </div>
            <button
              className="primary full"
              disabled={!r.valid}
              onClick={() => run(() => save(true))}
            >
              {embed && q.get("cart") === "1"
                ? "Añadir a mi carrito"
                : data.mode === "purchase"
                  ? "Continuar con el pedido"
                  : "Solicitar presupuesto"}
              <ArrowUpRight size={18} />
            </button>
            <div className="row">
              <button
                className="text"
                disabled={!r.valid}
                onClick={() => run(() => save(false))}
              >
                Guardar configuración
              </button>
              <button
                className="text"
                onClick={() =>
                  run(async () => {
                    const link = await api("/public/" + id + "/share", "POST", {
                      version: data.version,
                      selection: s,
                    });
                    await navigator.clipboard.writeText(
                      location.origin + link.path,
                    );
                    notify("Enlace copiado");
                  })
                }
              >
                Compartir
              </button>
            </div>
            <small className="powered">Configurado con yenze</small>
          </div>
        </div>
      )}
    </div>
  );
}
const statuses: Record<string, string> = {
  requested: "Solicitud recibida",
  offered: "Presupuesto listo",
  accepted: "Pendiente de pago",
  paid: "Pagado",
  production: "En preparación",
  shipped: "Enviado",
  completed: "Completado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};
function Orders({ run, notify }: any) {
  const [orders, setOrders] = useState<any[]>([]),
    [selected, setSelected] = useState<string | null>(null);
  const load = async () => setOrders(await api("/orders"));
  useEffect(() => {
    run(load);
  }, []);
  return (
    <div className="content">
      <span className="eyebrow">DEL DISEÑO A LA ENTREGA</span>
      <h1>Todo en su sitio.</h1>
      <p>Solicitudes, conversaciones y pedidos de tus clientes.</p>
      <OrderList orders={orders} select={setSelected} />
      {selected && (
        <OrderDetail
          id={selected}
          admin
          run={run}
          notify={notify}
          close={() => {
            setSelected(null);
            const url = new URL(location.href);
            url.searchParams.delete("order");
            history.replaceState({}, "", url);
            run(load);
          }}
        />
      )}
    </div>
  );
}
function OrderList({ orders, select }: any) {
  return (
    <div className="order-list">
      {!orders.length && (
        <div className="empty">
          <ShoppingBag />
          <h3>Aquí empezarán las conversaciones.</h3>
          <p>
            Comparte un configurador publicado para recibir tu primera
            solicitud.
          </p>
        </div>
      )}
      {orders.map((o: any) => (
        <button key={o.id} onClick={() => select(o.id)}>
          <div className="order-thumb">
            <Preview
              m={o.configuration.manifest}
              s={o.configuration.selection}
            />
          </div>
          <div>
            <h3>{o.configuration.name}</h3>
            <small>
              {o.customer?.name || o.organization?.name} ·{" "}
              {new Date(o.created).toLocaleDateString("es")}
            </small>
          </div>
          <span
            className={
              "badge " +
              (["paid", "completed"].includes(o.status) ? "live" : "")
            }
          >
            {statuses[o.status]}
          </span>
          <strong>{money(o.amount)}</strong>
          <ArrowUpRight size={19} />
        </button>
      ))}
    </div>
  );
}
function Portal({ me, run, notify }: any) {
  const [configs, setConfigs] = useState<any[]>([]),
    [orders, setOrders] = useState<any[]>([]),
    [selected, setSelected] = useState<string | null>(
      new URLSearchParams(location.search).get("order"),
    );
  const load = async () => {
    const [c, o] = await Promise.all([
      api("/configurations"),
      api("/customer/orders"),
    ]);
    setConfigs(c);
    setOrders(o);
  };
  useEffect(() => {
    run(load);
  }, []);
  return (
    <div className="content">
      <header className="page-head">
        <div>
          <span className="eyebrow">TU ESPACIO PERSONAL</span>
          <h1>Hola, {me.user.name.split(" ")[0]}.</h1>
          <p>Lo que has imaginado. Lo que está por llegar.</p>
        </div>
        {!me.organizations.length && (
          <button
            className="text"
            onClick={() =>
              run(async () => {
                await api("/auth/logout", "POST", {});
                go({});
              })
            }
          >
            Cerrar sesión
          </button>
        )}
      </header>
      <div className="section-title">
        <h2>Tus pedidos y presupuestos</h2>
        <button className="text" onClick={() => run(load)}>
          Actualizar pedidos
        </button>
      </div>
      <OrderList orders={orders} select={setSelected} />
      <div className="section-title">
        <h2>Ideas guardadas</h2>
        <span>{configs.length} configuraciones</span>
      </div>
      <div className="product-grid">
        {configs.map((c) => (
          <div className="product-card" key={c.id}>
            <Preview m={c.manifest} s={c.selection} />
            <div className="card-foot">
              <div>
                <small>{c.organization}</small>
                <h3>{c.name}</h3>
                <span>
                  {money(c.amount)} · versión {c.version}
                </span>
              </div>
            </div>
            <div className="card-actions">
              <a
                className="text"
                href={c.publicPath || "/?product=" + c.product_id}
                onClick={() =>
                  sessionStorage.setItem(
                    "selection:" + c.product_id,
                    JSON.stringify(c.selection),
                  )
                }
              >
                Volver a configurar
              </a>
              <button
                className="text"
                onClick={() =>
                  run(async () => {
                    const o = await api("/customer/orders", "POST", {
                      configurationId: c.id,
                    });
                    setSelected(o.id);
                    await load();
                  })
                }
              >
                Solicitar <ArrowUpRight size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {selected && (
        <OrderDetail
          id={selected}
          run={run}
          notify={notify}
          close={() => {
            setSelected(null);
            const url = new URL(location.href);
            url.searchParams.delete("order");
            history.replaceState({}, "", url);
            run(load);
          }}
        />
      )}
    </div>
  );
}
function OrderDetail({ id, admin = false, run, notify, close }: any) {
  const [o, setO] = useState<any>(null);
  useEffect(() => {
    run(async () => setO(await api("/orders/" + id)));
  }, [id]);
  const action = async (a: string, b: any) =>
    setO(await api("/orders/" + id + "/" + a, "POST", b));
  return (
    <Modal title="Los detalles de tu pedido" onClose={close}>
      {!o ? (
        <p>Cargando…</p>
      ) : (
        <>
          <div className="order-summary">
            <div>
              {o.configuration.manifest.kind === "form" ? (
                <div className="order-service-mark" aria-hidden="true">
                  {o.configuration.name.slice(0, 1).toUpperCase()}
                </div>
              ) : (
                <Preview
                  m={o.configuration.manifest}
                  s={o.configuration.selection}
                />
              )}
            </div>
            <div>
              <span className="badge">{statuses[o.status]}</span>
              <h2>{o.configuration.name}</h2>
              <p>
                {o.customer.name} · {o.customer.email}
              </p>
              <strong>{money(o.amount)}</strong>
              <small>Referencia {o.id.slice(0, 8)}</small>
            </div>
          </div>
          <div className="specs">
            {o.configuration.manifest.groups
              .filter(
                (g: any) =>
                  Object.hasOwn(o.configuration.selection, g.id) &&
                  o.configuration.selection[g.id] !== null,
              )
              .map((g: any) => (
                <div key={g.id}>
                  <span>{g.label}</span>
                  <strong>
                    {g.options.find(
                      (v: any) => v.id === o.configuration.selection[g.id],
                    )?.label || "—"}
                  </strong>
                </div>
              ))}
          </div>
          <section className="proof-panel">
            <span className="eyebrow">ANTES DE PREPARAR TU PEDIDO</span>
            <h3>Una última revisión, juntos.</h3>
            <p>
              Revisa las opciones, el diseño y las indicaciones del comercio. La
              aprobación queda vinculada a esta versión exacta.
            </p>
            {o.proof ? (
              <>
                <p>
                  <strong>Revisión {o.proof.revision}</strong> ·{" "}
                  {o.proof.approved_at
                    ? "Aprobada el " +
                      new Date(o.proof.approved_at).toLocaleString("es")
                    : "Pendiente de aprobación"}
                </p>
                <p>{o.proof.note}</p>
                {!admin &&
                  !o.proof.approved_at &&
                  ["requested", "offered", "accepted", "paid"].includes(
                    o.status,
                  ) && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        run(() =>
                          action("approve-proof", {
                            revision: o.proof.revision,
                            digest: o.proof.digest,
                            confirmed: true,
                          }),
                        );
                      }}
                    >
                      <label className="proof-consent">
                        <input type="checkbox" required /> He revisado esta
                        versión y autorizo su preparación.
                      </label>
                      <button className="primary">Aprobar esta versión</button>
                    </form>
                  )}
              </>
            ) : (
              <p>El comercio todavía no ha solicitado tu aprobación.</p>
            )}
            {admin &&
              ["requested", "offered", "accepted", "paid"].includes(
                o.status,
              ) && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const note = new FormData(e.currentTarget).get("note");
                    run(() => action("proof", { note }));
                  }}
                >
                  <label>
                    Qué debe revisar el cliente
                    <textarea
                      name="note"
                      required
                      maxLength={2000}
                      placeholder="Comprueba las tallas, la posición del diseño y la zona de impresión…"
                    />
                  </label>
                  <button className="button">
                    {o.proof
                      ? "Solicitar una nueva aprobación"
                      : "Solicitar aprobación del cliente"}
                  </button>
                  {o.proof && (
                    <small>
                      Una nueva solicitud sustituye la aprobación anterior.
                    </small>
                  )}
                </form>
              )}
            {admin && o.configuration.manifest.personalization && (
              <div className="row">
                <button
                  className="button"
                  onClick={() => run(() => downloadProduction(id, "front"))}
                >
                  PNG frontal con originales
                </button>
                <button
                  className="button"
                  onClick={() => run(() => downloadProduction(id, "back"))}
                >
                  PNG espalda con originales
                </button>
              </div>
            )}
            <a
              className="button"
              href={"/api/orders/" + id + "/production-file"}
              download
            >
              {admin && o.configuration.manifest.personalization
                ? "Descargar ficha para el taller"
                : "Descargar resumen del pedido"}
            </a>
            <small>
              {admin && o.configuration.manifest.personalization
                ? "JSON con opciones, originales y medidas. El taller debe revisar color, tipografías y recortes; no sustituye un archivo de impresión certificado."
                : "Conserva las opciones elegidas, el importe y la aprobación de esta versión en un archivo JSON."}
            </small>
          </section>
          {o.offer_note && (
            <div className="note">
              <small>Propuesta del comercio</small>
              <p>{o.offer_note}</p>
            </div>
          )}
          {admin && ["requested", "offered"].includes(o.status) && (
            <form
              className="offer-form"
              onSubmit={(e) => {
                e.preventDefault();
                const d = Object.fromEntries(new FormData(e.currentTarget));
                run(() =>
                  action("offer", {
                    amount: Math.round(Number(d.amount) * 100),
                    note: d.note,
                  }),
                );
              }}
            >
              <h3>Envía un presupuesto</h3>
              <label>
                Total (€)
                <input
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={o.amount / 100}
                  required
                />
              </label>
              <label>
                Qué incluye
                <textarea
                  name="note"
                  required
                  defaultValue={o.offer_note}
                  placeholder="Acabados, entrega y condiciones…"
                />
              </label>
              <button className="primary">Enviar propuesta</button>
            </form>
          )}
          {!admin && o.status === "offered" && (
            <button
              className="primary full"
              onClick={() =>
                run(() => action("accept", { revision: o.offer_revision }))
              }
            >
              Aceptar presupuesto · {money(o.amount)}
            </button>
          )}
          {!admin && o.status === "accepted" && (
            <>
              <button
                className="primary full"
                onClick={() =>
                  run(async () => {
                    const r = await api(
                      "/orders/" + id + "/checkout",
                      "POST",
                      {},
                    );
                    location.href = r.url;
                  })
                }
              >
                Pagar de forma segura con Stripe <ArrowUpRight size={17} />
              </button>
              <small>
                El comercio debe tener los pagos habilitados. Solo la
                confirmación de Stripe marcará el pedido como pagado.
              </small>
            </>
          )}
          {admin && ["paid", "production", "shipped"].includes(o.status) && (
            <button
              className="primary"
              onClick={() =>
                run(() =>
                  action("status", {
                    status: (
                      {
                        paid: "production",
                        production: "shipped",
                        shipped: "completed",
                      } as any
                    )[o.status],
                  }),
                )
              }
            >
              Marcar como{" "}
              {
                statuses[
                  (
                    {
                      paid: "production",
                      production: "shipped",
                      shipped: "completed",
                    } as any
                  )[o.status]
                ]
              }
            </button>
          )}
          {admin && ["requested", "offered"].includes(o.status) && (
            <button
              className="text"
              onClick={() =>
                run(() => action("status", { status: "cancelled" }))
              }
            >
              Cancelar solicitud
            </button>
          )}
          <h3>La conversación</h3>
          <div className="messages">
            {o.messages.map((m: any) => (
              <div key={m.id}>
                <small>
                  {m.name} · {new Date(m.created).toLocaleString("es")}
                </small>
                <p>{m.body}</p>
              </div>
            ))}
          </div>
          <form
            className="message-form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const d = new FormData(form);
              run(async () => {
                await action("messages", { body: d.get("body") });
                form.reset();
                notify("Mensaje añadido al pedido");
              });
            }}
          >
            <textarea
              name="body"
              required
              maxLength={2000}
              placeholder="Añade una pregunta o un detalle…"
            />
            <button className="button">Enviar mensaje</button>
          </form>
        </>
      )}
    </Modal>
  );
}
function Customers({ run }: any) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    run(async () => setRows(await api("/customers")));
  }, []);
  return (
    <div className="content">
      <span className="eyebrow">PERSONAS DETRÁS DE CADA IDEA</span>
      <h1>Tus clientes.</h1>
      <p>Personas que han guardado una configuración en tu negocio.</p>
      <div className="table">
        <div>
          <strong>Cliente</strong>
          <strong>Configuraciones</strong>
          <strong>Pedidos</strong>
        </div>
        {rows.map((r) => (
          <div key={r.id}>
            <span>
              {r.name}
              <small>{r.email}</small>
            </span>
            <span>{r.configurations}</span>
            <span>{r.orders}</span>
          </div>
        ))}
        {!rows.length && <p>Todavía no hay clientes.</p>}
      </div>
    </div>
  );
}
function SettingsPage({ run, notify }: any) {
  const [w, setW] = useState<any>(null),
    [readiness, setReadiness] = useState<any>(null),
    [stripe, setStripe] = useState<any>(null),
    [tokens, setTokens] = useState<any[]>([]),
    [members, setMembers] = useState<any[]>([]),
    [secret, setSecret] = useState("");
  const load = async () => {
    const v = await api("/workspace");
    setW(v);
    setReadiness(await api("/readiness"));
    if (v.role === "owner") {
      const [s, t, m] = await Promise.all([
        api("/stripe/status"),
        api("/tokens"),
        api("/members"),
      ]);
      setStripe(s);
      setTokens(t);
      setMembers(m);
    }
  };
  useEffect(() => {
    run(load);
  }, []);
  if (!w) return <div className="loading">Abriendo conexiones…</div>;
  return (
    <div className="content settings">
      <span className="eyebrow">TU MARCA. TU ECOSISTEMA.</span>
      <h1>Conecta las piezas.</h1>
      <p>
        Tu configurador puede vivir dentro de tu web y seguir conectado a este
        estudio.
      </p>
      <section className="launch-readiness">
        <span className="eyebrow">PREPARA TU LANZAMIENTO</span>
        <h2>Lo que está listo. Lo que queda.</h2>
        <div>
          {readiness?.checks.map((c: any) => (
            <article key={c.id}>
              <span className={"readiness-state " + c.state}>
                {
                  (
                    {
                      ready: "Listo",
                      configured: "Configurar y verificar",
                      pending: "Pendiente",
                      manual: "Revisión manual",
                    } as any
                  )[c.state]
                }
              </span>
              <h3>{c.label}</h3>
              <p>{c.detail}</p>
            </article>
          ))}
        </div>
      </section>
      <div className="settings-grid">
        <section>
          <h2>Una experiencia propia</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const d = Object.fromEntries(new FormData(e.currentTarget));
              run(async () => {
                await api("/workspace", "PATCH", {
                  name: d.name,
                  accent: d.accent,
                  domains: String(d.domains)
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                });
                notify("Marca y dominios guardados");
                await load();
              });
            }}
          >
            <label>
              Nombre de tu negocio
              <input
                name="name"
                defaultValue={w.name}
                disabled={w.role !== "owner"}
              />
            </label>
            <label>
              Color de marca
              <input
                type="color"
                name="accent"
                defaultValue={w.accent}
                disabled={w.role !== "owner"}
              />
            </label>
            <label>
              Dominios autorizados para insertar
              <textarea
                name="domains"
                defaultValue={w.domains.join("\n")}
                placeholder="https://tumarca.com"
                disabled={w.role !== "owner"}
              />
              <small>
                Un origen HTTPS por línea, sin rutas. WordPress, Wix,
                Squarespace o Framer pueden usar el iframe.
              </small>
            </label>
            {w.role === "owner" && (
              <button className="primary">Guardar identidad</button>
            )}
          </form>
          <a className="button" target="_blank" href={"/?store=" + w.slug}>
            Abrir mi colección <ExternalLink size={16} />
          </a>
        </section>
        <section>
          <span className="integration-logo">stripe</span>
          <h2>Cobra en tu propia cuenta.</h2>
          <p>
            Conecta tu comercio con Stripe para cobrar pedidos y presupuestos
            aceptados.
          </p>
          {stripe?.chargesEnabled ? (
            <p className="success">Pagos habilitados</p>
          ) : (
            <p className="note">
              {w.stripeConfigured
                ? "Completa la conexión y la verificación de tu cuenta."
                : "Faltan las claves de Stripe en el servidor. Puedes crear productos y recibir presupuestos mientras tanto."}
            </p>
          )}
          <button
            className="primary"
            disabled={!w.stripeConfigured || w.role !== "owner"}
            onClick={() =>
              run(async () => {
                const r = await api("/stripe/connect", "POST", {});
                location.href = r.url;
              })
            }
          >
            {stripe?.connected ? "Gestionar conexión" : "Conectar Stripe"}
            <ArrowUpRight size={17} />
          </button>
          <small>
            Los reembolsos se gestionan en Stripe. El webhook sincroniza los
            reembolsos completos.
          </small>
        </section>
        {w.role === "owner" && (
          <>
            <section>
              <span className="eyebrow">MCP + API</span>
              <h2>Un estudio para tus agentes.</h2>
              <p>
                Da acceso a Claude Code, Codex o tu integración con permisos
                concretos y revocables.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  run(async () => {
                    const t = await api("/tokens", "POST", {
                      label: d.get("label"),
                      scopes: d.getAll("scope"),
                    });
                    setSecret(t.token);
                    await load();
                  });
                }}
              >
                <label>
                  Nombre de la conexión
                  <input
                    name="label"
                    required
                    placeholder="Mi agente de diseño"
                  />
                </label>
                <div className="row">
                  {["read", "write", "publish"].map((v) => (
                    <label className="check" key={v}>
                      <input
                        type="checkbox"
                        name="scope"
                        value={v}
                        defaultChecked={v === "read"}
                      />
                      {v}
                    </label>
                  ))}
                </div>
                <button className="button">Crear token</button>
              </form>
              {secret && (
                <div className="note">
                  <strong>
                    Copia este token ahora. No volverá a mostrarse.
                  </strong>
                  <textarea readOnly value={secret} />
                  <button
                    className="text"
                    onClick={() =>
                      run(async () => {
                        await navigator.clipboard.writeText(secret);
                        notify("Token copiado");
                      })
                    }
                  >
                    Copiar token
                  </button>
                </div>
              )}
              {tokens.map((t) => (
                <div className="connection" key={t.id}>
                  <span>
                    {t.label}
                    <small>{JSON.parse(t.scopes).join(" · ")}</small>
                  </span>
                  <button
                    className="text"
                    onClick={() =>
                      run(async () => {
                        await api("/tokens/" + t.id, "DELETE", {});
                        await load();
                      })
                    }
                  >
                    Revocar
                  </button>
                </div>
              ))}
            </section>
            <section>
              <span className="eyebrow">MEJOR EN EQUIPO</span>
              <h2>Comparte tu estudio.</h2>
              <p>
                Añade como editor a alguien que ya tenga una cuenta. Podrá
                editar productos y gestionar pedidos.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  run(async () => {
                    await api("/members", "POST", { email: d.get("email") });
                    await load();
                    notify("Editor añadido");
                  });
                }}
              >
                <label>
                  Email del colaborador
                  <input name="email" type="email" required />
                </label>
                <button className="button">Añadir editor</button>
              </form>
              {members.map((m) => (
                <div className="connection" key={m.id}>
                  <span>
                    {m.name}
                    <small>
                      {m.email} · {m.role}
                    </small>
                  </span>
                  {m.role !== "owner" && (
                    <button
                      className="text"
                      onClick={() =>
                        run(async () => {
                          await api("/members/" + m.id, "DELETE", {});
                          await load();
                        })
                      }
                    >
                      Quitar
                    </button>
                  )}
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
declare const __SHOWCASE__: boolean;
createRoot(document.getElementById("root")!).render(
  __SHOWCASE__ ? <Landing standalone /> : <App />,
);

function EmailVerification({ token }: { token: string }) {
  const [status, setStatus] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <main className="verification-page">
      <a className="logo" href="/">
        yenze
      </a>
      <span className="eyebrow">TU CUENTA, PROTEGIDA</span>
      <h1>Confirma que este correo es tuyo.</h1>
      <p>Este paso vincula tu dirección a tu cuenta y tus pedidos.</p>
      {!done && (
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api("/auth/verify", "POST", { token });
              setDone(true);
              setStatus("Correo confirmado. Ya puedes volver a tu cuenta.");
              history.replaceState({}, "", "/?page=login");
            } catch (e) {
              setStatus((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Confirmando…" : "Confirmar mi correo"}
        </button>
      )}
      <p role="status">{status}</p>
      <a className="button" href="/?page=login">
        Volver a mi cuenta
      </a>
    </main>
  );
}
