# Yenze Studio — configuradores abiertos, paso a paso

SaaS independiente del configurador ESPACIO y de la tienda de licencias Yenze existente. No modifica ni publica ninguno de esos proyectos.

## Arrancar

Node 24 o posterior.

```sh
git clone https://github.com/Josusanz/yenze-studio.git
cd yenze-studio
npm ci
cp .env.example .env
npm run dev
```

Web y estudio: http://localhost:3060 · API: http://localhost:3061. Crea una cuenta con nombre de negocio para ser administrador; no hay contraseñas predeterminadas ni datos de ejemplo precargados. La base SQLite y los archivos se conservan en `data/`, fuera del código fuente.

## Qué funciona

- Empresas aisladas, usuarios, sesiones HttpOnly, propietario y editores; selección de empresa para colaboradores.
- Asistente de tres pasos: producto, opciones y punto de partida. Ficha configurable publicable sin imágenes.
- Fotografías completas de distintos tamaños, capas 2D, importación GLB y escenas 3D de piezas editables.
- Padres, hijos y subhijos hasta 12 niveles; las elecciones ocultas se eliminan de la selección y del precio.
- Árbol de opciones con reordenación, vista de prueba compartida con el comprador, deshacer y rehacer.
- Papelera con restauración a borrador; los pedidos y configuraciones históricos se conservan.
- Plantillas originales de mueble, sofá y textil; opciones, suplementos en céntimos y reglas de incompatibilidad/dependencia.
- Capas PNG/WebP importadas desde una carpeta, comprobación de tamaños/vistas y subida real. Opciones individuales PNG/WebP/JPEG.
- Modelos GLB autocontenidos, comprobados con el validador oficial de Khronos antes de guardarlos, y cambio de color de materiales con nombres únicos. Detección y normalización de nombres de materiales y piezas. Visor Three.js con órbita, zoom, iluminación de estudio y renderizado cuando cambia la escena.
- Borradores con control de revisión, publicación explícita, retirada, duplicado y versiones inmutables.
- Colección pública e iframe por producto. Marca, color y lista de dominios autorizados.
- Clientes con configuraciones guardadas, solicitudes, aceptación de presupuesto, conversación y seguimiento del pedido.
- Administrador con propuestas de precio, clientes, estados de preparación/envío/entrega y actividad.
- Stripe Connect Standard, Checkout en la cuenta del comercio, firma del webhook, validación de importe/cuenta/moneda, idempotencia y reembolsos completos sincronizados.
- Flujo opcional de fotos a 3D con Meshy: envío con consentimiento, seguimiento y descarga del GLB; revisión manual antes de publicar. Requiere clave y empresa habilitada.
- API con tokens revocables de lectura/escritura/publicación y servidor MCP por stdio.
- Recuperación de contraseña por email si se configura Resend y un remitente verificado.

Los renders 2D de las plantillas son ilustraciones originales en SVG, no fotografías de catálogo. Los nombres de plantillas no implican geometría paramétrica: se configuran las opciones implementadas.

## Recorrido de prueba

1. Crea tu negocio, pulsa **Crear configurador** y cuenta qué vendes. Define las preguntas y elige fotos, capas, GLB, construir con piezas 3D o empezar sin imágenes. Las plantillas están en la alternativa avanzada.
2. Revisa opciones, precio y reglas; guarda y publica en modo presupuesto.
3. Abre **Ver publicado** en otro perfil del navegador y crea una cuenta de comprador.
4. Elige acabados, guarda o solicita un presupuesto.
5. En el estudio, abre **Pedidos**, introduce la propuesta y sus condiciones.
6. El comprador acepta desde **Mi espacio**. El pago requiere Stripe configurado; nunca se simula un cobro correcto.
7. Tras un webhook de pago válido el administrador puede avanzar preparación → enviado → completado.

Una configuración guarda una copia de su producto y precio. Publicar cambios no altera pedidos anteriores. Para solicitar un pedido desde una configuración de una versión antigua hay que volver a configurar y revisar las opciones vigentes.

