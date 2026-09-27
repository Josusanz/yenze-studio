import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
/** Only abandoned originals older than seven days; retain every draft, version and saved selection. */
export function prunePrintAssets(db, { apply = false, now = Date.now() } = {}) {
  const cutoff = new Date(now - 7 * 86400000).toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    const rows = db
      .prepare(
        `SELECT p.ref,length(p.bytes) bytes FROM print_assets p WHERE p.created < ?
      AND NOT EXISTS(SELECT 1 FROM products d WHERE instr(d.draft,p.ref)>0)
      AND NOT EXISTS(SELECT 1 FROM versions v WHERE instr(v.manifest,p.ref)>0)
      AND NOT EXISTS(SELECT 1 FROM configurations c WHERE instr(c.selection,p.ref)>0 OR instr(c.manifest,p.ref)>0)
      AND NOT EXISTS(SELECT 1 FROM shared_selections s WHERE instr(s.selection,p.ref)>0)
      AND NOT EXISTS(SELECT 1 FROM commerce_tickets t WHERE t.expires>? AND instr(t.selection,p.ref)>0)`,
      )
      .all(cutoff, now);
    if (apply)
      for (const row of rows)
        db.prepare("DELETE FROM print_assets WHERE ref=?").run(row.ref);
    db.exec("COMMIT");
    return {
      apply,
      count: rows.length,
      bytes: rows.reduce((n, r) => n + r.bytes, 0),
    };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const file = process.argv[2];
  if (!file)
    throw Error(
      "Uso: node scripts/prune-print-assets.mjs BASE.sqlite [--apply]",
    );
  const db = new DatabaseSync(file);
  try {
    console.log(
      JSON.stringify(
        prunePrintAssets(db, { apply: process.argv.includes("--apply") }),
      ),
    );
  } finally {
    db.close();
  }
}
