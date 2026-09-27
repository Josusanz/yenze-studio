# Security and deployment

This is a development release. Automated checks are not a penetration test or a production certification.

Do not put sensitive data or real customer payments into a publicly reachable test instance. Before a production release, verify HTTPS, trusted APP_ORIGIN, persistent storage permissions, restore procedures, email delivery, Stripe Connect webhook configuration and tenant isolation with the actual deployment.

The API uses password hashing, HTTP-only sessions, tenant-scoped queries, optimistic draft revisions, server-side pricing and immutable order/configuration snapshots. Published embedding domains must be explicitly allowed. These controls reduce risks but do not replace operational review.

Report vulnerabilities through GitHub private vulnerability reporting: https://github.com/Josusanz/yenze-studio/security/advisories/new. Do not post exploit details, customer data or credentials in public issues. No response-time SLA is offered.

Only use external AI generation after explicitly enabling approved organizations and reviewing provider cost/data terms. Stripe keys, webhook secrets, Resend keys and Meshy keys are server-side configuration, never browser variables.
