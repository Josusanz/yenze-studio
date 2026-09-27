/** Yenze embed protocol v1. No API secrets belong in this script. */
(function () {
  "use strict";
  window.Yenze = {
    mount: function (target, options) {
      var container =
        typeof target === "string" ? document.querySelector(target) : target;
      if (!container)
        throw new Error("No se encuentra el contenedor del configurador.");
      var url = new URL(options.url, location.href);
      if (!["https:", "http:"].includes(url.protocol))
        throw new Error("URL no válida.");
      if (
        url.protocol === "http:" &&
        !["localhost", "127.0.0.1"].includes(url.hostname)
      )
        throw new Error("El configurador requiere HTTPS.");
      url.searchParams.set("embed", "1");
      url.searchParams.set("parentOrigin", location.origin);
      if (options.onCart) url.searchParams.set("cart", "1");
      var frame = document.createElement("iframe");
      frame.title = options.title || "Configura tu producto";
      frame.src = url.href;
      frame.style.cssText = "width:100%;height:800px;border:0;display:block";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      function receive(event) {
        if (
          event.source !== frame.contentWindow ||
          event.origin !== url.origin ||
          event.data?.protocol !== "yenze:1"
        )
          return;
        var message = event.data;
        if (message.type === "resize" && Number.isFinite(message.height))
          frame.style.height =
            Math.max(450, Math.min(1600, message.height)) + "px";
        if (
          message.type === "cart" &&
          /^[a-f0-9]{64}$/.test(message.ticket) &&
          options.onCart
        )
          Promise.resolve(options.onCart({ ticket: message.ticket })).catch(
            function (e) {
              if (options.onError) options.onError(e);
            },
          );
      }
      window.addEventListener("message", receive);
      container.appendChild(frame);
      return {
        destroy: function () {
          window.removeEventListener("message", receive);
          frame.remove();
        },
      };
    },
  };
})();
