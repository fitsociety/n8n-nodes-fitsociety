# n8n Cloud verification submission

## Package details

- Package: `n8n-nodes-fitsociety`
- Version: `0.1.1`
- Review-video target: `0.1.2`, adding the native credential test required for the demonstration. Publish and verify it before recording.
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

- Full official community-package scanner against published 0.1.1: passed, including provenance, attested source and package analysis. The attested commit is `e057f677ee022364852224a40f0d55e9926bee23`.
- Version 0.1.1 was published through [GitHub Actions](https://github.com/fitsociety/n8n-nodes-fitsociety/actions/runs/40000143336) after build, all 51 tests, lint and release checks passed. The registry's `latest` tag and approved author email were verified. The temporary release authentication secret was removed.
- Official node CLI lint: passed.
- Backend event contract check: all 56 events matched.
- Build and all 51 tests: passed immediately before the initial submission attempt.
- The public package includes action and trigger nodes, English documentation and example workflows for a single service.
- No external runtime dependencies or runtime environment/filesystem access.
- Earlier native runtime and synthetic HTTPS checks are recorded in [local validation](validation-2026-10-23.md).

## Submission state

The owner completed email verification and the package was submitted through the Creator Portal on 2026-10-23. The portal displayed “Thank you for your submission” and started its automated review. This is a submitted review request, not n8n Cloud approval.

The automated review subsequently completed successfully. The manual review is **AWAITING VIDEO**. The portal requires a continuous video of at most five minutes showing installation of the submitted npm version, a new workflow and node, new credentials and a successful connection test, common actions and one example of the app node used as an AI tool. Uploading that video is still required before claiming that the manual review is underway.

A new local n8n 2.44.6 instance has run real read-only actions against an explicitly approved demo-company grant with only `platform:read` and `clients:read`. Its selected client is an existing fictitious integration-test record. The existing Codex agent has also listed and called the native FITsociety AI tool through n8n's MCP Server Trigger, returning that same fictitious client. These rehearsals are not the continuous review video. No OpenAI API key was created: local key storage was not approved, and the MCP demonstration uses the existing agent.

The native credential-test addition was verified in real n8n: valid credentials passed, an invalid secret failed, a wrong company failed and no secret appeared in the returned error. The existing 51 package tests passed.

The submission form requests the npm package URL and declarations of authorship and official representation. Ownership verification uses a token sent to the package author email. Passing automated checks does not guarantee acceptance; manual review and approval remain controlled by n8n.

The initial 0.1.0 attempt reached ownership verification but used a GitHub noreply author address. Version 0.1.1 corrected it to the explicitly approved business email before the successful submission.
