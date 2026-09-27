# Del diseño al taller

Nuevas imágenes: el navegador crea una vista previa ligera y sube el archivo original PNG/JPG/WebP sin modificar a un almacén privado separado. Se decodifica en el servidor, se comprueba el formato, se limita a 10 MB/40 MP y se vincula al producto. Límite independiente de 250 MB de originales por empresa y 20 subidas por IP/10 minutos. No hay URL pública de descarga del original. Una referencia de otro producto o unas dimensiones manipuladas no se aceptan.

Los originales ya guardados se conservan en SQLite y sus backups. Las imágenes antiguas solo conservan el PNG reducido: se avisa para volver a subirlas; no es posible reconstruir detalle perdido.

Producto → Zona de impresión configura medidas en milímetros con proporción 3:4, 150 o 300 ppp. La vista 3D es orientativa; el taller debe confirmar escala/calibración para la prenda real. El editor avisa si una imagen tiene pocos píxeles para su anchura física o sale del área. No convierte color a CMYK ni detecta detalles mínimos de bordado/serigrafía. Los textos se renderizan con las mismas fuentes del editor; deben revisarse también los saltos y recortes.

Cada pedido tiene una instantánea inmutable. El comercio solicita la aprobación con una nota; el comprador debe aceptar explícitamente la revisión vigente. Se guarda fecha, usuario y SHA-256 del manifiesto/selección. Una nueva solicitud invalida la aprobación anterior. Un pedido textil no pasa de pagado a producción sin aprobación. No se cambia el diseño de un pedido ya aceptado: se crea una nueva configuración/pedido.

La ficha JSON descargable incluye elecciones legibles, versión, medidas, avisos, documento por capas, originales con SHA-256 y aprobación. Solo los miembros del comercio pueden descargar originales y PNG de producción. El comprador descarga un resumen con la vista previa, sin los archivos originales; compartir una configuración no concede acceso a los originales. Los PNG frontal/espalda se renderizan en navegador utilizando los originales y los píxeles necesarios para la zona; llevan metadatos pHYs de 150/300 ppp. Una fuente pequeña puede ampliarse, pero no gana detalle: revisar siempre los avisos. No son PDF/X, separaciones de tinta ni archivos de corte.

La aprobación cubre el diseño/configuración y la nota; el precio del presupuesto se acepta por separado. No equivale a un contrato de fabricación universal ni sustituye las condiciones del taller.
