import { test } from "node:test";
import assert from "node:assert/strict";
import { resizeDemoTable } from "../core/demo-table.mjs";
test("all supported table widths contain every leg and preserve the original scene", () => {
  const source = {
    objects: [
      { id: "top", size: [1.5, 0.09, 0.8], position: [0, 0.77, 0] },
      ...[-0.62, 0.62].flatMap((x, i) =>
        [-0.27, 0.27].map((z, j) => ({
          id: `leg_${i}${j}`,
          size: [0.07, 0.73, 0.07],
          position: [x, 0.365, z],
        })),
      ),
    ],
  };
  const before = structuredClone(source);
  for (let width = 100; width <= 200; width += 10) {
    const result = resizeDemoTable(source, width),
      top = result.objects[0];
    assert.equal(top.size[0], width / 100);
    for (const leg of result.objects.slice(1)) {
      assert.ok(Math.abs(leg.position[0]) + leg.size[0] / 2 < top.size[0] / 2);
      assert.ok(Math.abs(leg.position[2]) + leg.size[2] / 2 < top.size[2] / 2);
      assert.ok(
        leg.position[1] + leg.size[1] / 2 >= top.position[1] - top.size[1] / 2,
      );
    }
  }
  assert.deepEqual(source, before);
  for (const bad of [99, 201, NaN, Infinity])
    assert.throws(() => resizeDemoTable(source, bad), RangeError);
});
