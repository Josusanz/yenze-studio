# Referencias y decisiones de producto

Revisión de fuentes públicas primarias: 27 de septiembre de 2026. No se copiaron interfaces, imágenes ni código de los competidores.

- [Kickflip: conditional logic](https://help.gokickflip.com/en/articles/4586211-adding-conditional-logic-to-your-customizer) y [organización por grupos](https://help.gokickflip.com/en/articles/4586193-organizing-your-questions-with-groups): decisiones dependientes, organizadas según lo que necesita elegir el comprador. En Yenze se expresan como preguntas y subopciones con precio calculado solo en ramas visibles.
- [WPConfigurator: group/layer](https://documentation.wpconfigurator.com/docs/pro/creating-the-actual-product/step-1-add-group-layer/): separar la estructura de opciones del apilado visual. Yenze añade un punto de partida sin imágenes y fotos completas sin exigir que el usuario conozca las capas.
- [Zakeke Composer](https://zakeke.zendesk.com/hc/en-us/articles/360009576134-Composer): materiales y componentes de modelos preparados. Yenze reconoce nombres de materiales y piezas GLB, sin prometer segmentación semántica de una fotografía.
- [Threekit: item rules](https://community.threekit.com/platform-documentation/project-data/catalog/item-rules-and-logic): las reglas deben pertenecer al producto y validarse también al guardar/pedir. No basta con ocultar controles en el navegador.
- [Three.js Editor Manual](https://github.com/mrdoob/three.js/wiki/Editor-Manual): referencia para escenas, objetos y materiales. Usamos Three.js, no una copia del editor. El constructor geométrico de Yenze tiene sus propios controles limitados a piezas y medidas.
- [glTF Validator](https://github.com/KhronosGroup/glTF-Validator): validador oficial de Khronos, integrado en el servidor para comprobar referencias, buffers y geometría GLB antes de guardar. Licencia Apache-2.0; no carga recursos externos.
- [glTF Transform](https://github.com/donmccurdy/glTF-Transform): candidato futuro para optimización y procesado de assets; no está integrado en esta versión.
- [Khronos Sample Assets / SheenChair](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenChair): prueba real de importación de un GLB texturizado, con licencia CC0 y atribución en examples/README.md. La prueba encontró una restricción innecesaria de KHR_texture_transform y permitió corregirla.

## Criterio de aceptación

Una persona debe poder nombrar un producto, definir preguntas, elegir cómo mostrarlo, comprobar sus combinaciones y publicar sin editar JSON. El recorrido se prueba con un servicio sin imágenes, bebidas con fotografías, mobiliario con imágenes, bicicleta por capas, mesa construida con geometría y silla GLB importada. Los archivos 3D complejos y las capas bien alineadas siguen requiriendo trabajo de preparación: el asistente no lo oculta.

Las pruebas son recorridos automatizados en un navegador real y revisión visual, no un estudio de usabilidad con participantes independientes. Tampoco prueban que el producto sea superior a todos los competidores. La instalación sigue siendo una versión en desarrollo con límites operativos documentados.
