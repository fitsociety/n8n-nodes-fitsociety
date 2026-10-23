import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Development-only: the private backend is never imported by published nodes.
const backendRoot = process.argv[2];
if (!backendRoot) {
	console.error('Usage: npm run check:contracts -- /path/to/backend');
	process.exitCode = 1;
} else {
	const snapshot = JSON.parse(
		await readFile(new URL('../nodes/Fitsociety/webhook-events.json', import.meta.url), 'utf8'),
	);
	const registry = JSON.parse(
		await readFile(resolve(backendRoot, 'helpers/zapier/webhookEvents.json'), 'utf8'),
	);
	const publicEvents = registry.map(({ event, description }) => ({ event, description }));
	assert.deepEqual(
		snapshot,
		publicEvents,
		'Webhook catalog drift: review backend changes and refresh the public event snapshot',
	);
	assert.equal(
		new Set(snapshot.map(({ event }) => event)).size,
		snapshot.length,
		'Duplicate webhook events',
	);
	console.log(`Webhook event contract matches all ${snapshot.length} backend events.`);
}
