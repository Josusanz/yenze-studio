import Stripe from "stripe";
import { fail } from "./validation.mjs";
export function payments({
  secret,
  webhookSecret,
  origin,
  db,
  now,
  audit,
  client,
}) {
  const stripe =
    client ||
    (secret
      ? new Stripe(secret, { maxNetworkRetries: 2, timeout: 20000 })
      : null);
  function ready() {
    if (!stripe) fail("Stripe no está configurado en esta instalación.", 503);
    return stripe;
  }
  async function connect(org, email) {
    const client = ready();
    let account = org.stripe_account;
    if (!account) {
      const created = await client.accounts.create(
        { type: "standard", email, metadata: { organization: org.id } },
        { idempotencyKey: "org-" + org.id },
      );
      account = created.id;
      await db
        .prepare("UPDATE organizations SET stripe_account=? WHERE id=?")
        .run(account, org.id);
    }
    const link = await client.accountLinks.create({
      account,
      type: "account_onboarding",
      refresh_url: origin + "/?page=settings&stripe=refresh",
      return_url: origin + "/?page=settings&stripe=return",
    });
    return { url: link.url };
  }
  async function status(org) {
    if (!stripe || !org.stripe_account)
      return { configured: !!stripe, connected: false, chargesEnabled: false };
    const a = await stripe.accounts.retrieve(org.stripe_account);
    return {
      configured: true,
      connected: true,
      chargesEnabled: !!a.charges_enabled,
      detailsSubmitted: !!a.details_submitted,
    };
  }
  async function checkout(order, org, user, configuration) {
    const client = ready();
    if (!webhookSecret)
      fail("Configura el webhook de Stripe antes de aceptar pagos.", 503);
    if (!org.stripe_account)
      fail("El comercio aún no ha conectado Stripe.", 409);
    if (order.status !== "accepted")
      fail("Acepta el presupuesto antes de pagar.", 409);
    if (order.amount < 50) fail("El importe mínimo de pago es 0,50 €.");
    if (order.checkout_id) {
      const session = await client.checkout.sessions.retrieve(
        order.checkout_id,
        { stripeAccount: org.stripe_account },
      );
      if (session.status === "open" && session.url) return { url: session.url };
      if (session.status === "complete")
        fail("El pago está en proceso de confirmación.", 409);
      await db
        .prepare(
          "UPDATE orders SET checkout_id=NULL,checkout_url=NULL,offer_revision=offer_revision+1 WHERE id=? AND checkout_id=?",
        )
        .run(order.id, order.checkout_id);
      order = await db.prepare("SELECT * FROM orders WHERE id=?").get(order.id);
    }
    const a = await client.accounts.retrieve(org.stripe_account);
    if (!a.charges_enabled)
      fail("El comercio debe completar su conexión con Stripe.", 409);
    const session = await client.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: user.email,
        client_reference_id: order.id,
        metadata: { order: order.id, organization: org.id },
        payment_intent_data: {
          metadata: { order: order.id, organization: org.id },
        },
        line_items: [
          {
            price_data: {
              currency: "eur",
              unit_amount: order.amount,
              product_data: {
                name: configuration.name,
                description: "Configuración " + configuration.id.slice(0, 8),
              },
            },
            quantity: 1,
          },
        ],
        success_url: origin + "/?page=portal&payment=returned",
        cancel_url: origin + "/?page=portal&payment=cancelled",
      },
      {
        stripeAccount: org.stripe_account,
        idempotencyKey: `order-${order.id}-${order.offer_revision}`,
      },
    );
    await db
      .prepare(
        "UPDATE orders SET checkout_id=?,checkout_url=?,updated=? WHERE id=?",
      )
      .run(session.id, session.url, now(), order.id);
    return { url: session.url };
  }
  async function webhook(raw, signature) {
    if (!stripe || !webhookSecret) fail("Webhook no configurado.", 503);
    let event;
    try {
      event = stripe.webhooks.constructEvent(raw, signature, webhookSecret);
    } catch {
      fail("Firma de Stripe no válida.", 400);
    }
    if (await db.prepare("SELECT id FROM events WHERE id=?").get(event.id))
      return { received: true };
    const object = event.data.object;
    await db.exec("BEGIN IMMEDIATE");
    try {
      if (
        [
          "checkout.session.completed",
          "checkout.session.async_payment_succeeded",
        ].includes(event.type) &&
        object.payment_status === "paid"
      ) {
        const order = await db
          .prepare("SELECT * FROM orders WHERE id=?")
          .get(object.metadata?.order || "");
        if (!order) fail("Pedido todavía no disponible.", 409);
        const org = await db
          .prepare("SELECT * FROM organizations WHERE id=?")
          .get(order.org_id);
        if (
          event.account !== org.stripe_account ||
          object.amount_total !== order.amount ||
          object.currency !== "eur" ||
          object.metadata?.organization !== org.id
        )
          fail("El pago no coincide con el pedido.", 400);
        if (order.checkout_id && order.checkout_id !== object.id)
          fail("Sesión de pago incorrecta.", 400);
        if (order.status === "accepted")
          await db
            .prepare(
              "UPDATE orders SET status=?,checkout_id=?,payment_intent=?,updated=? WHERE id=?",
            )
            .run("paid", object.id, object.payment_intent, now(), order.id);
        await audit(org.id, "stripe", "payment.confirmed", order.id);
      }
      if (event.type === "charge.refunded") {
        const order = await db
          .prepare("SELECT * FROM orders WHERE payment_intent=?")
          .get(object.payment_intent || "");
        if (order) {
          const org = await db
            .prepare("SELECT * FROM organizations WHERE id=?")
            .get(order.org_id);
          if (org.stripe_account !== event.account) fail("Cuenta incorrecta.");
          if (object.refunded)
            await db
              .prepare("UPDATE orders SET status=?,updated=? WHERE id=?")
              .run("refunded", now(), order.id);
          await audit(
            org.id,
            "stripe",
            object.refunded ? "payment.refunded" : "payment.partial_refund",
            order.id,
          );
        }
      }
      await db.prepare("INSERT INTO events VALUES(?,?)").run(event.id, now());
      await db.exec("COMMIT");
      return { received: true };
    } catch (e) {
      await db.exec("ROLLBACK");
      throw e;
    }
  }
  return { connect, status, checkout, webhook, configured: !!stripe };
}
