import test from "node:test";
import assert from "node:assert/strict";
import {
  choicePreset,
  choiceTargets,
  buildGuidedChoice,
} from "../core/choice-guide.mjs";
import { makeTemplate } from "../server/templates.mjs";
import { validManifest, evaluateProduct } from "../server/validation.mjs";
let next = 0;
const uid = () => `guide_${next++}`;
test("Guided choices produce valid priced groups and respect existing visual controls", async () => {
  const m = await makeTemplate("table-3d", () => {});
  assert.ok(!choiceTargets(m, "material").some((t) => t.id === "top"));
  for (const kind of ["size", "delivery", "material", "visibility"]) {
    const draft = choicePreset(kind);
    if (draft.effect !== "choice")
      draft.target = choiceTargets(m, draft.effect)[0].id;
    draft.options[1].price = "12.50";
    const g = buildGuidedChoice(m, draft, uid);
    m.groups.push(g);
    validManifest(m, () => true, { publish: true });
    assert.equal(
      evaluateProduct(m, { [g.id]: g.options[1].id }).total,
      m.basePrice + 1250,
    );
  }
  assert.equal(
    choiceTargets(m, "visibility").some((t) => t.id === m.groups.at(-1).node),
    false,
  );
});
test("Guided choices reject ambiguous names, invalid prices, missing targets and product limits without mutating the draft", async () => {
  const m = await makeTemplate("guided", () => {});
  const before = JSON.stringify(m);
  for (const patch of [
    { label: "" },
    {
      options: [
        { label: "S", price: "0" },
        { label: " s ", price: "0" },
      ],
    },
    {
      options: [
        { label: "S", price: "0" },
        { label: "M", price: "-1" },
      ],
    },
    {
      options: [
        { label: "S", price: "0" },
        { label: "M", price: "NaN" },
      ],
    },
    { effect: "material", target: "missing" },
  ]) {
    assert.throws(() =>
      buildGuidedChoice(m, { ...choicePreset("size"), ...patch }, uid),
    );
  }
  assert.equal(JSON.stringify(m), before);
  assert.throws(
    () =>
      buildGuidedChoice(
        {
          ...m,
          groups: Array.from({ length: 40 }, (_, i) => ({
            order: i,
            options: [],
          })),
        },
        choicePreset("size"),
        uid,
      ),
    /límite/,
  );
  assert.throws(
    () =>
      buildGuidedChoice(
        { ...m, groups: [{ order: 0, options: Array(499).fill({}) }] },
        choicePreset("size"),
        uid,
      ),
    /límite/,
  );
});
