<?php
/** Experimental WooCommerce adapter. See docs/COMMERCE.md before enabling. */
if (!defined('ABSPATH')) { exit; }
// Credentials live only on the WordPress server, in wp-config.php.
function yenze_resolve_ticket($ticket) {
    if (!defined('YENZE_STUDIO_ORIGIN') || !defined('YENZE_STUDIO_API_TOKEN')) {
        return new WP_Error('yenze_setup', 'Falta configurar la conexión de Yenze.');
    }
    $origin = rtrim(YENZE_STUDIO_ORIGIN, '/');
    if (!preg_match('/^https:\/\/[^\/]+$/', $origin) || !preg_match('/^[a-f0-9]{64}$/', $ticket)) {
        return new WP_Error('yenze_request', 'Conexión o selección no válida.');
    }
    $r = wp_safe_remote_post($origin . '/api/commerce/resolve', [
        'timeout' => 15, 'redirection' => 0,
        'headers' => ['Authorization' => 'Bearer ' . YENZE_STUDIO_API_TOKEN, 'Content-Type' => 'application/json'],
        'body' => wp_json_encode(['ticket' => $ticket]),
    ]);
    if (is_wp_error($r)) { return $r; }
    $data = json_decode(wp_remote_retrieve_body($r), true);
    if (wp_remote_retrieve_response_code($r) !== 200 || !is_array($data) || !isset($data['amount'], $data['productId'], $data['version'], $data['selection']) || !is_int($data['amount']) || $data['amount'] < 0 || ($data['currency'] ?? '') !== 'EUR') {
        return new WP_Error('yenze_expired', 'Reabre el configurador: la selección ha caducado o el producto ha cambiado.');
    }
    return $data;
}
add_action('woocommerce_product_options_general_product_data', function () {
    woocommerce_wp_text_input(['id' => '_yenze_product_id', 'label' => 'Configurador Yenze', 'description' => 'Identificador del configurador publicado. Solo productos simples en EUR con precios introducidos sin impuestos.']);
});
add_action('woocommerce_admin_process_product_object', function ($product) {
    $id = sanitize_text_field(wp_unslash($_POST['_yenze_product_id'] ?? ''));
    if ($id === '' || preg_match('/^[a-f0-9]{32}$/', $id)) { $product->update_meta_data('_yenze_product_id', $id); }
});
function yenze_add_to_cart() {
    check_ajax_referer('yenze_cart', 'nonce');
    if (!function_exists('WC') || get_woocommerce_currency() !== 'EUR' || wc_prices_include_tax()) {
        wp_send_json_error(['message' => 'Esta conexión requiere WooCommerce en EUR con precios sin impuestos.'], 409);
    }
    $product = wc_get_product(absint($_POST['product'] ?? 0));
    if (!$product || !$product->is_type('simple') || $product->get_status() !== 'publish' || !$product->is_purchasable()) {
        wp_send_json_error(['message' => 'Producto no disponible.'], 400);
    }
    $ticket = sanitize_text_field(wp_unslash($_POST['ticket'] ?? ''));
    $verified = yenze_resolve_ticket($ticket);
    if (is_wp_error($verified)) { wp_send_json_error(['message' => $verified->get_error_message()], 409); }
    if ($verified['productId'] !== $product->get_meta('_yenze_product_id')) { wp_send_json_error(['message' => 'La selección no corresponde a este producto.'], 400); }
    if (!WC()->cart) { wc_load_cart(); }
    // Same validated ticket is idempotent in this cart, avoiding double-click duplicates.
    foreach (WC()->cart->get_cart() as $item) {
        if (($item['yenze_verified']['ticket'] ?? '') === $ticket) { wp_send_json_success(['url' => wc_get_cart_url()]); }
    }
    $key = WC()->cart->add_to_cart($product->get_id(), 1, 0, [], ['yenze_verified' => $verified]);
    if (!$key) { wp_send_json_error(['message' => 'No se pudo añadir al carrito. Revisa el stock.'], 409); }
    wp_send_json_success(['url' => wc_get_cart_url()]);
}
add_action('wp_ajax_yenze_cart', 'yenze_add_to_cart');
add_action('wp_ajax_nopriv_yenze_cart', 'yenze_add_to_cart');
add_action('woocommerce_before_calculate_totals', function ($cart) {
    foreach ($cart->get_cart() as $item) {
        if (isset($item['yenze_verified']['amount'])) { $item['data']->set_price($item['yenze_verified']['amount'] / 100); }
    }
});
add_action('woocommerce_check_cart_items', function () {
    foreach (WC()->cart->get_cart() as $item) {
        if (!isset($item['yenze_verified'])) { continue; }
        // A validated quote is locked for 15 minutes, then requires an explicit new configuration.
        if (($item['yenze_verified']['expires'] ?? 0) < time() * 1000) { wc_add_notice('La configuración de Yenze ha caducado. Elimina esa línea y configura de nuevo el producto.', 'error'); }
    }
});
add_filter('woocommerce_get_item_data', function ($data, $item) {
    if (isset($item['yenze_verified'])) { $data[] = ['key' => 'Configuración', 'value' => $item['yenze_verified']['name'] . ' · versión ' . $item['yenze_verified']['version']]; }
    return $data;
}, 10, 2);
add_action('woocommerce_checkout_create_order_line_item', function ($item, $key, $values) {
    if (isset($values['yenze_verified'])) { $item->add_meta_data('_yenze_configuration', wp_json_encode($values['yenze_verified']), true); }
}, 10, 3);
add_shortcode('yenze_woocommerce', function ($attributes) {
    if (!function_exists('wc_get_product') || !defined('YENZE_STUDIO_ORIGIN')) { return ''; }
    $a = shortcode_atts(['product' => '0'], $attributes, 'yenze_woocommerce');
    $product = wc_get_product(absint($a['product']));
    if (!$product || !preg_match('/^[a-f0-9]{32}$/', $product->get_meta('_yenze_product_id'))) { return ''; }
    $origin = rtrim(YENZE_STUDIO_ORIGIN, '/');
    wp_enqueue_script('yenze-embed', $origin . '/yenze-embed.js', [], '1.0', true);
    wp_enqueue_script('yenze-woo', plugins_url('woo-bridge.js', __FILE__), ['yenze-embed'], '1.0', true);
    $config = ['url' => $origin . '/?product=' . $product->get_meta('_yenze_product_id'), 'product' => $product->get_id(), 'ajax' => admin_url('admin-ajax.php'), 'nonce' => wp_create_nonce('yenze_cart')];
    return '<div class="yenze-woo" data-yenze="' . esc_attr(wp_json_encode($config)) . '"></div><p class="yenze-woo-status" role="status"></p>';
});
add_filter('woocommerce_add_to_cart_validation', function ($passed, $product_id, $quantity, $variation_id = 0, $variations = [], $cart_item_data = []) {
    $product = wc_get_product($product_id);
    if ($product && $product->get_meta('_yenze_product_id') && empty($cart_item_data['yenze_verified'])) {
        wc_add_notice('Personaliza este producto antes de añadirlo al carrito.', 'error');
        return false;
    }
    return $passed;
}, 10, 6);
