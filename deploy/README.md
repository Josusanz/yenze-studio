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

## Connect the public landing to the creator

The landing supports `VITE_CREATOR_ORIGIN=https://YOUR-CREATOR-HOST`. Build the showcase with this variable and its primary buttons lead to registration, sign-in and the creator, preserving the selected language. Never point this at a host until `/api/health`, account creation, saving and a restart persistence check pass. Without a configured host it accurately links to installation, not a fake online account page.

`render.yaml` is an optional single-instance Docker + persistent disk recipe. Import the GitHub repository into Render, review its paid hosting/storage price The blueprint sets `APP_ORIGIN` from the HTTPS URL assigned by Render, so the first deployment does not need a manually guessed hostname. If you add a custom domain later, update `APP_ORIGIN` to that exact HTTPS origin. No provider resources have been purchased or deployed by adding this file. Other persistent Docker hosts work with the existing Compose recipe.

Provider references: https://render.com/docs/blueprint-spec and https://render.com/docs/disks.

The landing is available in English and Spanish. The builder and business portal currently remain Spanish; translating the marketing site does not translate user-created product content.
