import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { backupDatabase, restoreDatabase, verify } from "../scripts/backup.mjs";
test("Online SQLite backup includes WAL changes and restores to a new directory without overwriting data", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "yenze-backup-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = join(dir, "source.sqlite"),
    target = join(dir, "backup.sqlite"),
    db = new DatabaseSync(source);
  t.after(() => db.close());
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE example(id INTEGER PRIMARY KEY, name TEXT); INSERT INTO example VALUES(1,'Saved configuration')",
  );
  await backupDatabase(source, target);
  assert.equal(verify(target), true);
  assert.equal(statSync(target).mode & 0o777, 0o600);
  const restored = restoreDatabase(target, join(dir, "restored")),
    read = new DatabaseSync(restored, { readOnly: true });
  assert.equal(
    read.prepare("SELECT name FROM example").get().name,
    "Saved configuration",
  );
  read.close();
  await assert.rejects(backupDatabase(source, target), /ya existe/);
  assert.throws(
    () => restoreDatabase(target, join(dir, "restored")),
    /carpeta nueva/,
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM example").get().n, 1);
});
