import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, AlertCircle } from "lucide-react";
export default function PublicationPanel({
  p,
  m,
  dirty,
  api,
  run,
  notify,
  onMode,
  onPublish,
  onDuplicate,
  onUnpublish,
}: any) {
  const [report, setReport] = useState<any>(null),
    [error, setError] = useState("");
  const input = JSON.stringify({
    revision: p.revision,
    manifest: m,
    mode: p.mode,
  });
  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError("");
    const timer = setTimeout(() => {
      api("/products/" + p.id + "/check-publish", "POST", JSON.parse(input))
        .then((value: any) => {
          if (!cancelled) setReport(value);
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e.message);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [input, p.id]);
  const url = location.origin + (p.publicPath || "/?product=" + p.id);
  const embed = `<iframe src="${url}${p.publicPath ? "?" : "&"}embed=1" width="100%" height="800" style="border:0" title="Configura tu producto" loading="lazy"></iframe>`;
  const copy = (value: string, label: string) =>
    run(async () => {
      await navigator.clipboard.writeText(value);
      notify(label);
    });
  return (
    <div className="publication-panel">
      <span className="eyebrow">DE TU IDEA A TU PRIMER CLIENTE</span>
      <h2>
        {p.active ? "Tu configurador está online." : "Publica con confianza."}
      </h2>
      <p>
        {p.active
          ? dirty || p.published !== p.revision
            ? "Tu enlace muestra la última versión publicada. Publica de nuevo para aplicar estos cambios."
            : "Comparte el enlace o llévalo a tu web."
          : "Comprueba tu producto y decide cómo quieres recibir las solicitudes."}
      </p>
      <label>
        Al terminar la configuración
        <select value={p.mode} onChange={(e) => onMode(e.target.value)}>
          <option value="quote">Solicitar presupuesto</option>
          <option value="purchase">Comprar con Stripe</option>
        </select>
      </label>
      <p className="publication-help">
        Los presupuestos funcionan sin Stripe. La compra requiere una cuenta
        Stripe conectada y activa.
      </p>
      <section
        className="publication-checks"
        aria-label="Comprobación de publicación"
        aria-live="polite"
      >
        {!report && !error && <p>Comprobando tu producto…</p>}
        {error && <p className="validation">{error}</p>}
        {report?.checks.map((c: any) => (
          <div key={c.id} data-state={c.state}>
            {c.state === "ready" ? (
              <Check size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span>
              <strong>{c.label}</strong>
              {c.detail && <small>{c.detail}</small>}
            </span>
          </div>
        ))}
      </section>
      <button
        className="primary full"
        disabled={!report?.ready}
        onClick={() => run(onPublish)}
      >
        {p.active ? "Publicar esta versión" : "Publicar mi configurador"}
      </button>
      <section className="publication-share">
        <h3>Comparte tu producto</h3>
        {!p.active && <p>El enlace estará disponible cuando publiques.</p>}
        <label>
          Enlace público
          <input readOnly value={url} />
        </label>
        <div className="publication-actions">
          <button
            className="button"
            disabled={!p.active}
            onClick={() => copy(url, "Enlace público copiado")}
          >
            <Copy size={15} /> Copiar enlace
          </button>
          {p.active && (
            <a className="button" href={url} target="_blank" rel="noreferrer">
              Abrir enlace <ExternalLink size={15} />
            </a>
          )}
        </div>
        <details>
          <summary>Insertar en WordPress, Wix, Squarespace o Framer</summary>
          <ol>
            <li>Añade un bloque HTML o Embed en tu página.</li>
            <li>Pega el código que aparece debajo.</li>
            <li>
              Autoriza el dominio de tu web en{" "}
              <a href="/?page=settings">Conexiones</a>.
            </li>
          </ol>
          <label>
            Código para tu web
            <textarea readOnly rows={5} value={embed} />
          </label>
          <button
            className="button"
            disabled={!p.active}
            onClick={() => copy(embed, "Código de inserción copiado")}
          >
            <Copy size={15} /> Copiar código
          </button>
          <p>
            Este bloque muestra el configurador. La conexión con el carrito de
            tu tienda requiere una integración adicional.
          </p>
        </details>
      </section>
      <div className="publication-actions">
        <button className="button" onClick={() => run(onDuplicate)}>
          Duplicar producto
        </button>
        {p.active && (
          <button className="text danger" onClick={() => run(onUnpublish)}>
            Retirar publicación
          </button>
        )}
      </div>
    </div>
  );
}
