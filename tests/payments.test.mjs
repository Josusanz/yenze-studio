import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Stripe from "stripe";
import { openDB } from "../server/db.mjs";
import { payments } from "../server/payments.mjs";
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "yenze-stripe-")),
    db = openDB(dir);
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  db.exec(
    `INSERT INTO users VALUES('u','buyer@example.com','Buyer','unused','now');INSERT INTO organizations(id,slug,name,stripe_account,created) VALUES('org','org','Shop','acct_shop','now');INSERT INTO products(id,org_id,name,niche,draft,created,updated) VALUES('p','org','Product','test','{}','now','now');INSERT INTO configurations VALUES('c','u','org','p',1,'My product','{}','{}',12345,'now');INSERT INTO orders(id,org_id,user_id,configuration_id,status,amount,created,updated) VALUES('o','org','u','c','accepted',12345,'now','now');`,
  );
  return db;
}
test("Signed Stripe events: account, amount, signature, idempotency and refund", async (t) => {
  const db = fixture(t),
    sdk = new Stripe("sk_test_fixture"),
    secret = "whsec_fixture",
    pay = payments({
      client: sdk,
      webhookSecret: secret,
      origin: "http://localhost",
      db,
      now: () => new Date().toISOString(),
      audit: () => {},
    });
  const order = () => db.prepare("SELECT * FROM orders").get();
  const event = {
    id: "evt_paid",
    type: "checkout.session.completed",
    account: "acct_shop",
    data: {
      object: {
        id: "cs_paid",
        payment_status: "paid",
        currency: "eur",
        amount_total: 12345,
        payment_intent: "pi_paid",
        metadata: { order: "o", organization: "org" },
      },
    },
  };
  const send = (e) => {
    const payload = JSON.stringify(e);
    return pay.webhook(
      Buffer.from(payload),
      sdk.webhooks.generateTestHeaderString({ payload, secret }),
    );
  };
  await assert.rejects(
    () => pay.webhook(Buffer.from(JSON.stringify(event)), "invalid"),
    /Firma/,
  );
  await assert.rejects(
    () => send({ ...event, account: "acct_other" }),
    /coincide/,
  );
  assert.equal(order().status, "accepted");
  const wrong = structuredClone(event);
  wrong.data.object.amount_total = 1;
  await assert.rejects(() => send(wrong), /coincide/);
  assert.equal(db.prepare("SELECT count(*) n FROM events").get().n, 0);
  const unpaid = structuredClone(event);
  unpaid.id = "evt_unpaid";
  unpaid.data.object.payment_status = "unpaid";
  await send(unpaid);
  assert.equal(order().status, "accepted");
  await send(event);
  await send(event);
  assert.equal(order().status, "paid");
  assert.equal(db.prepare("SELECT count(*) n FROM events").get().n, 2);
  await send({
    id: "evt_refund",
    type: "charge.refunded",
    account: "acct_shop",
    data: { object: { payment_intent: "pi_paid", refunded: true } },
  });
  assert.equal(order().status, "refunded");
});
test("Checkout charges the stored amount to the connected account with a stable idempotency key", async (t) => {
  const db = fixture(t);
  let observed;
  const client = {
    accounts: { retrieve: async () => ({ charges_enabled: true }) },
    checkout: {
      sessions: {
        create: async (data, options) => {
          observed = { data, options };
          return { id: "cs_test", url: "https://checkout.stripe.com/test" };
        },
        retrieve: async () => ({
          status: "open",
          url: "https://checkout.stripe.com/test",
        }),
      },
    },
  };
  const pay = payments({
      client,
      webhookSecret: "whsec_fixture",
      db,
      origin: "https://studio.example",
      now: () => new Date().toISOString(),
      audit: () => {},
    }),
    org = db.prepare("SELECT * FROM organizations").get(),
    o = db.prepare("SELECT * FROM orders").get();
  const noWebhook = payments({
    client,
    db,
    origin: "https://studio.example",
    now: () => new Date().toISOString(),
    audit: () => {},
  });
  await assert.rejects(
    noWebhook.checkout(
      o,
      org,
      { email: "buyer@example.com" },
      { name: "Product", id: "c" },
    ),
    /webhook/,
  );
  await pay.checkout(
    o,
    org,
    { email: "buyer@example.com" },
    { name: "Product", id: "c" },
  );
  assert.equal(observed.data.line_items[0].price_data.unit_amount, 12345);
  assert.equal(observed.options.stripeAccount, "acct_shop");
  assert.equal(observed.options.idempotencyKey, "order-o-0");
  assert.equal(
    db.prepare("SELECT status FROM orders").get().status,
    "accepted",
  );
  assert.deepEqual(
    await pay.checkout(
      db.prepare("SELECT * FROM orders").get(),
      org,
      {},
      { name: "Product" },
    ),
    { url: "https://checkout.stripe.com/test" },
  );
});
