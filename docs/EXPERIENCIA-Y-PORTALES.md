# Dirección de producto: estudio, negocio y cliente

27-09-2026. Propuesta de arquitectura y experiencia; no funcionalidades ya implementadas. Amplía PRODUCTO.md con el backend por nicho, área de clientes e integraciones solicitados por Josu.

## Decisión principal

Un servicio compartido con aislamiento por empresa, no un backend generado y desplegado de cero para cada configurador. Cada empresa activa una plantilla de negocio que combina modelo de producto, motor visual, interfaz y módulos operativos. Los datos, permisos, configuraciones, versiones y eventos mantienen el mismo contrato.

La IA modifica configuraciones declarativas y propone extensiones. No genera arbitrariamente autenticación, pagos o acceso a datos para cada cliente. Las extensiones de código requieren revisión, pruebas y ejecución aislada; no introducir eval ni scripts de cliente en el motor de reglas.

## Tres superficies

1. Estudio de creación: proyectos, plantillas, archivos, capas/piezas, opciones, reglas/precios, vista previa y publicación. Usuarios: propietario, editor, agencia autorizada.
2. Panel de negocio: solicitudes, presupuestos, pedidos, clientes, estados, archivos aprobados, miembros e integraciones. Los operadores no necesitan acceso a credenciales o edición de precios.
3. Portal del comprador, con marca del comercio: configuraciones guardadas, duplicar/comparar, presupuestos, pedidos, documentos y conversaciones asociadas. El cliente solo accede a sus propios registros dentro de la empresa correcta.

El operador de Yenze gestiona suscripciones, uso y soporte desde un ámbito separado. Una agencia puede administrar varias empresas mediante membresías explícitas, sin convertir todos los clientes en una cuenta compartida.

## Qué cambia según el nicho

Núcleo común: cuentas, clientes, configuraciones, cotización, versiones, pedidos, documentos, notificaciones, miembros y estados auditables.

Muebles/carpintería: medidas, materiales, accesorios, validación de compatibilidades y lista de componentes cuando la plantilla la soporte.
Impresión/textil: texto, tipografías, área imprimible, resolución, revisión de arte final, aprobación del cliente y exportaciones específicas.
Espacios/eventos: dimensiones, colocación, compra/alquiler, fechas y revisión comercial; disponibilidad por fechas como módulo posterior.
Industrial: reglas paramétricas, CPQ y aprobaciones; salidas de fabricación únicamente mediante modelos y reglas validados.

Los módulos adaptan vocabulario, estados y campos. Ejemplo: impresión añade «Pendiente de aprobar diseño»; mobiliario añade «Medidas por confirmar». No mezclar estados de diseño, pago y envío en un único campo.

## Creación: cinco decisiones comprensibles

1. Qué vendes → recomendar una plantilla concreta con una demo interactiva. Muebles, producto personalizable o espacio; categorías avanzadas bajo búsqueda.
2. Qué puede cambiar el comprador → una opción real a la vez, editando sobre el preview. Evitar formularios vacíos con vocabulario técnico.
3. De dónde salen los visuales → carpeta, fotos, modelo 3D o demo propia. Mostrar resultado de importación y archivos sin asignar. Guardar siempre como borrador.
4. Cómo se vende → pedir presupuesto, compra en tienda conectada o pago alojado futuro. No activar botones sin una integración real.
5. Dónde se muestra → enlace alojado, insertar en web o conectar tienda. La interfaz muestra qué capacidades están disponibles y cuáles faltan.

Aplicar marca desde colores/logo aportados o desde una web autorizada, con revisión. Abrir «Ver como cliente» en cualquier paso. Publicar una versión inmutable y permitir volver atrás. El estado técnico (subida/generación/error) debe ser comprensible, reanudable y no perder el trabajo.

## Experiencia del cliente final

Configurar sin registrarse → guardar localmente → al elegir «Guardar para más tarde», identificar al cliente → recuperar en su portal desde otro dispositivo → solicitar presupuesto o comprar.

Propuesta inicial de identificación: enlace de acceso por email, enviado mediante proveedor real. No simular envíos. Entrada de cuenta en una página alojada de la marca, no depender de cookies de terceros dentro del iframe. El enlace público de compartir es diferente del acceso privado al portal y no autoriza consultar pedidos.

