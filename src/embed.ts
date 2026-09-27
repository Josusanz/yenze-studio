import { useEffect } from "react";
export function parentOrigin(data: any) {
  const p = new URLSearchParams(location.search);
  const target = p.get("parentOrigin");
  if (!p.has("embed") || window.parent === window || !target) return null;
  return target === location.origin || data?.domains?.includes(target)
    ? target
    : null;
}
export function useEmbed(data: any) {
  useEffect(() => {
    const origin = parentOrigin(data);
    if (!origin) return;
    let timer: ReturnType<typeof setTimeout>;
    const send = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () =>
          window.parent.postMessage(
            {
              protocol: "yenze:1",
              type: "resize",
              height: Math.ceil(document.body.scrollHeight),
            },
            origin,
          ),
        100,
      );
    };
    const observer = new ResizeObserver(send);
    observer.observe(document.body);
    send();
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [data]);
}
