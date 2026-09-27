# Deployment

Choose a Linux host/container service with persistent disk and HTTPS. Use one application instance with SQLite. This package does not purchase infrastructure or provision a production account.

1. Clone the repository and copy `.env.example` to `.env` (keep it private).
2. Set APP_ORIGIN to the actual HTTPS origin and configure only providers you plan to enable.
3. Run `node --env-file=.env scripts/preflight.mjs`.
4. Run `docker compose -f deploy/compose.yml up -d --build` or build/start Node directly as in README.
5. Terminate HTTPS with your existing reverse proxy, forwarding to 127.0.0.1:3061 and preserving Origin. The container port is bound only to loopback.
6. Schedule online SQLite backups and copy them outside the host; test a restore and record the result.
7. Create your workspace, publish a quote configurator and complete the customer journey from a separate browser.
8. If enabling payments, complete Stripe test payment, webhook, refund and email verification with the actual provider before live keys.

Docker Compose is a deployment recipe, not evidence of a successful deployment. Configure resource limits appropriate to your host. Logs currently go to stdout/stderr; choose an operator-owned log/error-monitoring destination without exposing credentials or customer artwork.

## Static showcase

`npm run build:showcase` outputs `dist-showcase`. Deploy that folder to a static host. It shows the landing and interactive examples, with installation links to GitHub. It cannot run the editor, store uploads or process orders. Do not present a static showcase URL as the hosted SaaS.
