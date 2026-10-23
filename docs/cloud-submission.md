# n8n Cloud verification submission

## Package details

- Package: `n8n-nodes-fitsociety`
- Version: `0.1.1`
- Display name: `FITsociety`
- npm: https://www.npmjs.com/package/n8n-nodes-fitsociety
- Source: https://github.com/fitsociety/n8n-nodes-fitsociety
- Documentation: https://github.com/fitsociety/n8n-nodes-fitsociety#readme
- License: MIT
- npm maintainer: `mswessels`
- Author email: `info@fitsociety.nl` (approved business contact for public metadata and ownership verification).
- Use the version-specific npm provenance statement to identify the attested source and publication workflow.

## Suggested description

Connect FITsociety coaching and studio management to n8n. Manage clients, tags, coach assignments, bookings, attendance, forms and custom fields through 22 actions, and start workflows from 56 signed business events.

## Authentication and reviewer notes

The package uses n8n's native OAuth2 client-credentials handling. Each company requires separate n8n-specific credentials provisioned by FITsociety after company administrator approval. Credentials from other integration providers cannot be reused. The credential checks the token's provider, client and company binding before resource requests.

Triggers create and remove grant-owned webhook subscriptions and verify signed delivery envelopes. Public HTTPS callback addresses are required. Trigger subscriptions and data access remain restricted by the approved company scopes and sensitive-data consent.

Any reviewer test access must be provisioned separately for a synthetic demo company with explicit approval and minimal required scopes. Never put client secrets, company data or authentication tokens in this document, public source or the submission description.

## Verification evidence — 2026-10-23

- Full official community-package scanner against published 0.1.0: passed, including provenance, attested source and package analysis. Repeat against 0.1.1 after publication.
- Official node CLI lint: passed.
- Backend event contract check: all 56 events matched.
- Build and all 51 tests: passed immediately before the initial submission attempt.
- The public package includes action and trigger nodes, English documentation and example workflows for a single service.
- No external runtime dependencies or runtime environment/filesystem access.
- Earlier native runtime and synthetic HTTPS checks are recorded in [local validation](validation-2026-10-23.md).

## Submission state

The Creator Portal is signed in. The initial submission attempt for 0.1.0 reached ownership verification, but its token was sent to the package's GitHub noreply author address. Version 0.1.1 replaces that address with the explicitly approved business email. Complete publication and retry ownership verification before claiming the review request has been submitted.

The submission form requests the npm package URL and declarations of authorship and official representation. The next step verifies ownership through a token sent to the package author email. No review request has been submitted and no n8n Cloud approval has been granted. Passing automated checks does not guarantee acceptance.
