# Local validation — 2026-10-23

## Package

- Node 24.22.1, n8n 2.44.6, n8n-workflow 2.44.2, official stable node CLI 0.53.4.
- 51 tests passed; official CLI build and lint passed.
- The 56-event snapshot matches the backend catalog.
- Official community scanner local source and packed-code analyzers passed. The complete registry/provenance scan remains a publication-time check; this unpublished package has no npm attestation yet.
- npm tarball installation into a disposable directory succeeded. The actual n8n PackageDirectoryLoader loaded both native nodes and the OAuth2 credential from the installed tarball, including npm's currently resolved wildcard peer n8n-workflow 2.16.0. Runtime support remains n8n 2.44.6+; older host versions are unsupported.
- Tarball inspection found no environment files, runtime data, private backend source, obsolete credential files or absolute developer paths. Build cache and duplicate package metadata are excluded.
- No external runtime dependencies. Production dependency audit reports zero vulnerabilities. The pinned stable development CLI has upstream development-only advisories (including Handlebars); npm offers a newer beta toolchain. This delivery retains the tested stable toolchain and does not claim the complete development dependency tree is vulnerability-free.

## Native runtime and synthetic HTTPS API

A disposable real n8n 2.44.6 runtime loaded the compiled nodes through custom extensions. The API was a synthetic loopback HTTPS server with a temporary trusted CA, not production FITsociety.

- Native client-credentials acquisition succeeded; provider/client/company binding checks run before resource requests.
- Wrong-provider and wrong-company tokens were rejected before resource HTTP calls.
- Simulated expiration triggered native OAuth renewal (token issuance count increased from 3 to 4).
- A real signed HTTP delivery with deliberately unsorted, pretty JSON completed the trigger and a downstream NoOp. Values false, zero and UTF-8 survived unchanged.
- Invalid signature, wrong company and stale timestamp each returned constant HTTP401 and created no workflow execution.
- Only subscriptionId was present in workflow static data. Deactivation removed both remote mock subscription and native webhook registration.
- Services were stopped after verification; synthetic state remains outside this package.

Native testing exposed and repaired credential self-context expression resolution, OAuth401 renewal suppression and invalid-delivery HTTP handling. The package tests now cover these contracts.

## Release limits

No production API calls, real company credentials, deployment, push, npm publishing, public repository creation or Cloud submission occurred. The same code targets both environments, but Cloud installation still requires external verification and backend deployment/provisioning. The documented host-version floor is not enforced by n8n package installation metadata.
