import assert from 'node:assert/strict';
import test from 'node:test';
const actions = await import('../dist/nodes/Fitsociety/operations.js').catch(() => ({}));
const fields = await import('../dist/nodes/Fitsociety/fields.js').catch(() => ({}));

test('action request builder is available', () =>
	assert.equal(typeof actions.buildOperation, 'function'));
test('client creation never sends an invitation implicitly', () => {
	assert.deepEqual(
		actions.buildOperation('client', 'create', {
			firstName: 'Alex',
			email: 'alex@example.com',
			additionalFields: { language: 'nl' },
		}),
		{
			method: 'POST',
			path: '/clients',
			body: { firstName: 'Alex', email: 'alex@example.com', language: 'nl', inviteByEmail: false },
			output: 'client',
		},
	);
});
test('client update omits unmapped inputs and rejects empty updates', () => {
	assert.equal(
		actions.buildOperation('client', 'update', {
			clientId: 'client/1',
			updateFields: { phoneNumber: '+31000000000' },
		}).path,
		'/clients/client%2F1',
	);
	assert.throws(
		() => actions.buildOperation('client', 'update', { clientId: 'c', updateFields: {} }),
		/at least one/i,
	);
});
test('organization actions use additive tag contracts', () => {
	assert.deepEqual(actions.buildOperation('tag', 'add', { clientId: 'c', tagIds: ['t'] }).body, {
		assignTagIds: ['t'],
	});
	assert.deepEqual(actions.buildOperation('tag', 'remove', { clientId: 'c', tagIds: ['t'] }).body, {
		removeTagIds: ['t'],
	});
	assert.deepEqual(
		actions.buildOperation('coach', 'assign', { clientId: 'c', coachId: 'coach' }).body,
		{ assignedCoach: 'coach' },
	);
	assert.throws(
		() => actions.buildOperation('tag', 'add', { clientId: 'c', tagIds: [] }),
		/at least one/i,
	);
});
test('booking occurrence dates are normalized to UTC and false notifications survive', () => {
	const create = actions.buildOperation('booking', 'create', {
		clientId: 'c',
		calendarEventId: 'e',
		bookingOptions: { instanceDate: '2026-10-23T10:00:00+02:00' },
	});
	assert.deepEqual(create.body, {
		clientId: 'c',
		calendarEventId: 'e',
		instanceDate: '2026-10-23T08:00:00.000Z',
		paymentMethod: 'product',
	});
	const cancel = actions.buildOperation('booking', 'cancel', {
		bookingId: 'b',
		cancelOptions: { notifyClient: false, notifyCoach: false },
	});
	assert.deepEqual(cancel.body, {
		financialAction: 'followPolicy',
		notifyClient: false,
		notifyCoach: false,
	});
	assert.throws(() => actions.utcDateTime('2026-02-30T10:00:00Z'), /valid/i);
	assert.throws(() => actions.utcDateTime('2026-10-23T10:00:00'), /offset/i);
});
test('bookings and calendar lists require bounded valid date ranges', () => {
	const result = actions.buildOperation('booking', 'search', {
		dateFrom: '2026-10-23T10:00:00+02:00',
		dateTo: '2026-10-24T10:00:00+02:00',
		filters: { clientId: 'c' },
	});
	assert.equal(result.qs.dateFrom, '2026-10-23T08:00:00.000Z');
	assert.equal(result.collection, 'bookings');
	assert.throws(
		() =>
			actions.buildOperation('calendar', 'list', {
				dateFrom: '2026-01-01T00:00:00Z',
				dateTo: '2026-12-31T00:00:00Z',
			}),
		/92/,
	);
});
test('check-up scheduling validates weekly and monthly settings', () => {
	assert.deepEqual(
		actions.buildOperation('form', 'scheduleCheckup', {
			clientId: 'c',
			formId: 'f',
			scheduleType: 'Weekly',
			weeklyOn: 'Monday',
		}).body,
		{ formId: 'f', schedule: { type: 'Weekly', weeklyOn: 'Monday' } },
	);
	assert.throws(
		() =>
			actions.buildOperation('form', 'scheduleCheckup', {
				clientId: 'c',
				formId: 'f',
				scheduleType: 'Weekly',
			}),
		/day/i,
	);
});
const definitions = [
	{ key: 'flag', type: 'checkbox', label: { en: 'Flag' } },
	{ key: 'count', type: 'number' },
	{ key: 'day', type: 'date' },
	{ key: 'size', type: 'select', options: [{ value: 'm', label: { en: 'Medium' } }] },
	{ key: 'notes', type: 'text' },
	{ key: 'system', type: 'number', readOnly: true },
];
test('custom fields preserve false, zero, canonical dates and explicit empty strings', () => {
	const result = actions.buildOperation(
		'customField',
		'update',
		{
			clientId: 'c',
			customFields: {
				value: { flag: false, count: '0,0', day: '2026-10-23', size: 'm', notes: '' },
			},
		},
		definitions,
	);
	assert.deepEqual(result.body.customFieldValues, [
		{ key: 'flag', value: false },
		{ key: 'count', value: 0 },
		{ key: 'day', value: '2026-10-23' },
		{ key: 'size', value: 'm' },
		{ key: 'notes', value: '' },
	]);
	assert.throws(
		() =>
			actions.buildOperation(
				'customField',
				'update',
				{ clientId: 'c', customFields: { value: { system: 1 } } },
				definitions,
			),
		/editable/i,
	);
	assert.throws(
		() =>
			actions.buildOperation(
				'customField',
				'update',
				{ clientId: 'c', customFields: { value: { day: '2026-02-30' } } },
				definitions,
			),
		/calendar/i,
	);
	assert.throws(
		() =>
			actions.buildOperation(
				'customField',
				'update',
				{ clientId: 'c', customFields: { value: { size: 'XL' } } },
				definitions,
			),
		/configured/i,
	);
});
test('dynamic schema maps number and checkbox types and excludes system fields', () => {
	const result = fields.customFieldSchema(definitions);
	assert.equal(result.fields.find((f) => f.id === 'flag').type, 'boolean');
	assert.equal(result.fields.find((f) => f.id === 'count').type, 'number');
	assert.equal(
		result.fields.some((f) => f.id === 'system'),
		false,
	);
	assert.deepEqual(result.fields.find((f) => f.id === 'size').options, [
		{ name: 'Medium', value: 'm' },
	]);
});
test('resource list operations select actual backend collection names', () => {
	for (const [resource, collection] of [
		['client', 'data'],
		['tag', 'data'],
		['coach', 'data'],
		['form', 'forms'],
		['customField', 'customFields'],
	]) {
		assert.equal(
			actions.buildOperation(resource, resource === 'client' ? 'search' : 'list', {}).collection,
			collection,
		);
	}
});
test('date range observes the API inclusive 92-day bound', () => {
	assert.throws(
		() =>
			actions.buildOperation('calendar', 'list', {
				dateFrom: '2026-01-01T00:00:00Z',
				dateTo: '2026-04-03T00:00:00Z',
			}),
		/92/,
	);
});
const { Fitsociety } = await import('../dist/nodes/Fitsociety/Fitsociety.node.js');
function execution(
	parameters,
	responses,
	{ itemCount = 1, continueOnFail = false, executionId = 'execution-1' } = {},
) {
	const calls = [];
	const context = {
		getInputData: () => Array.from({ length: itemCount }, () => ({ json: {} })),
		getNodeParameter: (name, index, fallback) =>
			(Array.isArray(parameters) ? parameters[index] : parameters)[name] ?? fallback,
		getExecutionId: () => executionId,
		getNode: () => ({
			id: 'action-node',
			name: 'FITsociety',
			type: 'fitsociety',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		continueOnFail: () => continueOnFail,
		getCredentials: async () => ({ apiBaseUrl: 'https://api.example.test/public/v1' }),
		helpers: {
			httpRequestWithAuthentication: async (credential, request) => {
				calls.push({ credential, ...request });
				const response =
					typeof responses === 'function' ? responses(request, calls.length) : responses.shift();
				return { statusCode: 200, body: { data: response } };
			},
		},
	};
	return { calls, run: () => Fitsociety.prototype.execute.call(context) };
}
test('native execution keeps mutation metadata and sends stable write keys', async () => {
	const parameters = {
		resource: 'client',
		operation: 'create',
		firstName: 'Alex',
		email: 'alex@example.com',
		businessKey: 'source-event-1',
	};
	const first = execution(parameters, [
		{ client: { clientId: 'c' }, existingAccount: false, notificationEmailSent: false },
	]);
	const [rows] = await first.run();
	assert.equal(rows[0].json.notificationEmailSent, false);
	assert.equal(first.calls[0].credential, 'fitsocietyOAuth2Api');
	assert.match(first.calls[0].headers['Idempotency-Key'], /^n8n:/);
	const retry = execution(parameters, [{ client: { clientId: 'c' } }], {
		executionId: 'execution-2',
	});
	await retry.run();
	assert.equal(
		first.calls[0].headers['Idempotency-Key'],
		retry.calls[0].headers['Idempotency-Key'],
	);
});
test('native custom update reloads definitions and preserves typed values', async () => {
	const run = execution(
		{
			resource: 'customField',
			operation: 'update',
			clientId: 'c',
			customFields: { value: { flag: false, count: 0 } },
		},
		[
			{ customFields: definitions },
			{
				clientId: 'c',
				customFields: [
					{ key: 'flag', value: false },
					{ key: 'count', value: 0 },
				],
			},
		],
	);
	const [rows] = await run.run();
	assert.equal(run.calls.length, 2);
	assert.equal(run.calls[0].method, 'GET');
	assert.deepEqual(run.calls[1].body, {
		customFieldValues: [
			{ key: 'flag', value: false },
			{ key: 'count', value: 0 },
		],
	});
	assert.equal(rows[0].json.customFields[0].value, false);
});
test('native list pagination respects an API-clamped page size and binds output items', async () => {
	const responses = [
		{
			bookings: Array.from({ length: 50 }, (_, i) => ({ bookingId: `b${i}` })),
			page: 1,
			limit: 50,
			total: 75,
			totalPages: 2,
			hasNextPage: true,
		},
		{
			bookings: Array.from({ length: 25 }, (_, i) => ({ bookingId: `b${50 + i}` })),
			page: 2,
			limit: 50,
			total: 75,
			totalPages: 2,
			hasNextPage: false,
		},
	];
	const run = execution(
		{
			resource: 'booking',
			operation: 'search',
			dateFrom: '2026-10-23T00:00:00Z',
			dateTo: '2026-10-24T00:00:00Z',
			returnAll: true,
			maxItems: 1000,
		},
		responses,
	);
	const [rows] = await run.run();
	assert.equal(rows.length, 75);
	assert.equal(run.calls.length, 2);
	assert.deepEqual(rows[74].pairedItem, { item: 0 });
});
test('native per-item execution preserves errors with continueOnFail', async () => {
	const run = execution(
		[
			{ resource: 'client', operation: 'update', clientId: 'c', updateFields: {} },
			{ resource: 'client', operation: 'get', clientId: 'c' },
		],
		[{ client: { clientId: 'c' } }],
		{ itemCount: 2, continueOnFail: true },
	);
	const [rows] = await run.run();
	assert.match(rows[0].json.error, /at least one/);
	assert.equal(rows[1].json.clientId, 'c');
	assert.deepEqual(rows[1].pairedItem, { item: 1 });
});
test('native methods expose dynamic tag, coach, form and custom field selections', async () => {
	const node = new Fitsociety();
	const context = {
		getNode: () => ({}),
		getCredentials: async () => ({ apiBaseUrl: 'https://api.example.test/public/v1' }),
		helpers: {
			httpRequestWithAuthentication: async () => ({
				statusCode: 200,
				body: { data: { customFields: definitions } },
			}),
		},
	};
	const schema = await node.methods.resourceMapping.getCustomFields.call(context);
	assert.equal(schema.fields.find((f) => f.id === 'flag').type, 'boolean');
	assert.equal(typeof node.methods.loadOptions.getTags, 'function');
	assert.equal(typeof node.methods.loadOptions.getCoaches, 'function');
	assert.equal(typeof node.methods.loadOptions.getCheckupForms, 'function');
});
test('client filters expose persisted relationship states and all statuses omits a filter', () => {
	const filters = fields.actionProperties.find(
		(p) => p.name === 'filters' && p.displayOptions.show.resource.includes('client'),
	);
	const status = filters.options.find((p) => p.name === 'status');
	assert.equal(
		status.options.some((p) => p.value === 'prospect' || p.value === 'all'),
		false,
	);
	assert.equal(
		status.options.some((p) => p.value === 'trial'),
		true,
	);
	assert.equal(
		status.options.some((p) => p.value === ''),
		true,
	);
	assert.deepEqual(actions.buildOperation('client', 'search', { filters: { status: '' } }).qs, {});
});
test('invitation and form assignments use dedicated public endpoints', () => {
	assert.deepEqual(actions.buildOperation('client', 'invite', { clientId: 'c' }), {
		method: 'POST',
		path: '/clients/c/invite',
		body: {},
		output: 'invite',
	});
	assert.deepEqual(actions.buildOperation('form', 'assignIntake', { clientId: 'c', formId: 'f' }), {
		method: 'POST',
		path: '/clients/c/intake-assignments',
		body: { formId: 'f' },
		output: 'assignment',
	});
	assert.deepEqual(actions.buildOperation('customField', 'get', { clientId: 'c' }), {
		method: 'GET',
		path: '/clients/c/custom-fields',
	});
	assert.equal(actions.buildOperation('booking', 'get', { bookingId: 'b' }).path, '/bookings/b');
});
test('attendance uses the API attendance vocabulary and retains supplied remarks', () => {
	assert.deepEqual(
		actions.buildOperation('booking', 'updateAttendance', {
			bookingId: 'b',
			attendanceStatus: 'noshow',
			attendanceOptions: { noShowReason: 'Late cancellation', remarks: 'Called client' },
		}).body,
		{ status: 'noshow', noShowReason: 'Late cancellation', remarks: 'Called client' },
	);
	assert.throws(
		() =>
			actions.buildOperation('booking', 'updateAttendance', {
				bookingId: 'b',
				attendanceStatus: 'cancelled',
			}),
		/attendance/,
	);
});
test('custom field null clears a value while range, date and choice validation stays typed', () => {
	assert.deepEqual(
		actions.buildOperation(
			'customField',
			'update',
			{ clientId: 'c', customFields: { value: { flag: null } } },
			definitions,
		).body,
		{ customFieldValues: [{ key: 'flag', value: null }] },
	);
	assert.throws(
		() =>
			actions.customFieldValue({ key: 'n', type: 'number', validation: { min: 0, max: 10 } }, '11'),
		/range/,
	);
	assert.throws(() => actions.customFieldValue({ key: 'n', type: 'number' }, '1.250,5'), /number/);
	assert.throws(
		() => actions.customFieldValue({ key: 'b', type: 'checkbox' }, 'yes'),
		/true or false/,
	);
});
