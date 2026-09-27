<?php
/**
 * Plugin Name: Yenze Studio Configurators
 * Description: Inserta configuradores publicados de Yenze Studio mediante un shortcode.
 * Version: 0.2.0
 * Requires PHP: 7.4
 */
if (!defined('ABSPATH')) { exit; }
add_shortcode('yenze_configurator', function ($attributes) {
    $a = shortcode_atts(['origin' => '', 'product' => '', 'height' => '800'], $attributes, 'yenze_configurator');
    $origin = esc_url_raw($a['origin'], ['https']);
    $parts = wp_parse_url($origin);
    if (!$origin || empty($parts['host']) || !empty($parts['user']) || !empty($parts['pass']) || !preg_match('/^[a-f0-9]{32}$/', $a['product'])) {
        return current_user_can('edit_posts') ? '<p>Yenze: indica un origen HTTPS y un identificador de producto válido.</p>' : '';
    }
    $height = max(400, min(1600, intval($a['height'])));
    $url = add_query_arg(['product' => $a['product'], 'embed' => '1'], rtrim($origin, '/') . '/');
    return '<iframe src="' . esc_url($url) . '" title="Configura tu producto" width="100%" height="' . esc_attr($height) . '" style="border:0;border-radius:12px" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>';
});
// Opt-in until the merchant has validated the adapter against their WooCommerce installation.
if (defined('YENZE_ENABLE_WOOCOMMERCE') && YENZE_ENABLE_WOOCOMMERCE) {
    require_once __DIR__ . '/woo-bridge.php';
}
