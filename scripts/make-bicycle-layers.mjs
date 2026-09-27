// Original vector artwork exported as aligned PNG layers for the folder-import demo.
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
const wrap = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">${body}</svg>`;
const wheel = (x) =>
  `<circle cx="${x}" cy="560" r="172" fill="#fff" stroke="#273336" stroke-width="20"/><circle cx="${x}" cy="560" r="155" fill="none" stroke="#b8b6ac" stroke-width="4"/><g stroke="#d7d9d6" stroke-width="2">${Array.from(
    { length: 24 },
    (_, i) => {
      const a = (i * Math.PI) / 12;
      return `<path d="M${x},560 L${x + 150 * Math.cos(a)},${560 + 150 * Math.sin(a)}"/>`;
    },
  ).join("")}</g><circle cx="${x}" cy="560" r="12" fill="#273336"/>`;
const frame = (c) =>
  wrap(
    `<ellipse cx="600" cy="749" rx="470" ry="17" fill="#243333" opacity=".07"/>${wheel(310)}${wheel(890)}<g fill="none" stroke-linejoin="round" stroke-linecap="round"><path d="M310 560L574 560L468 343L310 560L740 350L574 560" stroke="${c}" stroke-width="19"/><path d="M468 343L740 350L890 560" stroke="${c}" stroke-width="22"/><path d="M574 560L460 305M740 350L727 273" stroke="#293c3b" stroke-width="12"/><path d="M699 275L762 270L803 252" stroke="#525e5e" stroke-width="12"/><path d="M760 270L803 252" stroke="#303835" stroke-width="17"/><path d="M555 560L303 568L301 594L575 588Z" stroke="#546360" stroke-width="5"/></g><path d="M409 302Q408 283 436 284L501 292Q516 295 507 307Z" fill="#644a3b"/><circle cx="574" cy="560" r="35" fill="#dfded6" stroke="#7f8b87" stroke-width="7"/><circle cx="574" cy="560" r="13" fill="#6b7b77"/><path d="M574 560L609 597" stroke="#4d5c58" stroke-width="8"/><rect x="596" y="592" width="44" height="12" rx="4" fill="#293b36"/>`,
  );
const basket = wrap(
  `<path d="M789 289L932 289L916 377L807 377Z" fill="#b89c74" stroke="#927450" stroke-width="5"/><path d="M801 311H927M805 335H923M809 358H919" fill="none" stroke="#d2b790" stroke-width="9"/><path d="M814 295L826 374M843 295L849 374M874 295V374M906 295L894 374" fill="none" stroke="#8e744f" stroke-width="4"/><path d="M787 288H934" stroke="#7c644a" stroke-width="9" stroke-linecap="round"/>`,
);
const fenders = wrap(
  `<path d="M123 520A195 195 0 0 1 487 477M724 463A195 195 0 0 1 1080 520" fill="none" stroke="#a4aeac" stroke-width="12" stroke-linecap="round"/><path d="M310 560L196 420M890 560L1036 447" stroke="#a4aeac" stroke-width="3"/>`,
);
for (const [folder, body] of [
  ["01_cuadro/verde_salvia", frame("#7a9688")],
  ["01_cuadro/azul_noche", frame("#385b72")],
  ["01_cuadro/terracota", frame("#b66e54")],
  ["02_cesta/sin_cesta", wrap("")],
  ["02_cesta/cesta_de_mimbre", basket],
  ["03_guardabarros/sin_guardabarros", wrap("")],
  ["03_guardabarros/aluminio", fenders],
]) {
  const dir = "examples/assets/bicycle-layers/" + folder;
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    dir + "/frontal.png",
    await sharp(Buffer.from(body)).png().toBuffer(),
  );
}
