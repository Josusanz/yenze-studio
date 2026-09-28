import pg from "pg";
import { readFile } from "node:fs/promises";
const connectionString =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString)
  throw Error("Set DATABASE_URL_UNPOOLED for schema migrations.");
const client = new pg.Client({ connectionString });
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(4928021)");
  for (const migration of [
    "001-studio-postgres.sql",
    "002-large-shared-designs.sql",
  ]) {
    await client.query(
      await readFile(
        new URL("../migrations/" + migration, import.meta.url),
        "utf8",
      ),
    );
  }
  await client.query("COMMIT");
  console.log("Studio schema migrations 001–002 applied.");
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Migration failed:", e.code || "connection error");
  process.exitCode = 1;
} finally {
  await client.end();
}
