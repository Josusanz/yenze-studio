# Deploy Studio on Vercel

Studio supports PostgreSQL for persistent accounts, workspaces, assets and orders on Vercel. Local development still uses SQLite when `DATABASE_URL` is absent. Never use SQLite as persistent storage on Vercel.

## Setup

1. Create a separate Vercel project for this repository. Do not attach database credentials to a static showcase deployment.
2. Connect a PostgreSQL database, such as Neon. Set `DATABASE_URL` to its pooled connection string and `DATABASE_URL_UNPOOLED` to its direct connection string. Keep both private and outside Git.
3. Set `APP_ORIGIN` to the exact public HTTPS origin, for example `https://studio.example.com`. Attach that domain to the project.
4. Before the first deployment, run `npm run db:migrate` with the direct connection in the environment. The versioned migration is transactional and can be rerun. The runtime refuses to start without the schema; cold starts do not apply DDL.
5. Deploy the repository root using the included `vercel.json`. It builds the full React creator and routes API requests and product URLs to a Node function in Frankfurt.
6. Test `/api/health`, signup, a new product, publication and a fresh login through the actual public origin. A healthy static page alone is not a backend check.

The separate showcase build can link to the creator using `VITE_CREATOR_ORIGIN=https://studio.example.com` at build time. It needs no database credentials.

## Current hosted beta limits

- Online uploads are limited to **3 MB per file** to fit Vercel's 4.5 MB request limit after base64 encoding. The interface checks this before uploading. Larger model uploads need a direct object-storage upload pipeline. Self-hosted installations retain their 20 MB model/image and 10 MB print-original limits.
- Assets and print originals currently live in PostgreSQL. Monitor the database storage allowance and upgrade or move binary assets to object storage before a broad launch.
- Rate limits are stored in PostgreSQL, shared between function instances. Product saves use revision checks to reject concurrent overwrites. Tenant permissions and server-side prices apply to both database drivers.
- Signup, creator, saved configurations and quote requests work without Stripe or email. Actual payments require Stripe Connect credentials and webhook setup; email verification/reset delivery requires Resend and a verified sender. Neither capability is implied by deploying the app.
- The marketing site is available in Spanish and English. The creator currently uses Spanish.
- This is an open beta, not an SLA-backed managed service. Configure and verify backup/restore and operational monitoring before accepting business-critical orders.

## Database tests

`YENZE_TEST_DATABASE_URL` enables PostgreSQL integration tests in `npm test`. They create a randomly named schema, run migrations there, test tenant isolation, binary templates, concurrent edits, quotes and persistence across a server restart, then remove only that schema. They never reset the default schema. CI supplies an isolated PostgreSQL service.

Do not set `DATABASE_URL` globally when running the SQLite suites. Use `YENZE_TEST_DATABASE_URL` for the PostgreSQL tests.