La revisión pedida por el comerciante crea otra versión; nunca altera silenciosamente el diseño aprobado. El comprador ve qué cambia y si varía el precio. Los pedidos conservan revisión, importe, moneda, opciones, medidas y assets originales. Archivar un acabado no debe romper un pedido anterior. Recomprar obliga a recalcular disponibilidad y precio actuales.

## Integración: tres niveles, explícitos en producto

A. Mostrar: enlace o widget/iframe. Configurador y portal alojados por Yenze. No implica sincronizar clientes ni cobros.
B. Captar: guardar diseño y enviar solicitud/presupuesto al panel Yenze. Funciona sin tienda online.
C. Vender: adaptador específico que valida precio, asocia productos, añade la configuración al carrito y recibe eventos de pedido/pago. No prometer el nivel C porque el CMS admita un iframe.

WordPress sin WooCommerce: A/B. Con WooCommerce: primer adaptador C propuesto.
Framer: empezar A/B con embed; evaluar proveedor de comercio elegido para C.
Squarespace: A/B en planes que permitan iframe/JavaScript; verificar el alcance de APIs y checkout antes de ofrecer C.
Wix: A/B inicialmente; el catálogo personalizado y comercio usan los mecanismos de Wix, con adaptador y pruebas propias.
Shopify: siguiente conector propuesto, sujeto a elección comercial y revisión de requisitos.

Si el checkout es externo, esa tienda es la autoridad para cobros, devoluciones y envío. Yenze conserva el diseño y refleja esos estados mediante eventos verificados, deduplicados y reconciliados. Evitar dobles pedidos o dos cuentas que muestren importes contradictorios. Un estado «pagado» nunca procede de un mensaje no autenticado del navegador.

Las cuentas de cliente de cada plataforma no son intercambiables. En el MVP el portal Yenze tiene identidad propia; el inicio de sesión unificado se negocia por conector, sin pedir contraseñas de tiendas ni mezclar usuarios por email sin verificar.

## Papel de los agentes y MCP

Dos entradas al mismo editor:
- Interfaz visual para comerciantes sin conocimientos técnicos.
- Cliente MCP (por ejemplo, un agente de código) para usuarios avanzados o agencias.

Ejemplo: «Usa la plantilla de sofá, importa estas imágenes, crea los tejidos y añade 80 € al cuero». El agente prepara un borrador estructurado, pasa validadores y entrega la preview con un resumen de cambios. El comerciante puede continuar visualmente. Ambos caminos usan los mismos permisos y motor de reglas/precios.

No obligar a cada comerciante a instalar ni pagar una herramienta de programación. Un asistente dentro del SaaS puede incorporarse después con facturación y límites propios. Conectar el agente del cliente mediante MCP no significa reutilizar automáticamente su suscripción para servir IA a todos los clientes del SaaS.

## Primer producto comercial recomendado

Hipótesis: muebles y productos por acabados/accesorios, con capas 2D y opción de presupuesto. Módulos admin y cliente reales desde el primer piloto, aun con pocas funciones. No construir ocho verticales y cuatro checkouts simultáneamente.

Recorrido de aceptación:
1. Una empresa crea un producto de dos grupos desde carpeta sin cambiar código.
2. Lo publica en una página ajena mediante embed.
3. Un visitante configura, guarda con una cuenta verificada y abre su diseño desde otro dispositivo.
4. Envía solicitud; el admin la ve con opciones e importe y propone una revisión.
5. El cliente aprueba una versión y consulta el estado.
6. Una segunda empresa y un segundo comprador no acceden a ninguno de esos datos.
7. En la fase WooCommerce, un pedido de prueba conserva la configuración y recibe estados sin duplicados.

Medir con usuarios reales: tiempo hasta primera preview, abandono de importación, pasos que requieren ayuda, errores de precio/reglas y recuperación correcta de diseños. «Más intuitivo del mercado» es una aspiración; la evidencia son tareas completadas sin asistencia. Objetivo inicial de investigación: tres comerciantes completan el mismo recorrido con sus propios archivos. No anunciar un tiempo fijo universal antes de medirlo.

## Referencias de integración revisadas

- WooCommerce Store API: https://developer.woocommerce.com/docs/apis/store-api/extending-store-api/
- Wix catálogo externo: https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/catalogs/catalog-service-plugin/introduction
- Framer embeds: https://www.framer.com/help/articles/how-to-add-an-iframe-or-embed-script/
- Squarespace bloques de código y planes: https://support.squarespace.com/hc/en-us/articles/206543167-Code-blocks
