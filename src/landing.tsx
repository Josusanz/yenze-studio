import { useState, lazy, Suspense } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Plus,
  Minus,
  Layers,
  Box,
  Code2,
  Heart,
  MousePointer2,
  Download,
  ShieldCheck,
  Menu,
  X,
  Globe,
  GitBranch,
  SlidersHorizontal,
} from "lucide-react";
import "./landing.css";
const Model = lazy(() => import("./model"));
const demo: any = {
  schemaVersion: 1,
  kind: "scene-3d",
  name: "Mesa Forma",
  currency: "EUR",
  basePrice: 24000,
  canvas: { width: 1000, height: 850 },
  views: ["frontal"],
  rules: [],
  objects: [
    {
      id: "top",
      name: "Tablero",
      type: "box",
      color: "#c8ad83",
      size: [1.5, 0.09, 0.8],
      position: [0, 0.77, 0],
      rotation: 0,
    },
    ...[-0.62, 0.62].flatMap((x, i) =>
      [-0.27, 0.27].map((z, j) => ({
        id: "leg_" + i + j,
        name: "Pata",
        type: "cylinder",
        color: "#394b55",
        size: [0.07, 0.72, 0.07],
        position: [x, 0.36, z],
        rotation: 0,
      })),
    ),
  ],
  groups: [
    {
      id: "top",
      label: "Acabado",
      effect: "material",
      material: "top",
      order: 0,
      required: true,
      default: "oak",
      options: [
        { id: "oak", label: "Roble", color: "#c8ad83", priceDelta: 0 },
        { id: "blue", label: "Azul", color: "#36556b", priceDelta: 2000 },
        { id: "clay", label: "Arcilla", color: "#b27862", priceDelta: 2000 },
      ],
    },
  ],
};
const euro = (v: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
export default function Landing({ loggedIn = false, standalone = false }: any) {
  const [fabric, setFabric] = useState("cream"),
    [menu, setMenu] = useState(false),
    [finish, setFinish] = useState("oak"),
    [width, setWidth] = useState(150),
    [copied, setCopied] = useState(false),
    [faq, setFaq] = useState<number | null>(0);
  const repo = "https://github.com/Josusanz/yenze-studio";
  const start = standalone
    ? repo + "#quick-start"
    : loggedIn
      ? "/?page=products&new=1"
      : "/?page=signup&new=1";
  const scene = {
    ...demo,
    objects: demo.objects.map((o: any) =>
      o.id === "top" ? { ...o, size: [width / 100, 0.09, 0.8] } : o,
    ),
  };
  const faqs = [
    [
      "¿Tengo que saber programar o diseñar en 3D?",
      "Puedes empezar con el nombre de tu producto, sus opciones y una ficha de resumen. Si tienes imágenes, puedes añadirlas. Para geometría 3D compleja necesitarás un modelo preparado; el constructor incluido trabaja con piezas y medidas.",
    ],
    [
      "¿Puedo usarlo sin imágenes?",
      "Sí. El asistente crea una ficha configurable con las preguntas que tú definas. Tu cliente puede elegir, guardar su configuración y pedir un presupuesto. Puedes incorporar imágenes más adelante.",
    ],
    [
      "¿Cómo funciona en mi web?",
      "Publica el configurador, autoriza el dominio de tu web y copia el iframe. Hay un shortcode para WordPress. Los pedidos se gestionan en Yenze; todavía no sustituye el carrito nativo de Shopify, WooCommerce o Wix.",
    ],
    [
      "¿Qué significa que sea open source?",
      "El código se distribuye para que puedas estudiarlo, instalarlo y contribuir según su licencia. El paquete incluye el código, las pruebas y las instrucciones. Alojarlo, mantenerlo y los servicios externos pueden tener costes.",
    ],
    [
      "¿Puedo cobrar pedidos?",
      "La integración utiliza Stripe Connect para que el comercio conecte su cuenta. Necesita claves, webhook y verificación de Stripe. También puedes trabajar con presupuestos sin activar pagos.",
    ],
    [
      "¿Es una plataforma terminada para cualquier empresa?",
      "Es una beta abierta. Ya tiene constructor, reglas, portal, presupuestos e integraciones. Antes de vender con una instalación real hay que verificar pagos, correo, copias, seguridad operativa y los requisitos concretos del negocio. El alcance y las limitaciones están documentados.",
    ],
  ];
  return (
    <div className="marketing">
      <a className="skip-link" href="#main-content">
        Ir al contenido
      </a>
      <div className="announcement">
        <span className="live-dot" />
        BETA ABIERTA · El configurador también puede ser tuyo.
        <a href="#open-source">
          Explora el proyecto <ArrowUpRight size={12} />
        </a>
      </div>
      <header className="marketing-nav">
        <a href="/?page=home" className="marketing-logo">
          yenze<span>MAKE IT YOURS.</span>
        </a>
        <nav className={menu ? "open" : ""} aria-label="Navegación principal">
          <a href="#how" onClick={() => setMenu(false)}>
            Cómo funciona
          </a>
          <a href="#playground" onClick={() => setMenu(false)}>
            Pruébalo
          </a>
          <a href="#open-source" onClick={() => setMenu(false)}>
            Open source
          </a>
        </nav>
        <div className="nav-actions">
          <a
            href={
              standalone ? repo : loggedIn ? "/?page=dashboard" : "/?page=login"
            }
          >
            {standalone ? "GitHub ↗" : loggedIn ? "Mi estudio" : "Entrar"}
          </a>
          <a className="m-button dark" href={start}>
            {standalone ? "Instalar Yenze" : "Empieza a crear"}{" "}
            <ArrowUpRight size={15} />
          </a>
          <button
            className="mobile-menu"
            aria-label={menu ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main-content">
        <section className="hero">
          <div className="hero-copy">
            <div className="m-eyebrow">
              <span />
              CONFIGURACIÓN DE PRODUCTOS, ABIERTA A TODOS
            </div>
            <h1>
              Tú creas
              <br />
              el producto.
              <br />
              <em>Ellos lo hacen suyo.</em>
            </h1>
            <p>
              Convierte las opciones de tu producto en una experiencia que tus
              clientes puedan ver, tocar y elegir. Empieza con lo que tienes.
            </p>
            <div className="hero-ctas">
              <a className="m-button dark" href={start}>
                {standalone
                  ? "Crear con Yenze · instalar"
                  : "Crear mi primer configurador"}{" "}
                <ArrowUpRight size={17} />
              </a>
              <a className="m-link" href="#playground">
                Primero, déjame probar <ArrowRight size={16} />
              </a>
            </div>
            <div className="hero-note">
              <Check size={13} /> Sin código para empezar <span /> 2D, 3D o sin
              imágenes
            </div>
            {standalone && (
              <small className="beta-context">
                Demo interactiva sin registro. El editor completo se instala
                desde GitHub.
              </small>
            )}
          </div>
          <div className="hero-product">
            <div className="product-overline">
              <span>POSIBILIDAD N.º 001</span>
              <span>
                Diseña tu versión <Plus size={13} />
              </span>
            </div>
            <img
              className="hero-photo"
              src={
                fabric === "cream"
                  ? "/brand/lounge-original.png"
                  : "/brand/lounge-blue.png"
              }
              alt={
                "Butaca y reposapiés de bouclé " +
                (fabric === "cream" ? "marfil" : "azul noche")
              }
              width="1536"
              height="1024"
              fetchPriority="high"
            />
            <div className="product-drag-note">
              <MousePointer2 size={13} /> Prueba otro acabado
            </div>
            <div className="hero-product-controls">
              <div>
                <small>Butaca Nube · ejemplo 2D</small>
                <h2>
                  {fabric === "cream"
                    ? "Un poco de calma."
                    : "Un poco más de ti."}
                </h2>
              </div>
              <div className="fabric-control">
                <button
                  aria-label="Acabado marfil"
                  aria-pressed={fabric === "cream"}
                  className={fabric === "cream" ? "active" : ""}
                  onClick={() => setFabric("cream")}
                  style={{ background: "#e4dfd4" }}
                >
                  {fabric === "cream" && <Check size={16} />}
                </button>
                <button
                  aria-label="Acabado azul noche"
                  aria-pressed={fabric === "blue"}
                  className={fabric === "blue" ? "active" : ""}
                  onClick={() => setFabric("blue")}
                  style={{ background: "#354f65", color: "white" }}
                >
                  {fabric === "blue" && <Check size={16} />}
                </button>
              </div>
            </div>
            <div className="floating-spec">
              <i />
              <span>
                {fabric === "cream" ? "Bouclé marfil" : "Bouclé azul noche"}
                <small>Tu elección, al instante</small>
              </span>
              <Check size={14} />
            </div>
          </div>
        </section>
        <div className="capability-strip">
          <span>UNA BASE. MUCHAS FORMAS DE CREAR.</span>
          <div>
            <ImageMark /> Imágenes y capas
          </div>
          <div>
            <Box size={17} /> Modelos 3D
          </div>
          <div>
            <GitBranch size={17} /> Opciones conectadas
          </div>
          <div>
            <Code2 size={17} /> Tu web, tu código
          </div>
        </div>
        <section className="launch-usecases" id="examples">
          <div className="section-intro">
            <div>
              <span className="m-eyebrow">
                DE UNA IDEA A ALGO QUE SE PUEDE ELEGIR
              </span>
              <h2>
                Tres formas de empezar.
                <br />
                <em>El mismo espacio para crear.</em>
              </h2>
            </div>
            <p>
              Trae tu producto, sus fotos o simplemente las decisiones que toma
              tu cliente. Empieza por un caso concreto y amplíalo a tu ritmo.
            </p>
          </div>
          <div className="launch-usecase-grid">
            <article>
              <img
                src="/launch/shirt-editor.png"
                alt="Editor real de camiseta con un diseño gráfico sobre un modelo 3D"
                loading="lazy"
                width="1440"
                height="1000"
              />
              <div>
                <span className="m-eyebrow">01 / PERSONALIZACIÓN TEXTIL</span>
                <h3>
                  De «pon mi logo»
                  <br />a «así lo quiero».
                </h3>
                <p>
                  Texto e imágenes sobre una camiseta 3D. Originales, revisión
                  del cliente y archivos para el taller.
                </p>
                <a className="m-link" href={start}>
                  Crear una camiseta <ArrowUpRight size={16} />
                </a>
              </div>
            </article>
            <article>
              <img
                src="/brand/lounge-blue.png"
                alt="Butaca de ejemplo con acabado azul"
                loading="lazy"
                width="1536"
                height="1024"
              />
              <div>
                <span className="m-eyebrow">02 / PRODUCTOS VISUALES</span>
                <h3>
                  Cada acabado.
                  <br />
                  Una posibilidad.
                </h3>
                <p>
                  Fotografías, capas y modelos GLB para enseñar qué cambia
                  cuando el cliente elige.
                </p>
                <a className="m-link" href="#playground">
                  Probar el ejemplo 3D <ArrowUpRight size={16} />
                </a>
              </div>
            </article>
            <article>
              <img
                src="/launch/service-configurator.png"
                alt="Configurador de servicios con modalidades y precio de la propuesta"
                loading="lazy"
                width="1440"
                height="1000"
              />
              <div>
                <span className="m-eyebrow">03 / SERVICIOS A MEDIDA</span>
                <h3>
                  No todo producto
                  <br />
                  necesita una imagen.
                </h3>
                <p>
                  Ayuda a elegir un servicio. Recibe la solicitud, prepara la
                  propuesta y conserva la conversación.
                </p>
                <a className="m-link" href={start}>
                  Crear una propuesta <ArrowUpRight size={16} />
                </a>
              </div>
            </article>
          </div>
        </section>
        <section id="how" className="how-section">
          <div className="section-intro">
            <div>
              <span className="m-eyebrow">MENOS MANUAL. MÁS INTUICIÓN.</span>
              <h2>
                No necesitas conocer
                <br />
                la herramienta.
                <br />
                <em>Conoces tu producto.</em>
              </h2>
            </div>
            <p>
              El primer paso no es aprender qué es una capa. Es contar qué
              vendes. Y decidir qué podrá elegir quien lo compra.
            </p>
          </div>
          <div className="how-grid">
            <article>
              <div className="how-number">
                01 <span>CUÉNTANOS QUÉ VENDES</span>
              </div>
              <div className="how-visual name-visual">
                <span>¿Qué vas a vender?</span>
                <strong>
                  Una mesa a medida
                  <span className="cursor" />
                </strong>
                <div>
                  <i>Producto</i>
                  <i className="chosen">
                    Mobiliario <Check size={11} />
                  </i>
                  <i>Servicio</i>
                </div>
              </div>
              <h3>Empieza con una idea.</h3>
              <p>
                No hace falta tener todos los archivos. Un nombre y una primera
                decisión son suficientes.
              </p>
            </article>
            <article>
              <div className="how-number">
                02 <span>DALE SUS POSIBILIDADES</span>
              </div>
              <div className="how-visual branch-visual">
                <div>
                  Material <SlidersHorizontal size={13} />
                </div>
                <span>
                  <i />
                  Madera <Check size={12} />
                </span>
                <span className="branch-child">
                  <CornerMark />
                  Acabado <small>Natural · Lacado</small>
                </span>
              </div>
              <h3>Una elección lleva a otra.</h3>
              <p>
                Añade colores, extras y subopciones. Muestra solo lo que tiene
                sentido en cada combinación.
              </p>
            </article>
            <article>
              <div className="how-number">
                03 <span>PRUÉBALO. HAZLO TUYO.</span>
              </div>
              <div className="how-visual publish-visual">
                <div>
                  <span className="live-dot" /> Listo para compartir
                </div>
                <div className="tiny-preview">
                  <Box size={30} />
                  <span>
                    Tu mesa.<small>Roble · Natural · 150 cm</small>
                  </span>
                </div>
                <span className="fake-publish">
                  Publicar <ArrowUpRight size={14} />
                </span>
              </div>
              <h3>De tu estudio a tu web.</h3>
              <p>
                Revisa la experiencia, publica y comparte. Las configuraciones y
                solicitudes llegan a tu estudio.
              </p>
            </article>
          </div>
          <a className="m-link" href={start}>
            Vale, quiero crear el mío <ArrowUpRight size={17} />
          </a>
        </section>
        <section id="playground" className="playground-section">
          <div className="section-intro">
            <div>
              <span className="m-eyebrow">MENOS EXPLICAR. MÁS PROBAR.</span>
              <h2>
                Haz un cambio.
                <br />
                <em>Ya lo has entendido.</em>
              </h2>
            </div>
            <p>
              Esta mesa está hecha con las mismas piezas que tienes en el
              constructor. Cambia el acabado, ajusta el ancho y gira la vista.
            </p>
          </div>
          <div className="playground">
            <div className="playground-stage">
              <div className="playground-label">
                <span>
                  <span className="live-dot" /> DEMOSTRACIÓN INTERACTIVA
                </span>
                <span>3D EN TIEMPO REAL</span>
              </div>
              <Suspense
                fallback={<div className="empty">Preparando tu mesa…</div>}
              >
                <Model m={scene} s={{ top: finish }} />
              </Suspense>
              <span className="playground-hint">
                Arrastra para explorar cada ángulo
              </span>
            </div>
            <div className="playground-options">
              <span className="m-eyebrow">LA MESA FORMA</span>
              <h3>
                Un diseño.
                <br />
                Tu manera de verlo.
              </h3>
              <p>Un ejemplo sencillo de lo que puedes construir.</p>
              <label>01 — El acabado</label>
              <div className="demo-options">
                {demo.groups[0].options.map((o: any) => (
                  <button
                    key={o.id}
                    className={finish === o.id ? "active" : ""}
                    onClick={() => setFinish(o.id)}
                  >
                    <i style={{ background: o.color }} />
                    <span>{o.label}</span>
                    {finish === o.id && <Check size={14} />}
                  </button>
                ))}
              </div>
              <label className="range-label">
                02 — El ancho<strong>{width} cm</strong>
                <input
                  aria-label="Ancho de la mesa de ejemplo"
                  type="range"
                  min="100"
                  max="200"
                  step="10"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                />
              </label>
              <div className="demo-total">
                <span>Precio de ejemplo</span>
                <strong>{euro(240 + (finish === "oak" ? 0 : 20))}</strong>
              </div>
              <small>
                La medida cambia la geometría; en este ejemplo no cambia el
                precio.
              </small>
              <a className="m-button dark" href={start}>
                Ahora crea el tuyo <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
        </section>
        <section className="studio-section">
          <div className="studio-copy">
            <span className="m-eyebrow">
              LA EXPERIENCIA SIGUE DESPUÉS DEL CLIC
            </span>
            <h2>
              Bonito por fuera.
              <br />
              <em>
                Todo conectado
                <br />
                por dentro.
              </em>
            </h2>
            <p>
              El configurador es el comienzo. En tu estudio, las ideas guardadas
              se convierten en conversaciones, presupuestos y pedidos.
            </p>
            <ul>
              <li>
                <Check size={15} /> Un espacio privado para cada negocio
              </li>
              <li>
                <Check size={15} /> Configuraciones guardadas por tus clientes
              </li>
              <li>
                <Check size={15} /> Presupuestos, mensajes y seguimiento
              </li>
              <li>
                <Check size={15} /> Pagos mediante Stripe Connect, al activarlo
              </li>
            </ul>
          </div>
          <div
            className="studio-illustration"
            aria-label="Ilustración de la gestión de presupuestos"
          >
            <header>
              <span>Tu estudio</span>
              <span className="live-dot" />
            </header>
            <div className="illustration-order">
              <span className="order-symbol">
                <Box size={27} />
              </span>
              <div>
                <strong>Mesa a medida</strong>
                <small>Configuración de ejemplo</small>
              </div>
              <span className="illustration-badge">Presupuesto</span>
            </div>
            <div className="illustration-spec">
              <span>
                Material <strong>Roble</strong>
              </span>
              <span>
                Acabado <strong>Natural</strong>
              </span>
            </div>
            <div className="illustration-chat">
              <i>CL</i>
              <p>
                Me encanta esta combinación.
                <br />
                ¿Podemos incluir la entrega?
              </p>
            </div>
            <div className="illustration-chat reply">
              <p>
                Claro. Aquí tienes la propuesta
                <br />
                con todos los detalles.
              </p>
              <i>Y</i>
            </div>
            <footer>
              <span>Una conversación. Todo el contexto.</span>
              <ArrowUpRight size={16} />
            </footer>
          </div>
        </section>
        <section className="connect-section">
          <span className="m-eyebrow">TU PRODUCTO, DONDE YA VENDES</span>
          <h2>
            Tu web no tiene
            <br />
            que empezar de cero.
          </h2>
          <p>
            Inserta tu configurador con un iframe. O conecta tus herramientas al
            API y tus agentes al servidor MCP.
          </p>
          <div className="platforms">
            <span>WordPress</span>
            <span>Wix</span>
            <span>Squarespace</span>
            <span>Framer</span>
            <span>
              Tu propia web <ArrowUpRight size={16} />
            </span>
          </div>
          <small>
            La inserción comparte la experiencia de Yenze. Los carritos nativos
            de estas plataformas requieren adaptadores adicionales.
          </small>
          <div className="code-card">
            <div>
              <span>
                <i /> INSERCIÓN EN TU WEB
              </span>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      '<iframe src="https://TU-INSTALACION/?product=ID&embed=1" width="100%" height="800" title="Configura tu producto"></iframe>',
                    );
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? "Copiado" : "Copiar ejemplo"} <Code2 size={13} />
              </button>
            </div>
            <code>
              &lt;iframe src="tu-estudio/?product=tu-producto&amp;embed=1" /&gt;
            </code>
          </div>
        </section>
        <section className="ownership-section" id="ownership">
          <span className="m-eyebrow">ELIGE CÓMO HACERLO TUYO</span>
          <h2>
            El código es abierto.
            <br />
            <em>La ayuda puede acompañarte.</em>
          </h2>
          <div className="ownership-grid">
            <article>
              <span className="ownership-label">
                DISPONIBLE · AUTOALOJAMIENTO
              </span>
              <h3>
                Tu infraestructura.
                <br />
                Tu control.
              </h3>
              <p>
                Editor, motor, plantillas incluidas y backend en una
                distribución abierta. Conserva tus configuradores y tus
                archivos.
              </p>
              <ul>
                <li>Código y documentación incluidos</li>
                <li>API, MCP y SDK para insertar en tu web</li>
                <li>
                  Sin cuota de licencia del motor; infraestructura y servicios
                  externos por tu cuenta
                </li>
              </ul>
              <a
                className="m-button light"
                href="https://github.com/Josusanz/yenze-studio/releases"
                download
              >
                Descargar el proyecto <Download size={16} />
              </a>
            </article>
            <article>
              <span className="ownership-label">
                EN PREPARACIÓN · SERVICIO GESTIONADO
              </span>
              <h3>
                Céntrate en crear.
                <br />
                Con ayuda al otro lado.
              </h3>
              <p>
                Estamos preparando una oferta de alojamiento, copias,
                almacenamiento y soporte para quienes prefieran delegar la
                operación.
              </p>
              <ul>
                <li>Validación primero con negocios piloto</li>
                <li>Adaptación e integración según el proyecto</li>
                <li>Precios y disponibilidad todavía sin anunciar</li>
              </ul>
              <a className="m-link" href="/community.html">
                Conoce el estado del proyecto <ArrowUpRight size={16} />
              </a>
            </article>
          </div>
        </section>
        <section id="open-source" className="open-section">
          <div>
            <span className="m-eyebrow">
              LAS BUENAS HERRAMIENTAS CRECEN CUANDO SE COMPARTEN
            </span>
            <h2>
              Un producto propio.
              <br />
              Un proyecto
              <br />
              <em>de todos.</em>
            </h2>
            <p>
              Creemos que crear un configurador no debería estar reservado a
              quien puede pagar una plataforma cerrada. Por eso estamos
              construyendo Yenze con código abierto.
            </p>
            <div className="open-actions">
              <a
                className="m-button light"
                href="https://github.com/Josusanz/yenze-studio/releases"
                download
              >
                <Download size={16} /> Descargar el código
              </a>
              <a className="m-link" href="/community.html">
                Cómo contribuir <Heart size={16} />
              </a>
            </div>
            <a
              className="m-link repository-link"
              href={repo}
              target="_blank"
              rel="noreferrer"
            >
              Ver código, roadmap y contribuir en GitHub <Code2 size={16} />
            </a>
            <small>Beta abierta · AGPL-3.0 · Autoalojamiento disponible</small>
          </div>
          <div className="open-cards">
            <article>
              <Code2 size={22} />
              <h3>Instálalo a tu manera.</h3>
              <p>
                Código, documentación y pruebas para explorar y adaptar la
                herramienta.
              </p>
            </article>
            <article>
              <GitBranch size={22} />
              <h3>Aporta una posibilidad.</h3>
              <p>
                Una plantilla, una mejora de accesibilidad, una integración o
                una buena prueba.
              </p>
            </article>
            <article>
              <Heart size={22} />
              <h3>Ayuda a hacerlo mejor.</h3>
              <p>
                El proyecto aún está creciendo. Las limitaciones y tareas
                pendientes están a la vista.
              </p>
            </article>
          </div>
        </section>
        <section className="faq-section">
          <div>
            <span className="m-eyebrow">SIN LETRA PEQUEÑA</span>
            <h2>
              Buenas preguntas.
              <br />
              <em>Respuestas claras.</em>
            </h2>
            <p>El código es abierto. Las expectativas también.</p>
          </div>
          <div>
            {faqs.map(([question, answer], i) => (
              <article key={question}>
                <button
                  aria-expanded={faq === i}
                  aria-controls={"faq-" + i}
                  onClick={() => setFaq(faq === i ? null : i)}
                >
                  {question}
                  {faq === i ? <Minus size={17} /> : <Plus size={17} />}
                </button>
                {faq === i && <p id={"faq-" + i}>{answer}</p>}
              </article>
            ))}
          </div>
        </section>
        <section className="last-cta">
          <span className="m-eyebrow">TU SIGUIENTE PRODUCTO EMPIEZA AQUÍ</span>
          <h2>
            Lo que vendes,
            <br />
            <em>con más posibilidades.</em>
          </h2>
          <a className="m-button dark" href={start}>
            Vamos a crear el tuyo <ArrowUpRight size={18} />
          </a>
          <small>Empieza con una idea. El resto, paso a paso.</small>
        </section>
      </main>
      <footer className="marketing-footer">
        <a className="marketing-logo" href="/?page=home">
          yenze<span>MAKE IT YOURS.</span>
        </a>
        <p>
          Herramientas abiertas.
          <br />
          Productos con posibilidades.
        </p>
        <div>
          <a href="/community.html">Proyecto y comunidad</a>
          <a href="https://github.com/Josusanz/yenze-studio/releases" download>
            Código fuente
          </a>
          <a href="/privacy.html">Privacidad</a>
          <a href="/terms.html">Condiciones</a>
        </div>
        <span>
          © {new Date().getFullYear()} Yenze Studio contributors.
          <br />
          Construyéndose en abierto.
        </span>
      </footer>
    </div>
  );
}
function ImageMark() {
  return <Layers size={17} />;
}
function CornerMark() {
  return <span className="corner-mark" />;
}
