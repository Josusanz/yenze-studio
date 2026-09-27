document.querySelectorAll(".yenze-woo").forEach(function (container) {
  var config = JSON.parse(container.dataset.yenze),
    status = container.nextElementSibling,
    busy = false;
  window.Yenze.mount(container, {
    url: config.url,
    onCart: async function (selection) {
      if (busy) return;
      busy = true;
      status.textContent = "Comprobando tu configuración…";
      try {
        var body = new URLSearchParams({
          action: "yenze_cart",
          nonce: config.nonce,
          product: String(config.product),
          ticket: selection.ticket,
        });
        var r = await fetch(config.ajax, {
          method: "POST",
          credentials: "same-origin",
          body: body,
        });
        var data = await r.json();
        if (!r.ok || !data.success)
          throw Error(data.data?.message || "No se pudo añadir al carrito.");
        var target = new URL(data.data.url, location.href);
        if (target.origin !== location.origin)
          throw Error("Destino de carrito no válido.");
        location.href = target.href;
      } catch (e) {
        status.textContent = e.message;
      } finally {
        busy = false;
      }
    },
  });
});
