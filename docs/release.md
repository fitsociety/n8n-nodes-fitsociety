# Releases

The package source is public at https://github.com/fitsociety/n8n-nodes-fitsociety. Releases use the manually dispatched publish.yml GitHub Actions workflow, build/lint/tests and npm provenance. The workflow stages a reviewed version; npm requires the maintainer to complete 2FA approval before it becomes public. The initial authentication secret is temporary and removed after publication. Configure npm trusted publishing for subsequent releases once the package exists.

## Releasing

1. Review the changes and version/changelog. Run npm test, npm run lint, the event drift check and tarball inspection.
2. Dispatch the publication workflow from the reviewed repository revision. It installs the locked dependencies, tests, builds and stages the package with provenance.
3. Review the staged version and provenance, then approve with npm's required 2FA. Never place credentials in source or logs.
4. Confirm the public registry version and run the full official community-package scan.
5. Record the result and remove the temporary bootstrap secret. Prefer npm OIDC trusted publishing for ongoing releases.

## Cloud verification

An npm release can be installed on supported self-hosted instances. n8n Cloud requires separate Creator Portal verification. Follow the current n8n verification guidelines: matching public repository/maintainer, MIT license, English copy/docs, one service, TypeScript, no external runtime dependencies and no runtime environment/filesystem access. Passing tests and scans does not guarantee Cloud approval.

## Company access

The FITsociety provider must be enabled and the company must have approved n8n-specific credentials and explicit scopes. Credential provisioning requires an active company administrator and attributed sensitive-data consent for triggers. Publication does not grant access to company data or create credentials automatically.
