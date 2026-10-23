# n8n-nodes-fitsociety

Native FITsociety actions and signed webhook triggers for self-hosted n8n and subsequent n8n Cloud verification.

**Release:** 0.1.2. The package supports self-hosted n8n. n8n Cloud availability requires separate n8n verification and is not yet approved. Each company needs its own approved FITsociety n8n credentials; Zapier and Make credentials cannot be reused.

## Requirements and installation

The minimum supported and tested version is n8n **2.44.6**, with company-specific FITsociety n8n credentials. Older versions are unsupported; the package installer does not enforce this version floor. Triggers require a publicly reachable HTTPS webhook URL. Private/reserved addresses and callback redirects are rejected. Self-hosted reverse proxies must set the correct n8n public webhook URL.

```sh
npm ci
npm test
npm run lint
npm pack
```

For local self-hosted testing, install the resulting tarball into a dedicated custom extension directory and restart n8n. For example:

```sh
mkdir -p /path/to/test-instance/custom
cd /path/to/test-instance/custom
npm install /absolute/path/to/n8n-nodes-fitsociety-0.1.2.tgz
```

Set `N8N_CUSTOM_EXTENSIONS` to `/path/to/test-instance/custom/node_modules/n8n-nodes-fitsociety/dist` and restart the test instance. Install the same package on every worker in a distributed installation. Self-hosted owners can install `n8n-nodes-fitsociety` through Settings → Community nodes. Cloud owners/admins can install only after n8n verifies this package and verified community nodes are enabled.

## Credentials

Create a **FITsociety OAuth2 API** credential with the supplied API base URL ending in `/public/v1`, company ID, client ID and client secret. The credential uses OAuth2 client credentials, so no instance callback registration is needed. It validates that issued tokens match the n8n provider and configured client/company. n8n stores credentials encrypted.

Save the new credential and verify that the connection test succeeds. The test reads the connected company's API profile without changing any company or client records.

Initial credentials are provisioned by a FITsociety operator after company administrator approval, using the backend's dry-run-first `provisionN8nClient.js` and explicit least-privilege scopes. Credentials are currently supplied by FITsociety after company administrator approval. Health/private communication consent is required for the full trigger catalog. Reactivate trigger workflows after rotating credentials.

## Actions

| Resource     | Operations                                               |
| ------------ | -------------------------------------------------------- |
| Client       | Search, get, create, update, send invitation             |
| Tag          | Get many, add to client, remove from client              |
| Coach        | Get many, assign to client                               |
| Booking      | Search, get, create, cancel, update attendance           |
| Calendar     | Get many events                                          |
| Form         | Get many, assign intake, schedule check-up               |
| Custom field | Get definitions, get client values, update client values |

Custom fields discover the connected company's current writable definitions and preserve false, zero and empty text. Clear a value explicitly with null. Dates use YYYY-MM-DD; date-times require an explicit time-zone offset and are sent as UTC. Calendar/booking searches require a range of at most 92 inclusive days.

List operations have a bounded return-all mode (default maximum 1,000, configurable up to 10,000). Errors identify connection, permission, not-found, conflict and throttling problems without echoing provider secrets. Continue On Fail keeps input/output item pairing.

Every write sends an idempotency key identifying the execution, node, item and operation. For retries across separate executions, map a stable event ID into **Business Event Key**. Different intentional writes should use different nodes or distinct business keys. Keep item ordering stable when replaying batches. Backend idempotency retention is bounded; it is not a permanent deduplication ledger.

## Triggers

**FITsociety Trigger** offers all 56 business events in the included catalog. Select events, save and activate the workflow. Activation registers a grant-owned subscription; deactivation removes it. Reactivation reconciles selected events, callback URL and signing-key fingerprint.

The trigger verifies the canonical-JSON HMAC signature, timestamp, delivery/event IDs, selected event and signed company ID. It requires original body bytes and a five-minute timestamp window. The per-trigger signing key is derived from the encrypted credential and stable webhook ID. Only the subscription ID is stored in workflow static data; exported workflows contain no signing secret.

Delivery is **at least once**. Retries may create another execution. The signed envelope's `id` remains stable for the source event; use it for downstream deduplication and Business Event Keys. Timestamp verification limits replay age and does not guarantee exactly-once effects. Reverse proxies must preserve the webhook body.

## Development

```sh
npm test
npm run lint
npm run check:contracts -- /path/to/backend
```

The optional drift check compares the event snapshot against backend source, without importing private code at runtime. Tests and examples use synthetic data; no production database or credentials are needed. [Example workflows](examples/) contain no credential references. Programmatic actions support dependent custom-field schema validation and bounded multi-page aggregation. Published code has no external runtime dependencies or runtime filesystem/environment access.

See [release preparation](docs/release.md) for self-hosted publication and Cloud verification. MIT applies to this adapter; private FITsociety backend code is excluded.
