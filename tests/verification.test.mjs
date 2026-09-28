import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { emailVerification } from "../server/email-verification.mjs";
test("Email verification uses expiring hashed single-use tokens and rolls back failed delivery", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "CREATE TABLE users(id TEXT PRIMARY KEY);INSERT INTO users VALUES('u');INSERT INTO users VALUES('v');",
  );
  let html = "";
  const service = await emailVerification(db, {
    origin: "https://studio.example",
    enabled: () => true,
    mail: async (to, subject, body) => {
      html = body;
      return true;
    },
  });
  try {
    const user = { id: "u", email: "buyer@example.test" };
    await service.send(user);
    const token = html.match(/verify=([a-f0-9]{64})/)[1];
    assert.notEqual(
      db.prepare("SELECT token FROM email_verifications").get().token,
      token,
    );
    await assert.rejects(service.send(user), /Espera un minuto/);
    assert.equal(await service.verified("u"), false);
    await service.confirm(token);
    assert.equal(await service.verified("u"), true);
    assert.equal(await service.verified("v"), false);
    await assert.rejects(() => service.confirm(token), /caducado/);
    await service.send({ id: "v", email: "second@example.test" });
    const expired = html.match(/verify=([a-f0-9]{64})/)[1];
    db.prepare("UPDATE email_verifications SET expires=0").run();
    await assert.rejects(() => service.confirm(expired), /caducado/);
    const failing = await emailVerification(db, {
      origin: "https://studio.example",
      enabled: () => true,
      mail: async () => {
        throw Error("Offline");
      },
    });
    await assert.rejects(
      failing.send({ id: "v", email: "second@example.test" }),
      /Offline/,
    );
    assert.equal(
      db.prepare("SELECT count(*) n FROM email_verifications").get().n,
      0,
    );
  } finally {
    db.close();
  }
});
