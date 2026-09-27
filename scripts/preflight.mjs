const env = process.env;
const checks = [];
const add = (label, ok, required, detail) =>
  checks.push({ label, ok, required, detail });
let secure = false;
try {
  const u = new URL(env.APP_ORIGIN);
  secure =
    u.protocol === "https:" &&
    u.origin === env.APP_ORIGIN &&
    !u.username &&
    !u.password;
} catch {}
add(
  "Public HTTPS origin",
  secure,
  true,
  "APP_ORIGIN must be an exact HTTPS origin without a path.",
);
add(
  "Node 24+",
  Number(process.versions.node.split(".")[0]) >= 24,
  true,
  "Use the supported Node runtime.",
);
const stripe = !!env.STRIPE_SECRET_KEY,
  webhook = !!env.STRIPE_WEBHOOK_SECRET;
add(
  "Stripe pair",
  stripe === webhook,
  true,
  "Set both Stripe secret and webhook secret, or leave both unset for quote-only operation.",
);
const email = !!env.RESEND_API_KEY && !!env.MAIL_FROM;
add(
  "Email delivery configuration",
  email,
  false,
  "Verification and password reset require Resend and a verified sender. A real delivery test remains necessary.",
);
add(
  "Payment email verification",
  !stripe || email,
  true,
  "Production checkout requires verified email; configure mail before enabling payments.",
);
add(
  "Persistent data directory",
  !!env.YENZE_DATA_DIR,
  false,
  "Default is ./data. Back it up off-host; do not use ephemeral serverless storage.",
);
for (const c of checks)
  console.log(
    `${c.ok ? "OK" : c.required ? "BLOCK" : "REVIEW"} ${c.label}: ${c.detail}`,
  );
console.log(
  "Manual checks: provider transactions, HTTPS proxy, offsite restore, privacy/operator details, pilot and security review.",
);
if (checks.some((c) => c.required && !c.ok)) process.exitCode = 1;
