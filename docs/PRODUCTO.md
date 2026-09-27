# Yenze Studio: de tus archivos a un configurador vendible

Propuesta de trabajo — 27 de septiembre de 2026. Pendiente de elegir el primer segmento con Josu. El núcleo por capas se prepara como componente reutilizable; no implica haber descartado espacios 3D o personalización gráfica.

## Producto y ventaja a comprobar

Un SaaS donde una marca o agencia convierte su catálogo visual en configuradores, ajusta reglas y precios, elige una experiencia de compra y la publica en su web. Un agente puede hacer las mismas operaciones a través de MCP.

Promesa inicial: «Trae tus imágenes y opciones. Monta un configurador y publícalo en tu web». No prometer «cualquier foto se convierte en un producto 3D exacto», «cualquier ecommerce se integra automáticamente» ni «sustitución completa de Zakeke» en la primera entrega.

La hipótesis comercial es reducir el trabajo de preparar y mantener un configurador. Medir minutos desde una carpeta real hasta una preview correcta, cuántas asignaciones hay que corregir y cuánto soporte requiere publicar en una tienda. Comparar con el proceso real que Josu ya conoce en WP Configurator. La IA será una ayuda para preparar borradores, no la autoridad de precios ni fabricación.

Primer cliente propuesto: agencias y marcas con productos por acabados y accesorios, imágenes propias y un catálogo acotado. Primera integración comercial propuesta: WooCommerce por la experiencia previa; confirmar antes de construir el conector. El runtime embebible debe funcionar también en una web sin ecommerce, con solicitud de presupuesto.

## Tres motores visuales sobre el mismo producto

1. Capas 2D: renders/fotos PNG o WebP alineadas, varias vistas, capas, opciones, precios y dependencias. Es la ruta inicial más controlable.
2. Producto 3D: GLB/glTF con piezas y materiales identificados; cambios de acabado, accesorios, cámaras y medidas cuando el modelo lo permita. Añadir AR después de resolver optimización y compatibilidad.
3. Espacios y producto paramétrico: reutilizar la experiencia de ESPACIO y ENCAJA como verticales. Las dimensiones y fabricación necesitan reglas específicas por fabricante.

La personalización de impresión (textos, logos, áreas imprimibles, resolución, sangrado, tipografías y exportaciones de producción) es otro módulo. No equiparar una captura PNG de preview a un archivo listo para fabricar.

## Plantillas: tres conceptos distintos

- Plantilla de producto: estructura de opciones, compatibilidades, precios y esquema de assets. Ejemplos: sofá por tejidos, armario por puertas, vehículo por componentes.
- Plantilla de interfaz: acordeón lateral, pasos guiados, selección compacta, pantalla de producto. Todas consumen el mismo estado, no copias de un proyecto React por cliente.
- Plantilla de escena: luces, cámaras, fondo, escala y puntos de interacción del renderizador 3D.

Las plantillas existentes de Yenze son experiencia y posibles fuentes de componentes, no configuradores genéricos ya preparados para SaaS. Auditar cada activo: modelos comprados o referencias de marcas no se convierten automáticamente en assets redistribuibles. Priorizar geometría original y archivos aportados por cada cliente.

## Flujo del comerciante

Crear proyecto → elegir motor y plantilla → aportar archivos → revisar importación → configurar opciones/reglas/precios → comprobar combinaciones → obtener preview → publicar una versión → conectar carrito o presupuesto.

La primera pantalla del SaaS es un estudio de proyectos. Separar este panel de creación de la experiencia del comprador que hemos diseñado en ESPACIO. El comprador no verá ajustes técnicos, claves ni herramientas de importación.

## Importación desde carpetas

La carpeta ordenada produce un borrador determinista. El número inicial define el orden de capa; las subcarpetas definen grupo y opción; el nombre del archivo identifica la vista. El núcleo inicial ya implementa esta convención.

