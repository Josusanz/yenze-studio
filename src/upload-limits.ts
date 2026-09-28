export const hosted = import.meta.env.VITE_HOSTED === "true";
export const uploadLimitMB = hosted ? 3 : 20;
export const printLimitMB = hosted ? 3 : 10;
export function checkUpload(file: File, limit = uploadLimitMB) {
  if (file.size > limit * 1024 * 1024)
    throw Error(
      `Este archivo supera los ${limit} MB${hosted ? " permitidos en la beta online" : " permitidos"}. Reduce su tamaño e inténtalo de nuevo.`,
    );
}
