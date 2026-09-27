// Keep a 13 cm inset between the tabletop edge and each leg centre.
// Work from the original scene, so resizing never accumulates scale errors.
export function resizeDemoTable(scene, widthCm) {
  if (!Number.isFinite(widthCm) || widthCm < 100 || widthCm > 200)
    throw new RangeError("Demo table width must be between 100 and 200 cm.");
  const halfWidth = widthCm / 200;
  return {
    ...scene,
    objects: scene.objects.map((object) => {
      if (object.id === "top")
        return { ...object, size: [widthCm / 100, ...object.size.slice(1)] };
      if (!object.id.startsWith("leg_")) return object;
      return {
        ...object,
        position: [
          Math.sign(object.position[0]) * (halfWidth - 0.13),
          ...object.position.slice(1),
        ],
      };
    }),
  };
}
