# One platform, two ways to buy

Recommendation: one Yenze brand, one repository and one shared backend; two distinct offers and onboarding paths. Do not fork accounts, orders, billing or security into two projects.

## Yenze Studio — create your configurator

For a business that needs both the customer-facing configurator and operations. Choose a starting point, upload assets, create choices, preview and publish. Includes access to the shared workspace and order workflow.

## Yenze Connect — give an existing configurator a backend

Proposed offer for agencies and businesses with an existing interface, including the standalone source templates at https://yenze.io/configurators. Preserve their design and renderer. Connect selections to saved configurations, quotes, customer accounts, order snapshots and approval workflows.

Positioning: “Already built the configurator? Now put it to work.” / “Ya tienes el configurador. Ahora ponlo a vender.”

This is an integration offer to develop and validate, not an existing universal one-click connector. The current embed SDK renders Yenze configurators; it does not automatically add operations to arbitrary external frontends.

## Shared architecture

- One workspace, users, permissions, catalog schema, server-side pricing and versioned configurations.
- Two interfaces: our visual builder, or the customer's existing renderer.
- An adapter maps external option IDs to a published product manifest. Importing arbitrary client-side totals is never the pricing contract.
- Browser code uses a public project identity and short-lived narrowly scoped sessions; private API tokens remain on the server.
- An order stores the validated selection, price/version and appropriate artwork references. Webhooks require signing, idempotency and delivery retries before production claims.
- Self-host the AGPL engine; optional managed hosting/support can be the recurring offer. Existing premium template licenses remain separate and need compatibility review before redistributing combined code.

## First integration to validate

Pick one existing simple product template. Map its option IDs and price rules, save a configuration, request a quote, recover it from another browser and find the same selection in the merchant workspace. Verify changed product versions, invalid combinations, tampered amounts, duplicate submissions and workspace isolation. Then add checkout and customer notifications with test providers.

Success is one real end-to-end adapter, not a claim of compatibility with every renderer. Build the SDK from that adapter, then validate a second template before advertising a universal integration.

## Navigation and commercial separation

Two explicit paths: “Build a configurator” and “Connect my existing configurator”. One sign-in and one merchant workspace. Explain which offer creates the visual experience and which provides its operations. Retain the current source-template storefront as an additional entry point; do not replace its one-time purchases with an implied mandatory subscription.

Do not split repositories until independently versioned packages or actual team ownership require it. A later monorepo can contain builder, backend, SDK and examples while preserving a shared domain model.
