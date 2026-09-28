import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
import { attachDatabasePool } from "@vercel/functions";
// All integer values in this schema are bounded JS counts, timestamps or cents.
const safeInteger = (value) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n))
    throw Error("Database integer exceeds safe range");
  return n;
};
pg.types.setTypeParser(20, safeInteger);
pg.types.setTypeParser(1700, safeInteger);
export function postgresSQL(sql) {
  sql = sql.replace(
    /length\(CAST\(selection AS BLOB\)\)/gi,
    "octet_length(selection)",
  );
  let converted = sql.replace(/\bINSERT OR IGNORE INTO\b/gi, "INSERT INTO");
  if (/\bINSERT OR IGNORE INTO\b/i.test(sql))
    converted = converted.replace(/;?\s*$/, " ON CONFLICT DO NOTHING");
  let parameter = 0;
  // Preserve quoted SQL literals; only bind actual placeholders.
  converted = converted.replace(/'(?:''|[^'])*'|\?/g, (match) =>
    match === "?" ? "$" + ++parameter : match,
  );
  return converted;
}
export async function openPostgres(connectionString) {
  const pool = new pg.Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000,
  });
  if (process.env.VERCEL) attachDatabasePool(pool);
  const context = new AsyncLocalStorage();
  try {
    const result = await pool.query(
      "SELECT version FROM yenze_migrations WHERE version=1",
    );
    if (!result.rowCount)
      throw Error("Run PostgreSQL migrations before starting Studio");
  } catch (error) {
    await pool.end();
    throw error;
  }
  const query = (sql, args = []) =>
    (context.getStore() || pool).query(
      postgresSQL(sql),
      args.map((v) => (v instanceof Uint8Array ? Buffer.from(v) : v)),
    );
  return {
    dialect: "postgres",
    prepare(sql) {
      return {
        async get(...args) {
          return (await query(sql, args)).rows[0];
        },
        async all(...args) {
          return (await query(sql, args)).rows;
        },
        async run(...args) {
          const r = await query(sql, args);
          return { changes: r.rowCount };
        },
      };
    },
    async exec(sql) {
      // Schema changes are applied by scripts/migrate-postgres.mjs, never on cold starts.
      if (/^\s*(CREATE TABLE|ALTER TABLE)/i.test(sql)) return;
      if (sql === "BEGIN IMMEDIATE")
        return query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      return query(sql);
    },
    async withConnection(fn) {
      const client = await pool.connect();
      try {
        return await context.run(client, fn);
      } finally {
        try {
          await client.query("ROLLBACK");
        } finally {
          client.release();
        }
      }
    },
    async rateLimit(key, maximum) {
      const now = Date.now();
      await query("DELETE FROM rate_limits WHERE expires < ?", [now - 600000]);
      const result = await query(
        `INSERT INTO rate_limits(key,hits,expires) VALUES(?,1,?)
        ON CONFLICT(key) DO UPDATE SET
          hits=CASE WHEN rate_limits.expires<=? THEN 1 ELSE rate_limits.hits+1 END,
          expires=CASE WHEN rate_limits.expires<=? THEN ? ELSE rate_limits.expires END
        RETURNING hits`,
        [key, now + 600000, now, now, now + 600000],
      );
      return result.rows[0].hits <= maximum;
    },
    close: () => pool.end(),
  };
}
