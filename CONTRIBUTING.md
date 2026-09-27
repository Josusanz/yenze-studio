# Contributing

Yenze Studio is an early open-source product configurator, not an audited enterprise release. Help should improve real seller and buyer workflows.

## Local development

Use Node 24 or later. Run `npm ci`, `npm run dev`, then open http://localhost:3060. Create a local account. Runtime data stays in `data/`; never commit it. Read README before enabling payments or external AI services.

## Before submitting

1. Describe the seller's problem and the expected buyer experience.
2. Add a regression test for changed pricing, branching, permissions or persistence.
3. Run `npm run build`, `npm test`, and `npm run test:e2e`. Browser tests use temporary isolated databases. Install Playwright Chromium if Chrome is unavailable: `npx playwright install chromium`.
4. Check keyboard operation and 390px mobile layout. Do not introduce dependencies or assets without compatible licenses and provenance.
5. Keep credentials, customer records, uploaded models, and local screenshots with private content out of contributions.

Useful contributions: accessible controls, product templates with original assets, platform adapters, validation fixtures, translations and reproduction cases. Contributions are made under the project's AGPL-3.0-only license. Do not contribute code you cannot license.

## Repository status

The public repository is https://github.com/Josusanz/yenze-studio. Use Issues for reproducible problems and proposals, and pull requests for changes. There is no advertised support SLA. Read SECURITY.md for private vulnerability reporting.

## Release archive

Run `python3 scripts/package-source.py` after checks. It uses an explicit directory allowlist, excludes local databases, credentials and uploads, and packages only this project. Run `npm run build` afterward to include the archive in the website build. Review the archive before publishing.
