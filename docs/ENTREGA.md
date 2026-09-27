> Registro histórico de una entrega local. Para el estado actual, consulta README.md y ROADMAP.md en la raíz del repositorio.

# Estado de la entrega — 27 de septiembre de 2026

Versión de desarrollo independiente en `projects/yenze-studio`. No se han modificado ni desplegado ESPACIO ni la tienda de licencias anterior.

## Funciones y experiencia verificadas

- Asistente de tres pasos para producto, preguntas y fuente visual. Creación sin imágenes, con fotos completas, capas, GLB o piezas 3D.
- Opciones padre/hijo/subhijo, ordenación, precios que excluyen ramas ocultas, reglas y validación de publicación.
- Constructor y prueba del comprador con miniaturas limitadas, panel lateral, canvas amplio, deshacer/rehacer y conservación de cambios escritos durante una petición lenta de guardado.
- Importación de carpeta, texturas GLB con KHR_texture_transform, nombres de piezas normalizados y reconocimiento de materiales utilizados. Las preguntas no visuales se conservan al importar un GLB. Validación oficial de Khronos antes de almacenar; el GLB SheenChair real pasó sin errores.
- Papelera y restauración a borrador con historial de pedidos conservado.
- Web comercial propia: demostraciones 2D/3D interactivas, inicio del asistente, FAQ, documentación comunitaria y descarga de fuentes. Navegación móvil verificada.
- Código original con licencia AGPL-3.0-only y guía de contribución; repositorio público aún pendiente. El ZIP excluye datos privados, uploads y credenciales.

## Evidencia automatizada

- Build TypeScript/Vite verificado.
- 18 pruebas unitarias/API: aislamiento entre empresas, revisiones, publicación, configuraciones inmutables, presupuestos, borrado/restauración, ramas, capas, GLB, copia y recuperación SQLite, Stripe, Meshy y MCP.
- Siete recorridos Chrome: importación de carpeta/GLB; creación sin imágenes con tres niveles; fotos de distintos tamaños; escena 3D con deshacer/rehacer; guardado lento sin pérdida de edición; presupuesto de principio a fin; web comercial y móvil.
- Cero avisos en `npm audit --omit=dev` en la comprobación del 27 de septiembre. No equivale a una auditoría de seguridad.
- Stripe: fixtures firmados, cuentas/importes/monedas, idempotencia, reembolsos y cliente Checkout simulado. No se ha efectuado ningún cargo real.
- Meshy: consentimiento, propiedad de fotos, cuotas, duplicados, estado e importación con respuestas simuladas. No se han consumido créditos ni verificado una generación real.

## Seis ejemplos locales persistentes

Creados y modificados mediante controles del navegador, sin escribir sus manifiestos directamente en la base. Sus identificadores se guardan en `data/local-examples.json`, no en el código distribuido.

| Ejemplo | Entrada del usuario | Combinación comprobada | Total de ejemplo |
|---|---|---|---|
| Café a tu manera | Dos fotografías reales atribuidas | Latte frío + avena | 4,50 € |
| Mentoría a tu ritmo | Ningún archivo | Presencial, empresa, 10–30 km, tres sesiones | 245 € |
| Butaca Nube | Dos imágenes generadas para el proyecto | Azul noche | 455 € |
| Mesa Forma | Constructor de piezas 3D | Tablero azul profundo | 265 € |
| Bicicleta Urbana | Carpeta de capas originales alineadas | Azul, cesta y guardabarros | 450 € |
| Silla Atelier | GLB texturizado CC0 de Khronos/Wayfair | Oliva y estructura oscura | 205 € |

Se verificaron los seis totales, persistencia al recargar, guardado en el portal y ausencia de desbordamiento horizontal a 390px. Quedan seis configuraciones guardadas y dos solicitudes de presupuesto (mentoría y bicicleta) en la cuenta local utilizada para las pruebas. Los productos previos no se eliminaron.

Capturas en `artifacts/examples/`: biblioteca, comprador, móvil y portal. La revisión visual comprobó la geometría real importada y la composición de capas. No es un estudio de usabilidad con participantes externos.

Copia de los datos locales: `data/backups/studio-examples-2026-09-27.sqlite`. La herramienta de copia online y restauración a una carpeta nueva dispone de prueba de integridad y de cambios WAL.

## Límites para comercializar

Pendientes: Stripe Connect, correo y Meshy con cuentas reales; verificación de email; auditoría operativa, retención, observabilidad y carga; pruebas en el despliegue elegido. Hay un backup local probado, pero el operador debe implementar cifrado, programación y recuperación en su infraestructura. No se ha desplegado en internet ni probado Docker.

No hay suscripciones de comercios, motor fiscal, fabricación ni conectores con carritos nativos. Los sitios externos reciben un iframe; el shortcode WordPress no se ha validado en una instalación WordPress real. La composición 3D usa primitivas y los modelos complejos se importan preparados. Una fotografía no se convierte automáticamente en un modelo técnico ni en capas alineadas.

No se garantiza ausencia de fallos ni superioridad frente a competidores. README, SECURITY y el registro de referencias documentan el alcance real.
