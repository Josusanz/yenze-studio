/** Starting questions, not industry-specific tax or manufacturing rules. */
/** @type {Array<{id:string,label:string,description:string,keywords:string,questions:Array<{label:string,answers:string}>}>} */
export const industries = /** @type {any} */ (
  [
    [
      "general",
      "Otros productos",
      "Cualquier idea tiene sitio aquí.",
      "producto",
      [
        ["Versión", "Esencial, Completa"],
        ["Acabado", "Natural, Personalizado"],
      ],
    ],
    [
      "furniture",
      "Muebles y espacios",
      "Materiales, acabados y medidas.",
      "mesa sofa silla armario hogar",
      [
        ["Material", "Madera, Metal"],
        ["Acabado", "Natural, Lacado"],
      ],
    ],
    [
      "textile",
      "Moda y accesorios",
      "Prendas, tallas y personalización.",
      "camiseta ropa bolso textil",
      [
        ["Talla", "S, M, L, XL"],
        ["Color", "Blanco, Negro, Azul"],
      ],
    ],
    [
      "service",
      "Servicios y experiencias",
      "Sesiones, formatos y extras.",
      "curso asesoria viaje evento",
      [
        ["Modalidad", "Online, Presencial"],
        ["Duración", "Una sesión, Tres sesiones"],
      ],
    ],
    [
      "food",
      "Alimentación y bebidas",
      "Formatos, sabores y preparación.",
      "cafe tarta comida bebida",
      [
        ["Formato", "Individual, Para compartir"],
        ["Sabor", "Clásico, Especial"],
      ],
    ],
    [
      "technology",
      "Tecnología",
      "Equipamiento y accesorios.",
      "ordenador pc portatil electronica",
      [
        ["Equipamiento", "Esencial, Avanzado"],
        ["Accesorios", "Sin accesorios, Con accesorios"],
      ],
    ],
    [
      "mobility",
      "Vehículos y movilidad",
      "Versiones, acabados y equipamiento.",
      "coche bicicleta camper moto",
      [
        ["Versión", "Urbana, Touring"],
        ["Equipamiento", "Estándar, Ampliado"],
      ],
    ],
    [
      "gifts",
      "Regalos y papelería",
      "Presentaciones, packs y detalles.",
      "regalo taza libreta boda",
      [
        ["Presentación", "Individual, Pack regalo"],
        ["Embalaje", "Estándar, Caja especial"],
      ],
    ],
    [
      "construction",
      "Construcción y exterior",
      "Materiales y opciones de instalación.",
      "ventana pergola puerta jardin",
      [
        ["Material", "Aluminio, Madera"],
        ["Instalación", "Solo suministro, Con instalación"],
      ],
    ],
    [
      "beauty",
      "Belleza y cuidado",
      "Rutinas, formatos y packs.",
      "cosmetica perfume jabon",
      [
        ["Formato", "Individual, Pack"],
        ["Presentación", "Estándar, Regalo"],
      ],
    ],
    [
      "sports",
      "Deporte y ocio",
      "Tamaños, kits y complementos.",
      "deporte tabla skate gimnasio",
      [
        ["Equipamiento", "Básico, Completo"],
        ["Complementos", "Sin complementos, Con complementos"],
      ],
    ],
    [
      "industry",
      "Equipamiento profesional",
      "Versiones y puesta en marcha.",
      "maquina industrial herramienta",
      [
        ["Versión", "Estándar, Profesional"],
        ["Servicio", "Solo equipo, Puesta en marcha"],
      ],
    ],
  ].map(([id, label, description, keywords, questions]) => ({
    id,
    label,
    description,
    keywords,
    questions: questions.map(([label, answers]) => ({ label, answers })),
  }))
);
export function setupGroups(setup) {
  if (
    !setup ||
    typeof setup.name !== "string" ||
    !setup.name.trim() ||
    setup.name.trim().length > 120 ||
    !Number.isSafeInteger(setup.basePrice) ||
    setup.basePrice < 0 ||
    setup.basePrice > 100000000 ||
    !industries.some((i) => i.id === setup.industry) ||
    !Array.isArray(setup.questions) ||
    !setup.questions.length ||
    setup.questions.length > 20
  )
    throw Error("Revisa el nombre, el sector y el precio de tu producto.");
  let total = 0;
  return setup.questions.map((q, i) => {
    if (
      !q ||
      typeof q.label !== "string" ||
      !q.label.trim() ||
      q.label.trim().length > 80 ||
      typeof q.answers !== "string" ||
      q.answers.length > 8100
    )
      throw Error("Pon un nombre y respuestas a cada pregunta.");
    const answers = q.answers
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    total += answers.length;
    if (
      !answers.length ||
      answers.length > 100 ||
      answers.some((a) => a.length > 80) ||
      new Set(answers.map((a) => a.toLocaleLowerCase())).size !==
        answers.length ||
      total > 500
    )
      throw Error(
        "Usa respuestas distintas, de hasta 80 caracteres (máximo 500 en total).",
      );
    return {
      id: "question_" + i,
      label: q.label.trim(),
      order: i,
      required: true,
      effect: "choice",
      default: "answer_0",
      options: answers.map((label, n) => ({
        id: "answer_" + n,
        label,
        priceDelta: 0,
      })),
    };
  });
}
