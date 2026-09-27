export const slugify = (value) =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90)
    .replace(/-$/, "") || "producto";
export function productURLs(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS public_stores(org_id TEXT PRIMARY KEY REFERENCES organizations(id),slug TEXT NOT NULL UNIQUE);
 CREATE TABLE IF NOT EXISTS product_urls(product_id TEXT PRIMARY KEY REFERENCES products(id),org_id TEXT NOT NULL REFERENCES organizations(id),slug TEXT NOT NULL,UNIQUE(org_id,slug));
 CREATE TABLE IF NOT EXISTS shared_selections(code TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id),version INTEGER NOT NULL,selection TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(product_id,version,selection));`);
  function pathFor(p) {
    let row = db
      .prepare("SELECT slug FROM product_urls WHERE product_id=?")
      .get(p.id);
    if (!row) {
      const base = slugify(p.name);
      let slug = base,
        n = 2;
      while (
        db
          .prepare("SELECT 1 FROM product_urls WHERE org_id=? AND slug=?")
          .get(p.org_id, slug)
      )
        slug = base + "-" + n++;
      db.prepare("INSERT INTO product_urls VALUES(?,?,?)").run(
        p.id,
        p.org_id,
        slug,
      );
      row = { slug };
    }
    let org = db
      .prepare("SELECT slug FROM public_stores WHERE org_id=?")
      .get(p.org_id);
    if (!org) {
      const base = slugify(
        db.prepare("SELECT name FROM organizations WHERE id=?").get(p.org_id)
          .name,
      );
      let slug = base,
        n = 2;
      while (db.prepare("SELECT 1 FROM public_stores WHERE slug=?").get(slug))
        slug = base + "-" + n++;
      db.prepare("INSERT INTO public_stores VALUES(?,?)").run(p.org_id, slug);
      org = { slug };
    }
    return "/p/" + org.slug + "/" + row.slug;
  }
  function resolve(path) {
    const match = path.match(/^\/p\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/);
    if (!match) return null;
    return (
      db
        .prepare(
          "SELECT p.* FROM products p JOIN product_urls u ON u.product_id=p.id JOIN public_stores o ON o.org_id=p.org_id WHERE o.slug=? AND u.slug=? AND p.deleted_at IS NULL",
        )
        .get(match[1], match[2]) || null
    );
  }
  for (const p of db.prepare("SELECT * FROM products").all()) pathFor(p);
  return { pathFor, resolve };
}
