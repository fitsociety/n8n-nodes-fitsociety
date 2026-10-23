# Release 0.1.0 — 2026-10-23

## Public package

- Published: [n8n-nodes-fitsociety@0.1.0](https://www.npmjs.com/package/n8n-nodes-fitsociety).
- Attested source: `cd2a3698dd40df2422954c024c0ed54274a323a1` in this public repository.
- [GitHub Actions publication](https://github.com/fitsociety/n8n-nodes-fitsociety/actions/runs/39997252562) completed; npm maintainer approval with 2FA completed.
- Registry SHA-1: `b89cc3b423d0391e59545275cd5e03ebb6b4c3a7`.
- The full official `@n8n/scan-community-package` scan against `n8n-nodes-fitsociety@0.1.0` exited successfully: provenance, fetched attested source, downloaded package and security analysis all passed.
- The temporary GitHub environment bootstrap secret was removed. Future releases require trusted publishing configuration or renewed release authentication.

## FITsociety availability

The backend API and worker were both verified Ready/Green on the release containing n8n support before activation. The n8n provider was then enabled as active/public, with manual setup and company approval required. No company credentials were created and other integration providers were unchanged.

At the final health check, the worker remained Ready/Green. A subsequent immutable API update was in progress; all three API instances were healthy and all 181 requests in the health sample returned 2xx, with no 5xx responses. This records the observed state, not completion of that subsequent rollout.

Self-hosted administrators can install `n8n-nodes-fitsociety` through Settings → Community nodes on supported n8n versions. Each company still needs approved, separately provisioned n8n credentials and explicit scopes. See the README for requirements and credential setup.

## n8n Cloud

The package has not been submitted for or granted n8n Cloud verification. npm publication and a successful scanner result do not grant Cloud availability. Creator Portal submission and external review remain separate steps.
