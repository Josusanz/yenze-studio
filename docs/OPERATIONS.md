# Antes de cobrar pedidos reales

Conexiones muestra estado del primer producto, dominios, credenciales Stripe, correo y revisiones manuales. «Configurado» no significa que se haya probado una transacción. No hay un indicador ficticio de plataforma certificada.

## Almacenamiento y recuperación

**Instalaciones SQLite:** ejecutar una única instancia con disco persistente. Programar `scripts/backup.mjs backup` desde el planificador del servidor hacia una carpeta privada con nombres únicos, copiar fuera del servidor y cifrar. Ensayar `restore` hacia una carpeta nueva y arrancar una instancia aislada con esa copia. Comprobar usuarios, producto, originales y pedido; documentar duración y fecha. Las variables de entorno se recuperan del gestor de secretos, no del ZIP público.

Para limpiar originales abandonados: `node scripts/prune-print-assets.mjs data/studio.sqlite` muestra candidatos sin borrar. Con copia verificada, añadir `--apply` elimina solo originales mayores de siete días que no aparecen en borradores, versiones, configuraciones, enlaces compartidos o tickets vigentes. También conserva referencias de productos en la papelera. La limpieza no elimina pedidos ni datos personales. Definir una política independiente de retención de cuentas y pedidos antes del lanzamiento.

## Stripe

Configurar cuenta Connect y webhook Connect. Con claves de prueba completar un pago, repetir el evento, probar un importe/account incorrecto y devolver un pago. Confirmar los estados de pedido. Activar claves reales solo después de comprobar HTTPS, email, condiciones comerciales y operación. Los tests de SDK usan un cliente simulado; no equivalen a una transacción real.

## Web y seguridad

Solo orígenes exactos autorizados pueden recibir eventos del SDK; el CSP de producción limita los iframes. El proxy debe conservar el Origin de las solicitudes y APP_ORIGIN debe coincidir con el dominio público. No confiar automáticamente en X-Forwarded-For. Aplicar además rate limiting en el proxy si varios usuarios comparten su IP vista por Node.

Los originales se decodifican, se limitan y son privados. El navegador muestra PNG optimizado. No exponer tokens en snippets ni bundles. Rotar tokens revocados; proteger backups y `.env`. Falta una auditoría independiente, comprobación real de entrega de email, prueba de carga del despliegue y seguimiento de incidentes.

## Piloto y límites

Seguir PILOT.md con personas reales, registrar resultados y corregir tareas fallidas. Comprobar lectores de pantalla y dispositivos reales además de Chrome automatizado. WooCommerce es un adaptador experimental pendiente de ejecutar en staging; Wix, Squarespace y Framer tienen inserción, no carrito nativo implementado. La beta online y el repositorio público están disponibles. La suscripción SaaS y los carritos nativos adicionales siguen pendientes.

## Confirmación de correo

Configurar RESEND_API_KEY y MAIL_FROM. La cuenta muestra un botón para solicitar un enlace de 24 horas. Se almacenan hashes; confirmar consume todos los enlaces de ese usuario. Un fallo de envío no invalida un enlace entregado anteriormente. En producción el comprador necesita el correo verificado antes de pagar; REQUIRE_VERIFIED_EMAIL=false solo sirve para demostraciones expresamente configuradas. No hay envío real probado sin las credenciales y el remitente.

## Beta online en Vercel

Studio utiliza PostgreSQL persistente en Neon; ver VERCEL.md. Las copias SQLite no se aplican a esta instalación. Antes de aceptar pedidos críticos, documentar y ensayar la recuperación de PostgreSQL en un destino aislado, con un responsable y una retención acordada. No confundir persistencia entre despliegues con una copia de seguridad validada.

El workflow `hosted beta availability` comprueba cada 30 minutos el acceso a la base de datos, la sesión anónima y el bundle de registro. También se ejecuta manualmente con workflow_dispatch. No crea cuentas ni pedidos. Los fallos quedan en GitHub Actions; este sondeo no sustituye alertas operativas ni una prueba de carga.

El editor guarda automáticamente después de una pausa de escritura. Una copia por pestaña permite recuperar cambios tras un error de red; nunca aplica automáticamente una copia sobre una revisión más reciente. Si el almacenamiento del navegador está bloqueado, se muestra un aviso. Cerrar la pestaña puede eliminar esa copia local: el guardado confirmado en el servidor es el que persiste.
