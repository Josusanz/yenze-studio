import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import pg from "pg";
import { postgresSQL } from "../server/postgres.mjs";

test("PostgreSQL placeholder conversion preserves literals and conflict handling", () => {
  assert.equal(
    postgresSQL("SELECT '?' a, ? b, 'it''s ?' c, ? d"),
    "SELECT '?' a, $1 b, 'it''s ?' c, $2 d",
  );
  assert.equal(
    postgresSQL("INSERT OR IGNORE INTO events VALUES(?,?)"),
    "INSERT INTO events VALUES($1,$2) ON CONFLICT DO NOTHING",
  );
  assert.equal(
    postgresSQL(
      "SELECT length(CAST(selection AS BLOB)) FROM shared_selections",
    ),
    "SELECT octet_length(selection) FROM shared_selections",
  );
});

test(
  "PostgreSQL: isolated tenants, binary templates, concurrent edits, quotes and restart persistence",
  {
    skip: !process.env.YENZE_TEST_DATABASE_URL,
    timeout: 120000,
  },
  async (t) => {
    const schema = "yenze_test_" + randomBytes(8).toString("hex");
    const adminDB = new pg.Client({
      connectionString: process.env.YENZE_TEST_DATABASE_URL,
    });
    await adminDB.connect();
    let child;
    const stop = async () => {
      if (child && child.exitCode === null) {
        const exit = new Promise((resolve) => child.once("exit", resolve));
        child.kill();
        await exit;
      }
    };
    t.after(async () => {
      await stop();
      // Only the unique schema created by this test may be removed.
      await adminDB.query(`DROP SCHEMA "${schema}" CASCADE`);
      await adminDB.end();
    });
    await adminDB.query(`CREATE SCHEMA "${schema}"`);
    await adminDB.query(`SET search_path TO "${schema}"`);
    await adminDB.query(
      readFileSync(
        new URL("../migrations/001-studio-postgres.sql", import.meta.url),
        "utf8",
      ),
    );
    const url = new URL(process.env.YENZE_TEST_DATABASE_URL);
    url.searchParams.set("options", "-c search_path=" + schema);
    const port = 31789;
    const start = async () => {
      child = spawn(process.execPath, ["server/index.mjs"], {
        cwd: new URL("..", import.meta.url),
        env: {
          ...process.env,
          VERCEL: "",
          NODE_ENV: "test",
          PORT: String(port),
          DATABASE_URL: url.href,
          APP_ORIGIN: `http://localhost:${port}`,
          STRIPE_SECRET_KEY: "",
          RESEND_API_KEY: "",
        },
        stdio: "pipe",
      });
      let logs = "";
      child.stderr.on("data", (b) => {
        logs += b;
      });
      for (let i = 0; i < 100; i++) {
        if (child.exitCode !== null)
          throw Error(
            "PostgreSQL server failed: " +
              logs.replaceAll(
                process.env.YENZE_TEST_DATABASE_URL,
                "[redacted]",
              ),
          );
        try {
          if ((await fetch(`http://localhost:${port}/api/health`)).ok) return;
        } catch {}
        await new Promise((r) => setTimeout(r, 100));
      }
      throw Error("PostgreSQL server did not start");
    };
    const client = () => {
      let cookie = "";
      return async (route, method = "GET", data, expected = 200) => {
        const response = await fetch(`http://localhost:${port}/api${route}`, {
          method,
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: data === undefined ? undefined : JSON.stringify(data),
        });
        if (response.headers.get("set-cookie"))
          cookie = response.headers.get("set-cookie").split(";")[0];
        const result = await response.json();
        if (expected !== null)
          assert.equal(response.status, expected, JSON.stringify(result));
        return expected === null ? { status: response.status, result } : result;
      };
    };
    await start();
    const owner = client(),
      other = client(),
      buyer = client(),
      anon = client();
    for (const [call, name, company] of [
      [owner, "Owner", "Atelier"],
      [other, "Other", "Other"],
      [buyer, "Buyer", undefined],
    ]) {
      await call("/auth/signup", "POST", {
        name,
        company,
        email: name.toLowerCase() + "@example.test",
        password: "Test-password-928!",
      });
    }
    let product = await owner(
      "/products",
      "POST",
      { template: "cabinet" },
      201,
    );
    await other("/products/" + product.id, "GET", undefined, 404);
    await anon("/public/" + product.id, "GET", undefined, 404);
    const shirt = await owner(
      "/products",
      "POST",
      { template: "shirt-3d" },
      201,
    );
    assert.ok(shirt.draft.model);
    const results = await Promise.all(
      [1, 2].map((n) =>
        owner(
          "/products/" + product.id,
          "PATCH",
          {
            revision: product.revision,
            manifest: { ...product.draft, name: "Cabinet " + n },
            mode: "quote",
          },
          null,
        ),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    product = await owner("/products/" + product.id);
    product = await owner("/products/" + product.id + "/publish", "POST", {
      revision: product.revision,
    });
    const shared = await anon("/public/" + product.id + "/share", "POST", {
      version: product.revision,
      selection: {},
    });
    assert.match(shared.path, /^\/p\//);
    const config = await buyer(
      "/configurations",
      "POST",
      { productId: product.id, version: product.revision, selection: {} },
      201,
    );
    let order = await buyer(
      "/customer/orders",
      "POST",
      { configurationId: config.id },
      201,
    );
    await other("/orders/" + order.id, "GET", undefined, 404);
    order = await owner("/orders/" + order.id + "/offer", "POST", {
      amount: 55000,
      note: "Delivery included",
    });
    order = await buyer("/orders/" + order.id + "/accept", "POST", {
      revision: order.offer_revision,
    });
    assert.equal(order.status, "accepted");
    await stop();
    await start();
    assert.equal((await owner("/products/" + product.id)).id, product.id);
    assert.equal((await buyer("/orders/" + order.id)).amount, 55000);
    assert.equal((await anon("/public/" + product.id)).id, product.id);
  },
);
