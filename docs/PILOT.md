# Piloto con cinco negocios

Estado: guion preparado; sesiones con empresas reales pendientes. No presentar las pruebas automáticas como investigación con clientes.

Invitar, con permiso del responsable del proyecto, a un taller textil, un servicio profesional, una tienda de muebles, un negocio de regalos y un negocio que no encaje en las plantillas. No contactar automáticamente desde la herramienta.

Cada persona usa una cuenta propia y productos ficticios. Explicar únicamente el objetivo, sin enseñar el recorrido. Consentir cualquier grabación. No recoger clientes ni medios de pago reales.

Tareas:
1. Crear un configurador de algo que venda, desde cero, con tres elecciones.
2. Añadir un extra de pago y una opción que solo aparezca en una combinación.
3. Cerrar el asistente y retomarlo. Explicar qué cree que se guardó.
4. Subir una foto propia; si es textil, crear texto y moverlo en el frontal, después añadir una imagen en espalda.
5. Entender el aviso de baja resolución y corregirlo reduciendo el tamaño o subiendo un original mayor.
6. Probar una combinación, publicarla y abrirla desde otro navegador sin cuenta de administrador.
7. Como cliente, guardar, solicitar presupuesto, revisar y aprobar la versión.
8. Como comercio, localizar el pedido y descargar los datos necesarios para prepararlo.
9. Insertar en una página de pruebas con ayuda limitada a las credenciales del sitio.

Registrar por tarea: logrado sin ayuda/sin lograr/con ayuda, tiempo, errores, palabras que no entiende, qué esperaba y confianza del 1 al 5. El cronómetro sirve para comparar iteraciones, no para prometer «crear en X minutos».

Criterio propuesto para beta comercial: ninguna pérdida de trabajo o fallo de acceso; 4/5 crean/publican sin ayuda; todos distinguen vista previa de archivo de producción; pagos test/refund y restauración de backup comprobados en staging. Resolver y repetir cualquier tarea crítica fallida antes de aceptar pedidos reales.

Pruebas automáticas reproducibles: `npm test`, `npm run build`, `npm run test:e2e`. Cubren aislamiento, precios, versiones, recorrido textil, formularios, modelos y recuperación. No miden comprensión humana ni certifican seguridad independiente.
