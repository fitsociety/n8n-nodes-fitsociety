# Release preparation

This package is local and unpublished. Publication is a separate authorized operation. User-owned backend merging and deployment precede real connection setup.

## Self-hosted pilot and release

1. Review the private backend provisioning guide, configure a distinct restricted n8n provider, then provision only explicitly approved company grants. Use least-privilege scopes and attributed administrator/sensitive-data consent.
2. Test the tarball in a disposable n8n 2.44.6+ instance. Real-company testing requires separate approval. Exercise token renewal, activation/deactivation/reactivation, secret rotation, event selection and duplicate-delivery handling.
3. Choose the actual public repository and npm owner after authorization, and add the matching repository URL to package metadata. No placeholder repository is presented as a real service.
4. Configure npm trusted publishing. Review and rename `.github/workflows/publish.yml.example` to enable manual provenance publishing. Configure authorized reviewers on the `npm-release` environment first.
5. Run tests, build, lint, event drift, package scan and tarball inspection. Confirm npm name availability/ownership. Publish the reviewed version through GitHub Actions with provenance.
6. Install on the pilot instance before broadening provider availability.

## Cloud verification

Unverified packages cannot be installed on n8n Cloud. Submit after public source/package publication and provenance configuration. Follow the current [n8n verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines.md) and Creator Portal requirements: matching public repository/maintainer, MIT license, English copy/docs, one service, TypeScript, no external runtime dependencies and no runtime environment/filesystem access. Native node:crypto is used for signing.

Passing build/lint/tests/scan does not guarantee approval. Cloud owners/admins can install only after approval and when verified community nodes are enabled. This delivery claims no Cloud approval or public listing.

## Release safeguards

The release guard intentionally refuses publication until a real public repository is configured. The publication workflow remains disabled with its `.example` suffix. Inspect `npm pack --dry-run --json` and verify no credentials, runtime data, private backend source or workflow secrets ship. Workflow static data contains only a subscription ID. Delivery is at least once and downstream idempotency remains necessary.
