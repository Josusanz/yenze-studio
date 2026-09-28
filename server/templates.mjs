import { readFileSync } from "node:fs";
const svg = (content) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="850" viewBox="0 0 1000 850">${content}</svg>`;
const cabinet = (color) =>
  svg(
    `<path d="M230 190 650 150 790 245 375 295Z" fill="${color}"/><path d="M230 190 375 295V690L230 580Z" fill="${color}"/><path d="M375 295 790 245V620L375 690Z" fill="${color}"/><path d="M230 190 375 295V690L230 580Z" fill="#000" opacity=".14"/><path d="M375 295 790 245V620L375 690Z" fill="#fff" opacity=".1"/><path d="m390 311 182-22v354l-182 30Zm197-23 186-23v343l-186 33Z" fill="none" stroke="#000" opacity=".13" stroke-width="3"/><path d="M251 594v57m512-25v45m-370 21v48" stroke="#253951" stroke-width="12" stroke-linecap="round"/>`,
  );
const handles = (color) =>
  svg(
    `<path d="M551 426v54m54-62v54" stroke="${color}" stroke-width="9" stroke-linecap="round"/>`,
  );
const sofa = (color) =>
  svg(
    `<ellipse cx="500" cy="690" rx="300" ry="28" fill="#253951" opacity=".06"/><path d="m207 500 93-155 404-25 85 156-45 178-482 16Z" fill="${color}"/><path d="M300 345v204l404-20V320" fill="#fff" opacity=".13"/><path d="m281 543 426-23 34 98-487 22Z" fill="#fff" opacity=".17"/><path d="M240 465q-48-3-48 36v130q0 38 55 31l42-6V500q-3-40-49-35Zm506-5q45-6 47 30v119q0 39-55 45l-29 2V490q0-26 37-30Z" fill="${color}"/><path d="m500 337 3 196m-2 0 2 96" stroke="#000" opacity=".09" stroke-width="3"/><path d="M235 666v30m509-45v37" stroke="#5e5043" stroke-width="12" stroke-linecap="round"/>`,
  );
const cushions = (color) =>
  svg(
    `<path d="m310 436 82-9 19 96-80 10Z" fill="${color}"/><path d="m602 418 73 10-11 85-77-4Z" fill="${color}"/>`,
  );
const shirt = (color) =>
  svg(
    `<ellipse cx="500" cy="735" rx="210" ry="22" fill="#253951" opacity=".04"/><path d="m366 151 76-22q60 70 116 0l77 22 130 164-104 83-53-59 14 367q-116 33-245 0l15-367-53 59-104-83Z" fill="${color}" stroke="#253951" stroke-opacity=".13" stroke-width="3"/><path d="M442 129q57 120 116 0" fill="none" stroke="#253951" stroke-opacity=".16" stroke-width="8"/><path d="m400 345-10 335m211-335 9 335" stroke="#253951" opacity=".05" stroke-width="15"/>`,
  );
const print = (color) =>
  svg(
    `<rect x="441" y="292" width="116" height="116" rx="58" fill="${color}"/><path d="m467 347 21 21 42-43" fill="none" stroke="white" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
  );
