// Only restore after the server has authorized access to this product.
export const recoveryKey = (product) =>
  `yenze:draft:${product.org_id}:${product.id}`;
export function readRecovery(storage, product) {
  try {
    const raw = storage.getItem(recoveryKey(product));
    if (!raw || raw.length > 2_000_000) return null;
    const value = JSON.parse(raw);
    if (
      value.productId !== product.id ||
      value.orgId !== product.org_id ||
      !Number.isSafeInteger(value.revision) ||
      !["quote", "purchase"].includes(value.mode) ||
      value.manifest?.schemaVersion !== 1 ||
      typeof value.manifest.name !== "string" ||
      !Array.isArray(value.manifest.groups)
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
export function writeRecovery(storage, product, manifest) {
  storage.setItem(
    recoveryKey(product),
    JSON.stringify({
      productId: product.id,
      orgId: product.org_id,
      revision: product.revision,
      mode: product.mode,
      manifest,
      savedAt: Date.now(),
    }),
  );
}