Para carpetas sin convención: mostrar una bandeja de archivos con propuestas de agrupación, renombrado y asignación manual. No aceptar ciegamente una inferencia de IA. La UI debe detectar imágenes sin transparencia, tamaños incompatibles, vistas ausentes y opciones duplicadas.

Tres formas de aportar archivos:

- Selección de carpeta o ZIP desde el navegador, con una zona para revisar lo detectado.
- Drive/Dropbox/S3 mediante conectores autorizados y con selección explícita de carpeta.
- Un agente local lee la carpeta autorizada y sube los archivos usando URLs de subida temporales. Un servidor MCP remoto no puede leer por sí mismo el disco del usuario.

La sincronización posterior compara hash y referencia estable. Cambiar un archivo actualiza el borrador y muestra el impacto; la versión vendida y los pedidos históricos no cambian sin publicar una nueva versión.

## Fotos → 2D y 3D

Separar tres casos:

- Ya hay capas transparentes: importar y alinear; no hace falta IA.
- Hay una foto plana: proponer recorte, máscaras y variantes como borradores. Una foto no trae las piezas ocultas ni capas separadas; hace falta revisión visual.
- Se quiere un modelo 3D: trabajo asíncrono con proveedor intercambiable. Meshy documenta una API multiimagen; comparar resultados con muestras reales antes de elegir proveedor.

Pipeline propuesto: subida → calidad de fotos → trabajo de generación con límite de coste → modelo original → optimización → escala/cámaras/materiales → identificación de piezas → revisión → publicación. Guardar procedencia y coste. Un modelo generado puede servir para visualizar y aun así no servir para configurar partes o fabricar. Las medidas exactas deben venir del catálogo, CAD o entrada verificada.

No entrenar un modelo propio para el MVP. Tampoco hacer llamadas de generación desde el navegador con credenciales del proveedor. Las generaciones se facturan o descuentan de un saldo separado; no ofrecerlas ilimitadas sin datos de coste.

## MCP, API y conectores: responsabilidades

MCP es la interfaz para agentes. API/SDK/webhooks son la base estable para tiendas, interfaces y pedidos. Un adaptador de WooCommerce o Shopify traduce productos, variantes, carrito y eventos; una conexión MCP no elimina ese trabajo.

Herramientas MCP propuestas (todavía no implementadas):

- `templates.list`, `configurators.create`, `configurators.get`
- `assets.create_upload`, `imports.plan`, `imports.apply`
- `options.update`, `rules.validate`, `configurations.evaluate`
- `previews.create`, `publications.publish`, `publications.rollback`
- `connections.list`, `connections.test`
- `generation.estimate`, `generation.start`, `generation.status`

El agente crea un plan de cambios revisable antes de aplicar importaciones grandes. Publicar requiere un permiso específico y referencia a una revisión validada. Autorización por organización, scopes mínimos, registro de operaciones, idempotencia y credenciales de tiendas cifradas. El acceso MCP remoto usará el protocolo y SDK oficial vigentes al implementarlo; no exponer un endpoint casero solo porque acepte JSON.

El primer widget será iframe versionado con SDK pequeño: `ready`, `selection.changed`, `quote.requested`, `cart.requested`. Validar origen y esquema de mensajes, restringir dominios configurados, evitar datos privados en el manifiesto público. Integraciones con políticas que impidan iframe/script requieren adaptador o enlace alojado.

## Base SaaS propuesta

- UI: React/TypeScript. Editor de capas y configurador comprador comparten el motor, no el estado de administración.
- API: contratos versionados para configuradores, assets, evaluación y publicación. Mismo servicio detrás de UI y MCP.
- Persistencia: PostgreSQL con aislamiento de organización verificado en cada operación. Assets en almacenamiento de objetos/CDN con URLs firmadas para privados.
- Trabajos: cola y workers para importación, optimización, renders y generación 3D. Fuera de las peticiones del frontend.
- Vercel: panel, runtime y API compatibles con sus límites. No usar el SQLite local de ESPACIO como base de datos multiempresa persistente en funciones efímeras.
- Identidad: organizaciones, miembros y roles propietario/editor/lector. No reutilizar las licencias de ZIP como autorización SaaS sin migración explícita.
- Comercial: suscripción, límites de configuradores publicados y almacenamiento; cómputo de IA medido. Precio pendiente de validar con pilotos, no derivado de las etiquetas $ de una comparativa.