## Importar una carpeta

```text
mi-producto/
  01_acabado/
    roble/frontal.png
    nogal/frontal.png
  02_tirador/
    negro/frontal.png
    laton/frontal.png
```

Todas las imágenes deben estar alineadas, con el mismo lienzo y las mismas vistas. Si hay `lateral.png`, todas las opciones necesitan esa vista. Usa transparencias para superponer capas. Máximo 500 imágenes por plan, 20 MB por archivo y 250 MB por empresa. Publicación: máximo 40 grupos y 100 opciones por grupo. La importación sustituye las capas del borrador y deja suplementos a cero para revisión. Un fallo no publica nada; archivos ya subidos pueden permanecer en el almacenamiento.

El CLI `npm run import:layers -- /ruta/carpeta` genera el manifiesto sin subir imágenes. El editor sí las sube. No extrae objetos ni transparencias automáticamente de una fotografía.

## Stripe

1. Crea/configura tu plataforma Stripe Connect. Primero trabaja en modo de prueba.
2. Configura `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` en el servidor.
3. Registra `https://tu-estudio.com/api/stripe/webhook` para eventos de **cuentas conectadas**: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`.
4. En **Conexiones**, cada propietario completa su onboarding en Stripe. La cuenta debe permitir cargos.
5. La compra directa solo se publica si Stripe está habilitado. Los presupuestos pueden publicarse sin Stripe.

El importe viene del servidor; volver desde Checkout no marca un pedido pagado. El pago se procesa en la cuenta conectada, sin comisión de plataforma implementada. No existe todavía facturación de suscripciones SaaS a los comercios. Tampoco hay motor fiscal, transporte calculado ni factura fiscal automática: el comercio debe definir correctamente el total y las condiciones del presupuesto. Reembolsos desde el Dashboard de Stripe; los parciales se registran como actividad.

Se han probado eventos firmados con fixtures y Checkout con un cliente simulado. Falta una prueba real contra tu plataforma Stripe Connect en modo test, porque no se han proporcionado credenciales. No se ha efectuado ningún cargo.

## Insertar en otros sistemas

Desde **Publicación** copia el iframe y autoriza el origen exacto de la web en **Conexiones**, por ejemplo `https://www.mitienda.com`. La restricción `frame-ancestors` se aplica cuando el servidor sirve la compilación de producción. En desarrollo Vite no aplica esa cabecera.

WordPress: instala la carpeta `integrations/wordpress/yenze-studio` como plugin y añade:

```text
[yenze_configurator origin="https://studio.tumarca.com" product="ID_DE_32_CARACTERES" height="800"]
```

Wix, Squarespace y Framer: inserta el iframe con su bloque de código/HTML, según los permisos de tu plan. Esto conecta la experiencia visual y los pedidos de Yenze; **no integra todavía los carritos nativos, inventario o checkout** de esas plataformas. El flujo de guardar/pedir desde un iframe abre Yenze en otra pestaña, evitando depender de cookies de terceros.

## Conectar un agente por MCP

Crea un token en **Conexiones**. Se muestra una sola vez y se almacena su hash. Da solo los permisos necesarios; `write` no concede `publish`.

Configura un servidor MCP stdio en el cliente compatible:

```json
{
  "mcpServers": {
    "yenze": {
      "command": "node",
      "args": ["/RUTA/ABSOLUTA/projects/yenze-studio/server/mcp.mjs"],
      "env": {
        "YENZE_API_URL": "http://localhost:3061",
        "YENZE_API_TOKEN": "TOKEN_CREADO_EN_EL_ESTUDIO"
      }
    }
  }
}
```

El formato de instalación depende del cliente. Herramientas: listar plantillas/productos/pedidos, leer/crear/guardar/publicar/retirar productos, subir assets y planificar capas. El agente prepara un borrador usando el esquema compartido; publicar requiere permiso independiente. Los campos `manifest` siguen `core/layers.mjs` y `server/validation.mjs`. Los importes son enteros en céntimos. Los modelos 3D usan `kind: model-3d`, `model: assetId` y grupos vinculados a `material`.

