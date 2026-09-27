import { DatabaseSync, backup } from "node:sqlite";
import {
  existsSync,
  mkdirSync,
  chmodSync,
  copyFileSync,
  constants,
  realpathSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
export async function backupDatabase(source, destination) {
  if (!existsSync(source)) throw Error("La base de datos de origen no existe.");
  if (existsSync(destination))
    throw Error("El destino ya existe; no se sobrescribe una copia.");
  mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
  // Reserve the pathname exclusively before SQLite opens it.
  const { openSync, closeSync } = await import("node:fs");
  closeSync(openSync(destination, "wx", 0o600));
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    await backup(db, destination);
  } finally {
    db.close();
  }
  chmodSync(destination, 0o600);
  verify(destination);
  return destination;
}
export function verify(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
      throw Error("La copia no supera la comprobación de integridad.");
    if (db.prepare("PRAGMA foreign_key_check").all().length)
      throw Error("La copia contiene referencias inválidas.");
    return true;
  } finally {
    db.close();
  }
}
export function restoreDatabase(source, directory) {
  verify(source);
  // Restore into a NEW directory so a live database and its WAL cannot be overwritten.
  if (existsSync(directory))
    throw Error(
      "Restaura en una carpeta nueva y arranca la aplicación con YENZE_DATA_DIR apuntando a ella.",
    );
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const destination = path.join(directory, "studio.sqlite");
  copyFileSync(source, destination, constants.COPYFILE_EXCL);
  chmodSync(destination, 0o600);
  verify(destination);
  return destination;
}
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [mode, source, target] = process.argv.slice(2);
  if (!source || !target || !["backup", "restore"].includes(mode))
    throw Error(
      "Uso: node scripts/backup.mjs backup ORIGEN.sqlite COPIA.sqlite | restore COPIA.sqlite CARPETA_NUEVA",
    );
  const destination =
    mode === "backup"
      ? await backupDatabase(source, target)
      : mode === "restore"
        ? restoreDatabase(source, target)
        : verify(source);
  console.log(JSON.stringify({ ok: true, destination }));
}
