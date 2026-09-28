import { openDB } from "./db.mjs";
export async function openRuntimeDB(dir) {
  if (process.env.DATABASE_URL) {
    const { openPostgres } = await import("./postgres.mjs");
    return openPostgres(process.env.DATABASE_URL);
  }
  if (process.env.VERCEL)
    throw Error(
      "DATABASE_URL is required on Vercel. Local SQLite is not persistent there.",
    );
  const db = openDB(dir);
  let tail = Promise.resolve();
  db.withConnection = async (fn) => {
    const before = tail;
    let unlock;
    tail = new Promise((resolve) => {
      unlock = resolve;
    });
    await before;
    try {
      return await fn();
    } finally {
      unlock();
    }
  };
  return db;
}