const option = (id, label, color, priceDelta = 0) => ({
  id,
  label,
  color,
  priceDelta,
});
export const templates = [
  {
    id: "table-3d",
    name: "Mesa Forma",
    niche: "Muebles 3D",
    description:
      "Una mesa preparada con acabados y precio. Ajusta sus piezas y hazla tuya.",
    basePrice: 24000,
    groups: [],
  },
  {
    id: "shirt-3d",
    name: "Camiseta Studio",
    niche: "Textil 3D",
    description: "Frontal y espalda. Textos e imágenes sobre una prenda 3D.",
    basePrice: 2900,
    groups: [],
  },
  {
    id: "guided",
    name: "Mi producto",
    niche: "A tu medida",
    description:
      "Empieza por las decisiones de tu cliente. No necesitas imágenes.",
    basePrice: 0,
    groups: [],
  },
  {
    id: "images",
    name: "Desde mis imágenes",
    niche: "Fotos de producto",
    description: "Una imagen por acabado o variante. Sin preparar capas.",
    basePrice: 0,
    groups: [],
  },
  {
    id: "scene",
    name: "Construir en 3D",
    niche: "Escena 3D",
    description: "Combina piezas y ajusta medidas, posiciones y materiales.",
    basePrice: 0,
    groups: [],
  },
  {
    id: "cabinet",
    name: "Mueble a medida",
    niche: "Mobiliario",
    description: "Acabados y herrajes, con precio por opción.",
    basePrice: 42000,
    groups: [
      {
        id: "finish",
        label: "Acabado",
        options: [
          option("oak", "Roble natural", "#cbb28c"),
          option("ivory", "Blanco seda", "#e8e5dc", 2500),
          option("walnut", "Nogal", "#89705a", 6500),
        ],
      },
      {
        id: "handle",
        label: "Tiradores",
        options: [
          option("black", "Negro mate", "#303b44"),
          option("brass", "Latón", "#b9924e", 1500),
        ],
      },
    ],
    render: [cabinet, handles],
  },
  {
    id: "sofa",
    name: "Sofá modular",
    niche: "Mobiliario",
    description: "Tejidos y cojines que cambian con tu cliente.",
    basePrice: 89000,
    groups: [
      {
        id: "fabric",
        label: "Tapizado",
        options: [
          option("stone", "Piedra", "#b2aca0"),
          option("blue", "Azul noche", "#50677b", 6000),
          option("clay", "Terracota", "#b97e66", 4000),
        ],
      },
      {
        id: "cushions",
        label: "Cojines",
        options: [
          option("cream", "Lino", "#e3dbc9"),
          option("ochre", "Mostaza", "#cba75d", 2000),
        ],
      },
    ],
    render: [sofa, cushions],
  },
  {
    id: "shirt",
    name: "Textil por capas",
    niche: "Textil",
    description: "Colores y diseños preparados en capas.",
    basePrice: 2900,
    groups: [
      {
        id: "fabric",
        label: "Color",
        options: [
          option("white", "Blanco", "#f5f4ee"),
          option("navy", "Azul tinta", "#33485e"),
          option("sage", "Salvia", "#a9b3a6"),
        ],
      },
      {
        id: "design",
        label: "Diseño",
        options: [
          option("blue", "Sello azul", "#355a88"),
          option("clay", "Sello tierra", "#b77655", 300),
        ],
      },
    ],
    render: [shirt, print],
  },
  {
    id: "empty",
    name: "Tu carpeta, tu producto",
    niche: "Capas 2D",
    description: "Importa PNG o WebP alineados y crea las opciones.",
    basePrice: 0,
    groups: [],
  },
  {
    id: "model",
    name: "Tu modelo 3D",
    niche: "Producto 3D",
    description: "Sube un GLB y configura sus materiales.",
    basePrice: 0,
    groups: [],
  },
];
export async function makeTemplate(id, storeAsset) {
  const t = templates.find((t) => t.id === id);
  if (!t) throw Error("Plantilla no encontrada.");
  const manifest = {
    schemaVersion: 1,
    kind:
      id === "model" || id === "shirt-3d"
        ? "model-3d"
        : id === "scene" || id === "table-3d"
          ? "scene-3d"
          : id === "images"
            ? "images-2d"
            : id === "guided"
              ? "form"
              : "layers-2d",
    objects: [],
    name: t.name,
    currency: "EUR",
    basePrice: t.basePrice,
    canvas: { width: 1000, height: 850 },
    views: ["frontal"],
    groups: [],
    rules: [],
    model: null,
  };
  if (id === "table-3d") {
    manifest.objects = [
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
          id: `leg_${i}_${j}`,
          name: `Pata ${i * 2 + j + 1}`,
          type: "cylinder",
          color: "#394b55",
          size: [0.07, 0.73, 0.07],
          position: [x, 0.365, z],
          rotation: 0,
        })),
      ),
    ];
    manifest.groups = [
      {
        id: "finish",
        label: "Acabado del tablero",
        effect: "material",
        material: "top",
        order: 0,
        required: true,
        default: "oak",
        options: [
          option("oak", "Roble", "#c8ad83"),
          option("blue", "Azul noche", "#36556b", 2000),
          option("clay", "Arcilla", "#b27862", 2000),
        ],
      },
    ];
    return manifest;
  }
  if (id === "shirt-3d") {
    manifest.model = await storeAsset(
      readFileSync(
        new URL("../public/models/atelier-shirt-v2.glb", import.meta.url),
      ),
      "model/gltf-binary",
      "atelier-shirt-v2.glb",
    );
    manifest.modelInfo = {
      materials: ["Cotton"],
      nodes: [0, 1, 2, 3].map((n) => ({
        name: "shirt_" + n,
        label: "Prenda · pieza " + (n + 1),
      })),
    };
    manifest.personalization = {
      type: "shirt",
      version: 1,
      model: "atelier-shirt-v2",
      cleanStart: true,
      design: { version: 1, layers: [] },
    };
    manifest.description =
      "Tu camiseta, tu firma. Diseña el frontal y la espalda. Revisa la prueba con tu proveedor antes de imprimir.";
    manifest.groups = [
      {
        id: "fabric",
        label: "Color de la prenda",
        order: 0,
        required: true,
        effect: "material",
        material: "Cotton",
        default: "chalk",
        options: [
          option("chalk", "Tiza", "#eeece7"),
          option("ink", "Tinta", "#252a32"),
          option("sage", "Salvia", "#8a9c87"),
          option("clay", "Arcilla", "#b56d55"),
        ],
      },
      {
        id: "size",
        label: "Talla",
        order: 1,
        required: true,
        effect: "choice",
        default: "m",
        options: ["XS", "S", "M", "L", "XL", "XXL"].map((s) => ({
          id: s.toLowerCase(),
          label: s,
          priceDelta: 0,
        })),
      },
    ];
    return manifest;
  }
  // Keep writes sequential inside the caller's transaction: a failed upload must
  // not leave queued writes running after rollback, and each quota sees prior assets.
  manifest.groups = [];
  for (const [n, g] of t.groups.entries()) {
    const options = [];
    for (const o of g.options) {
      options.push({
        ...o,
        assets: {
          frontal: await storeAsset(
            Buffer.from(t.render[n](o.color)),
            "image/svg+xml",
            `${g.id}-${o.id}.svg`,
          ),
        },
      });
    }
    manifest.groups.push({
      ...g,
      order: n,
      required: true,
      default: g.options[0].id,
      options,
    });
  }
  return manifest;
}