No hay servidor MCP remoto HTTP ni OAuth de agentes en esta versión. No pongas tokens en el iframe, frontend ni repositorio.

## Comprobaciones

```sh
npm test
npm run build
npm run test:e2e
```

Playwright usa Chrome local si existe; en otro entorno instala Chromium con `npx playwright install chromium`. Pruebas API con base aislada, seguridad entre empresas, revisiones y presupuestos; pruebas Stripe de firmas/importes/idempotencia; recorrido de navegador comercio → comprador → presupuesto. Las capturas del recorrido se guardan en `artifacts/`.

## Despliegue y límites actuales

`npm run build` y `NODE_ENV=production APP_ORIGIN=https://studio.tumarca.com npm start` sirven frontend y API desde un único origen. Producción exige HTTPS. Sitúa el proceso detrás de un proxy TLS. Usa `HOST=0.0.0.0` si lo ejecutas en un contenedor. El Dockerfile incluye la compilación; monta `/app/data` como volumen persistente. No se ha realizado un despliegue.

Esta implementación usa SQLite y archivos en la base: **una instancia con disco persistente**, no funciones efímeras de Vercel. Antes de abrir un servicio comercial hacen falta copias y restauración verificadas, observabilidad, prueba de carga, gestión de datos/retención, entrega real de verificación de email y revisión operativa. Los límites de peticiones son locales por IP; si hay proxy debe diseñarse su política de IP y rate limiting. La verificación de correo está implementada con enlaces de un solo uso y requiere Resend configurado. En producción se exige antes de pagar, salvo desactivación explícita para demostraciones. No se ha auditado como plataforma de producción.

Pendiente: prueba real de Meshy con credenciales, geometría paramétrica avanzada para el comprador, módulos verticales avanzados, validación en staging del adaptador WooCommerce experimental, carritos Shopify y demás adaptadores nativos, suscripciones SaaS, cobros/fiscalidad internacional, importación masiva con procesamiento en cola, almacenamiento de objetos y escalado a PostgreSQL. La base está preparada conceptualmente para ampliaciones, pero estas capacidades **no están implementadas**.

## Fotos a 3D (integración opcional)

Configura `MESHY_API_KEY` y `MESHY_ORGANIZATIONS` con los IDs de las empresas permitidas, separados por comas. Puedes obtener tu ID con `/api/workspace` usando tu sesión o token de lectura. La habilitación explícita evita que cualquier alta nueva consuma créditos del operador. Máximo tres tareas por empresa cada 24 horas.

En una plantilla 3D, selecciona de una a cuatro fotos, acepta el envío a Meshy y solicita la generación. Se conserva la referencia en el navegador y la tarea en la base. Pulsa **Actualizar estado** y después **Usar este modelo**. El proveedor no recibe la clave en el navegador. El resultado se almacena localmente; solo se descargan GLB desde `assets.meshy.ai`, sin redirecciones.

Si un envío no puede confirmarse, queda `UNCONFIRMED`: no se reintenta automáticamente una operación que podría consumir créditos. Hay que reconciliarla con el proveedor. El modelo debe cumplir las mismas restricciones GLB de la subida manual y caber en 20 MB. Las texturas permanecen en el modelo; cambiar un material aplica un tinte, no segmenta piezas automáticamente.