Entidades: Organization, Membership, Configurator, DraftRevision, PublishedVersion, Asset, AssetVersion, OptionGroup, Option, Rule, TemplateVersion, StoreConnection, ConfigurationSnapshot, Quote, OrderBinding, GenerationJob, UsageEvent.

Precios: unidades menores enteras y moneda explícita; cálculo en servidor desde versión publicada. En el primer núcleo EUR usa céntimos y no admite descuentos negativos. La fiscalidad, cantidades y monedas de distinta precisión necesitan su contrato propio antes de checkout.

Pedidos: guardar IDs de variante, configuración completa, revisión inmutable, precio validado y assets exactos. Webhooks autenticados e idempotentes; reintentos no duplican pedidos. No basta con mandar una imagen al carrito. La privacidad del cliente y las credenciales no viajan en el widget público.

## Entregas verificables

A. Núcleo local (iniciado): importador de convención de carpetas, grupos/opciones/vistas y evaluación de compatibilidad/precio. Cinco pruebas automatizadas. Sin panel visual ni SaaS.

B. Primer recorrido utilizable: panel de proyectos, subida por carpeta, revisión de capas, editor de opciones, preview 2D real, exportación/importación del manifiesto y widget embebible. Aceptación: dos productos distintos se crean sin cambiar código; su selección cambia la composición y el precio; una incompatibilidad bloquea finalizar.

C. Piloto comercial: organizaciones y permisos, PostgreSQL/storage, publicación versionada, dominios autorizados, presupuesto y un conector ecommerce. Aceptación: dos empresas no acceden a datos ajenos, el carrito se recalcula en servidor y el pedido mantiene su configuración tras editar el catálogo.

D. MCP sobre API: crear un configurador con assets subidos por un agente, revisar preview y publicar con permisos específicos. Aceptación: mismas reglas y resultados desde UI, API y MCP; tenant y scopes no eludibles por parámetros.

E. Producto 3D: GLB reales, asociación de mallas/materiales a opciones, carga móvil optimizada y generación por fotos como borrador con revisión. Aceptación: demo con referencias reales, medidas verificadas y costes medidos; no prometer fabricación desde geometría generada.

F. Verticales: personalización gráfica y salidas de impresión; medidas paramétricas/CPQ y fabricación; escena espacial/AR. Priorizar según clientes y datos de uso, no implementar ocho productos empresariales a la vez.

## Competencia y referencias revisadas

WP Configurator separa experiencias por capas 2D y 3D. Zakeke ya ofrece API y conexiones ecommerce: ser multiplataforma por sí solo no es una ventaja nueva. Salsita presenta configuradores complejos con visual CPQ; ese alcance es distinto de un primer editor de capas.

La lista de competidores aportada por Josu sirve de mapa inicial; no se han verificado sus etiquetas de precio ni todas sus capacidades. La diferenciación propuesta —carpetas + edición visual + agentes + plantillas portables— es una hipótesis, no una afirmación de exclusividad en el mercado.

- https://wpconfigurator.com/products/
- https://documentation.wpconfigurator.com/docs/pro/better-experience-with-wp-configurator-pro/import-export-configurators/
- https://docs.zakeke.com/docs/API/Integration/Integrating-Zakeke
- https://docs.zakeke.com/docs/API/Integration/3D-product-configurator/configurator-UI-API
- https://salsita.ai/
- https://docs.meshy.ai/en/api/multi-image-to-3d
- https://modelcontextprotocol.io/specification/2025-06-18/server/tools

No se han conectado cuentas, contratado servicios, generado modelos con APIs de pago ni publicado cambios externos.
