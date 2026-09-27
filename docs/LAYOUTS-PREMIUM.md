# Propuesta: diseños intercambiables y colección premium

Estado: propuesta de producto, no integración ni compra implementada. Referencia consultada: https://yenze.io/configurators (27 septiembre 2026).

La colección actual vende proyectos de código y diseño: Inside, Nomad, Habita, Nōra, Automotive y Encaja. Para usarlos en Studio hay que adaptar sus componentes a un contrato común; no basta con copiar sus CSS. Sus funciones sectoriales y modelos no son automáticamente compatibles con cualquier producto.

## Experiencia propuesta

1. Crear primero un producto funcional con un diseño base cuidado.
2. Pestaña Diseño: tres recomendaciones y acceso a Toda la colección. Miniaturas renderizadas con el producto y las opciones reales del usuario, no una demostración ajena.
3. Elegir una miniatura cambia instantáneamente la vista previa. Alternar escritorio/móvil, comparar con el diseño anterior y pulsar Aplicar.
4. Personalizar únicamente marca, color, tipografía y densidad mediante presets. Mantener los ajustes avanzados fuera del primer recorrido.
5. Probar cualquier premium en el editor; mostrar claramente la licencia requerida antes de publicar ese diseño. No cobrar ni eliminar avances por probarlo. Mostrar alternativas compatibles cuando falten recursos, sin bloquear la creación.

## Arquitectura

Separar datos del producto (assets, preguntas, ramas, precios y reglas), diseño de presentación (layoutId, versión y tokens de marca) y módulos sectoriales (medidas paramétricas, despieces, CPQ). Todos los layouts usan el mismo evaluador, selección, validación, guardado y pedido. Cambiar el layout no modifica el producto.

Un registro de layouts declara formatos compatibles, versión, accesibilidad, componentes para escritorio/móvil y recursos necesarios. Los premium necesitan autorización del servidor y comprobación de licencia al publicar. No confiar en una bandera del navegador. Evitar cargar código remoto arbitrario del marketplace en el origen que contiene sesiones.

## Negocio

Mantener un motor abierto útil y varios diseños gratuitos profesionales. Ofrecer colecciones premium, paquetes verticales, instalación, hosting y soporte. El valor de pago debe ser una experiencia pulida y trabajo ahorrado, no la posibilidad básica de publicar o recibir pedidos. Empezar con pago único por pack, coherente con la colección existente; no introducir una suscripción obligatoria para un simple cambio visual.

Revisar y documentar la separación de licencias entre motor, diseños, assets y extensiones antes de distribuir paquetes comerciales. El proyecto local lleva AGPL-3.0-only; no se ha modificado la licencia ni el sistema de cobro de la tienda actual.

## Primera implementación recomendada

Dos diseños base gratuitos y tres premium adaptados de la colección, con matriz de pruebas: 2D, imágenes, GLB, composiciones y productos sin imágenes; ramas condicionales, teclado, móvil, guardar y pedir presupuesto. No anunciar un layout como universal antes de pasar esas pruebas.