Implementado según la [API oficial Multi-Image to 3D](https://docs.meshy.ai/en/api/multi-image-to-3d), con pruebas de contrato mediante respuestas simuladas. No se ha ejecutado una generación real ni validado su calidad con una cuenta Meshy. El resultado visual no garantiza dimensiones ni fabricación.


## Web del proyecto y código abierto

La raíz anónima muestra la web comercial con dos demostraciones interactivas. `/?page=home` permite verla también con sesión. El CTA abre el alta y después el asistente de creación. Una sesión normal abre directamente el estudio.

El código original de este proyecto se distribuye bajo AGPL-3.0-only, con el texto completo en LICENSE. Las dependencias y los assets externos conservan sus condiciones: consulta NOTICE.md y examples/README.md. Repositorio público: https://github.com/Josusanz/yenze-studio. CONTRIBUTING.md y SECURITY.md documentan cómo contribuir y qué falta antes del lanzamiento.

`npm run release:source` (requiere Python 3) crea un ZIP de fuentes con una lista explícita de archivos. Excluye usuarios, datos de negocio, credenciales, uploads y capturas. Ejecuta después `npm run build` para incluirlo en la web. Las páginas de privacidad y condiciones explican el estado de demostración; el operador debe completar sus datos y políticas antes de abrir una instalación comercial.

## Ejemplos creados en el navegador

En la instalación local de desarrollo se han creado nuevos ejemplos y se conserva su índice en `data/local-examples.json`: fotografías reales de café, mentoría sin imágenes, butaca con imágenes generadas, bicicleta por capas originales, mesa creada con piezas 3D y silla GLB texturizada importada. No se distribuyen cuentas ni bases de datos en el ZIP. Los scripts de creación y revisión son ejercicios reproducibles con credenciales externas; consulta `examples/README.md`.

Los materiales 3D con texturas se tiñen conservando su textura. Cambiar un color no convierte automáticamente un acabado en madera, metal o tejido físicamente correcto. El constructor de piezas modifica la geometría del producto en el editor; todavía no crea automáticamente despieces ni instrucciones de fabricación.

## Copia y recuperación de datos

Los archivos subidos se almacenan como BLOB en SQLite: la copia online incluye productos, assets, configuraciones, pedidos y usuarios de una instantánea consistente, incluyendo los cambios del WAL.

```sh
node scripts/backup.mjs backup data/studio.sqlite /ruta/privada/copia-2026-09-27.sqlite
node scripts/backup.mjs restore /ruta/privada/copia-2026-09-27.sqlite /ruta/privada/restauracion-nueva
YENZE_DATA_DIR=/ruta/privada/restauracion-nueva npm run dev
```

La copia verifica integridad y referencias. La restauración exige una carpeta nueva: nunca sobrescribe una base en uso. Las copias contienen datos personales y secretos de sesión; protégelas, cifra el almacenamiento externo y define una retención. Conserva también las variables de entorno en un gestor seguro: no se incluyen en la base. La herramienta se ha probado con una base temporal y debe ensayarse en el entorno de despliegue concreto.

## Direcciones públicas

Cada producto tiene una dirección estable y legible como `/p/mi-tienda/mi-producto`. Los nombres repetidos reciben sufijos numéricos y renombrar un producto no rompe su enlace. Compartir guarda una selección validada y devuelve `?c=CODIGO`, sin JSON en la URL. Los enlaces anteriores con ID y selección siguen abriéndose y se normalizan. Un enlace compartido de una versión anterior avisa de que el producto cambió; no aplica precios antiguos silenciosamente.


## Recorridos de creación, producción e integración

El asistente conserva la idea en la pestaña y ofrece comienzos guiados de camiseta y servicio. Los originales textiles se conservan privados sin reducir; Producto permite configurar la zona en mm. Se avisa de resolución baja y recortes. El cliente aprueba una revisión concreta del pedido y el comercio descarga ficha con originales y PNG a resolución física. La aprobación es obligatoria para pasar un pedido textil pagado a producción.

- [Flujo de producción y límites](docs/PRODUCTION-WORKFLOW.md)
- [SDK y adaptador WooCommerce experimental](docs/COMMERCE.md)
- [Preparación operativa y retención](docs/OPERATIONS.md)
- [Piloto con cinco negocios](docs/PILOT.md)
- [Código abierto y servicio gestionado](docs/OPEN-CORE.md)

Conexiones incluye un panel de preparación. Credenciales presentes no equivalen a transacciones probadas. El nuevo protocolo de carrito usa tickets breves resueltos en servidor, nunca importes confiados al navegador. El adaptador WooCommerce es opt-in y requiere validación en una tienda de staging; los carritos nativos de las otras plataformas no están terminados.
