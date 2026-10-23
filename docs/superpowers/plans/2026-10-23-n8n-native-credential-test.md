# Native credential test implementation plan

> Execute this small release-readiness change inline using the existing native demo runtime.

**Goal:** Demonstrate a real successful connection test in the credential editor required by the Creator Portal video instructions.

**Architecture:** Add a declarative credential test against the configured Public API `/me` endpoint. Keep native OAuth2 client credentials, provider/company binding and the existing read-only platform scope. Do not add model providers or runtime dependencies.

**Spec:** The manual-review video requirements shown in the n8n Creator Portal; see `docs/cloud-submission.md`.

## Verification and delivery

- [x] Reproduce the missing test using the native `/rest/credentials/test` endpoint with the approved demo credential: it incorrectly reports that the OAuth2 credential is not connected even though a real action succeeds.
- [x] Add `ICredentialTestRequest` to `credentials/FitsocietyOAuth2Api.credentials.ts`, using authenticated GET `/me`, a bounded timeout and disabled redirects.
- [x] Verify success in the real n8n credential tester and rejection of an intentionally invalid secret. Check that the response contains no secrets. A wrong company is also rejected.
- [x] Run the full package tests (51/51), build, lint and backend event contract check (56/56 events). Fresh source review found no actionable issues and reran the 9 connection tests successfully.
- [ ] Publish a patch release with provenance, rescan the public package and use that same version for the review video.
- [ ] Record installation, new credentials and successful test, ordinary read actions and an actual Codex MCP tool call in one continuous video of at most five minutes.
- [ ] Upload the video, verify the manual-review state and revoke the temporary production demo grant after recording.

The principal risks are a false positive for bad credentials, token/company binding bypass, redirect credential leakage, an incorrect API-base expression and accidental disclosure of non-demo data. Native positive/negative checks, the existing binding tests and a preselected synthetic client cover these paths.
