# Conectar una tienda

El iframe inserta la experiencia. El SDK añade un evento de carrito; el servidor de la tienda debe resolverlo antes de cobrar. Nunca usar el importe enviado por JavaScript.

## SDK incluido

```html
<div id="configurador"></div>
<script src="https://TU-STUDIO/yenze-embed.js"></script>
<script>
const instance = Yenze.mount('#configurador', {
  url: 'https://TU-STUDIO/p/tu-tienda/tu-producto',
  onCart: async ({ticket}) => {
    // Tu endpoint, con sesión y protección CSRF de tu tienda.
    const response = await fetch('/mi-carrito/configuracion', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ticket})
    });
    if (!response.ok) throw Error('No se pudo añadir al carrito');
  },
  onError: error => console.error(error.message)
});
// Al desmontar la página: instance.destroy()
</script>
```

Autoriza el origen exacto de la tienda en Conexiones. El SDK comprueba `event.source`, `event.origin`, protocolo y formato del mensaje. El iframe solo envía datos al origen autorizado. No utiliza `*` ni envía datos personales.

El backend de la tienda llama a `POST /api/commerce/resolve`, con `Authorization: Bearer TOKEN_CON_WRITE` y `{ticket}`. Se valida empresa, publicación, versión, selección y precio. Respuesta: producto, versión, selección, céntimos EUR, caducidad. El ticket caduca a los 15 minutos. Una publicación nueva lo invalida. El token nunca se envía al navegador. Las llamadas entre servidores no deben añadir un Origin de navegador.

El comercio debe vincular explícitamente el productId a su SKU, deduplicar la incorporación al carrito y mantener una instantánea inmutable en el pedido. El precio se interpreta SIN impuestos ni portes en este protocolo. El motor fiscal, stock, descuentos y transporte pertenecen a la tienda. No hay sincronización automática de pedidos externos al portal Yenze todavía.

## WordPress / WooCommerce (adaptador experimental, opt-in)

El plugin `integrations/wordpress/yenze-studio` mantiene el shortcode iframe existente. Añade un adaptador de carrito para productos simples, moneda EUR y precios introducidos sin impuestos. No se ha validado en una instalación real de WooCommerce en este entorno: no habilitar directamente en una tienda en producción.

1. Instala la carpeta del plugin y activa Yenze Studio.
2. Crea en Yenze un token de esa empresa con permiso write.
3. Configura en el `wp-config.php` del servidor:

```php
define('YENZE_STUDIO_ORIGIN', 'https://TU-STUDIO');
define('YENZE_STUDIO_API_TOKEN', 'TOKEN_PRIVADO');
define('YENZE_ENABLE_WOOCOMMERCE', true);
```

4. En Datos del producto → General, pega el identificador de Yenze en «Configurador Yenze». Define stock, impuestos y envío en WooCommerce.
5. Inserta `[yenze_woocommerce product="ID_DEL_PRODUCTO_WOO"]` y autoriza el dominio en Yenze.
6. Comprueba en staging: selección → carrito → impuestos/envío → pago de prueba → metadato `_yenze_configuration` del pedido; doble clic, caducidad y producto incompatible.

El adaptador valida el ticket en servidor, impide añadir directamente un producto vinculado sin configuración, conserva selección y versión en la línea de pedido y bloquea el checkout tras los 15 minutos. Una selección ya incorporada mantiene su precio validado hasta esa caducidad. Soporte de checkout Blocks, impuestos de plugins, monedas adicionales y sincronización con Yenze requieren validación y desarrollo adicional.

## Wix, Squarespace, Framer

El iframe/SDK sirven para insertar la experiencia donde la plataforma permita código. Sus carritos nativos requieren adaptadores específicos y credenciales de sus APIs. No aparecen como integraciones nativas terminadas.

## Referencias usadas

- https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
- https://developer.wordpress.org/reference/functions/wp_safe_remote_post/
- https://developer.wordpress.org/reference/functions/check_ajax_referer/
- https://woocommerce.github.io/code-reference/classes/WC-Cart.html
