import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Workflow } = require('n8n-workflow');

test('native credential expression resolution derives the token URL from company configuration', () => {
	const workflow = new Workflow({
		id: 'synthetic-credential-expression',
		name: 'Credential expression',
		nodes: [],
		connections: {},
		active: false,
		nodeTypes: {
			getByNameAndVersion() {
				throw new Error('Unexpected node lookup');
			},
		},
	});
	const node = {
		id: 'expression',
		name: 'Credential',
		type: 'n8n-nodes-base.noOp',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	};
	const tokenProperty = new FitsocietyOAuth2Api().properties.find(
		(property) => property.name === 'accessTokenUrl',
	);
	for (const suffix of ['', '/']) {
		const data = {
			apiBaseUrl: `https://api.example.test/public/v1${suffix}`,
			accessTokenUrl: tokenProperty.default,
		};
		// Same self-context argument used by n8n CredentialsHelper.resolveCredentialExpressions.
		const result = workflow.expression.getComplexParameterValue(
			node,
			data,
			'internal',
			{},
			undefined,
			undefined,
			data,
		);
		assert.equal(result.accessTokenUrl, 'https://api.example.test/public/v1/oauth/token');
	}
});
const {
	FitsocietyOAuth2Api,
	validateConnection,
} = require('../dist/credentials/FitsocietyOAuth2Api.credentials.js');
const {
	apiRequest,
	apiRequestAll,
	buildIdempotencyKey,
	normalizeApiBaseUrl,
} = require('../dist/nodes/Fitsociety/api.js');
const credential = {
	apiBaseUrl: 'https://api.example.test/public/v1',
	companyId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
	clientId: 'company-client',
	clientSecret: 'test-only-secret',
	oauthTokenData: {
		integration_key: 'n8n',
		client_id: 'company-client',
		company_id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
	},
};
const context = (respond) => ({
	getCredentials: async () => credential,
	getNode: () => ({
		name: 'FITsociety',
		type: 'fitsociety',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
	helpers: { httpRequestWithAuthentication: respond },
});

test('company/provider/client binding rejects reuse of another connection', async () => {
	assert.doesNotThrow(() => validateConnection(credential));
	for (const field of ['integration_key', 'client_id', 'company_id'])
		assert.throws(
			() =>
				validateConnection({
					...credential,
					oauthTokenData: { ...credential.oauthTokenData, [field]: 'another' },
				}),
			/connection/i,
		);
	assert.throws(
		() => validateConnection({ ...credential, oauthTokenData: undefined }),
		/connection/i,
	);
	assert.deepEqual(await new FitsocietyOAuth2Api().preAuthentication(credential), {});
});
test('base URL is HTTPS, configured, and rooted at the public API', () => {
	assert.equal(normalizeApiBaseUrl('https://api.example.test/public/v1/'), credential.apiBaseUrl);
	for (const url of [
		'http://api.example.test/public/v1',
		'https://user:secret@api.example.test/public/v1',
		'https://api.example.test/public/v1?key=secret',
		'https://api.example.test/other',
		'',
	])
		assert.throws(() => normalizeApiBaseUrl(url));
});
test('HTTP helper preserves false and zero and disallows redirects', async () => {
	const calls = [];
	const c = context(async (name, request) => {
		calls.push({ name, request });
		return { statusCode: 200, body: { data: { value: false, amount: 0 } } };
	});
	assert.deepEqual(
		await apiRequest.call(c, 'PATCH', '/clients/id', {
			body: { value: false, amount: 0 },
			idempotencyKey: 'stable-key',
		}),
		{ value: false, amount: 0 },
	);
	assert.equal(calls[0].name, 'fitsocietyOAuth2Api');
	assert.equal(calls[0].request.disableFollowRedirect, true);
	assert.equal(calls[0].request.headers['Idempotency-Key'], 'stable-key');
	assert.deepEqual(calls[0].request.body, { value: false, amount: 0 });
});

test('HTTP contract leaves expired-token 401 visible to the native OAuth2 renewal layer', async () => {
	const c = context(async (_name, request) => {
		// n8n renews OAuth tokens when its HTTP transport throws on 401.
		// Suppressing every HTTP error skips renewal, even though manual API error mapping works.
		assert.deepEqual(request.ignoreHttpStatusErrors, { ignore: true, except: [401] });
		return { statusCode: 200, body: { data: { connected: true } } };
	});
	assert.deepEqual(await apiRequest.call(c, 'GET', '/clients'), { connected: true });
});
test('writes require keys, paths cannot escape the API base, and errors do not expose secret response details', async () => {
	const c = context(async () => ({
		statusCode: 403,
		body: { error: { key: 'permission.denied', message: 'test-only-secret' } },
	}));
	await assert.rejects(apiRequest.call(c, 'POST', '/clients', {}), /idempotency/i);
	await assert.rejects(apiRequest.call(c, 'GET', '//evil.example/path'), /path/i);
	await assert.rejects(apiRequest.call(c, 'GET', '/../../private'), /path/i);
	await assert.rejects(
		apiRequest.call(c, 'GET', '/clients'),
		(e) => /access|permission/i.test(e.message) && !e.message.includes('test-only-secret'),
	);
});
test('page pagination supports data collection and respects a bounded item limit', async () => {
	const calls = [];
	const c = context(async (_name, request) => {
		calls.push(request);
		const page = request.qs.page;
		return {
			statusCode: 200,
			body: {
				data: {
					data: page === 1 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }],
					page,
					limit: 2,
					total: 3,
					totalPages: 2,
					hasNextPage: page === 1,
				},
			},
		};
	});
	const result = await apiRequestAll.call(c, 'GET', '/clients', {
		collection: 'data',
		qs: { limit: 2 },
		maxItems: 3,
	});
	assert.deepEqual(result, [{ id: 1 }, { id: 2 }, { id: 3 }]);
	assert.equal(calls[1].qs.page, 2);
});
test('unpaginated catalogs stop after one response, malformed envelopes fail', async () => {
	let count = 0;
	const c = context(async () => {
		count++;
		return { statusCode: 200, body: { data: { customFields: [{ key: 'height' }] } } };
	});
	assert.equal(
		(await apiRequestAll.call(c, 'GET', '/client-custom-fields', { collection: 'customFields' }))
			.length,
		1,
	);
	assert.equal(count, 1);
	await assert.rejects(
		apiRequest.call(
			context(async () => ({ statusCode: 200, body: {} })),
			'GET',
			'/clients',
		),
		/response/i,
	);
});
test('retry keys remain stable and intentional nodes/items do not collide', () => {
	const key = buildIdempotencyKey('run-1', 'node-1', 0, 'create');
	assert.equal(key, buildIdempotencyKey('run-1', 'node-1', 0, 'create'));
	assert.notEqual(key, buildIdempotencyKey('run-1', 'node-2', 0, 'create'));
	assert.notEqual(key, buildIdempotencyKey('run-1', 'node-1', 1, 'create'));
	assert.equal(
		buildIdempotencyKey('run-1', 'node-1', 0, 'create', 'event-123'),
		buildIdempotencyKey('run-2', 'node-1', 0, 'create', 'event-123'),
	);
});
