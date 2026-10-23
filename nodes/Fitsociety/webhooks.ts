import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { IDataObject, IWebhookFunctions } from 'n8n-workflow';
import catalog from './webhook-events.json';

export const webhookEvents = catalog;
const supportedEvents = new Set(webhookEvents.map(({ event }) => event));

export function deriveSigningKey(clientSecret: string, webhookId: string): string {
	if (!clientSecret || !webhookId)
		throw new Error(
			'A client secret and stable webhook ID are required. Save the workflow and reactivate the trigger.',
		);
	return createHmac('sha256', clientSecret)
		.update(`fitsociety:n8n:webhook:v1:${webhookId}`)
		.digest('hex');
}

export function signingKeyHash(key: string): string {
	return createHash('sha256').update(key).digest('hex');
}

export function selectedEvents(value: unknown): string[] {
	if (
		!Array.isArray(value) ||
		!value.length ||
		value.some((event) => typeof event !== 'string' || !supportedEvents.has(event))
	) {
		throw new Error('Select at least one supported FITsociety event.');
	}
	return [...new Set(value as string[])].sort();
}

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
	const object = value as Record<string, unknown>;
	return `{${Object.keys(object)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
		.join(',')}}`;
}

function header(headers: ReturnType<IWebhookFunctions['getHeaderData']>, name: string): string {
	const value = headers[name];
	if (typeof value !== 'string' || !value || value !== value.trim())
		throw new Error('Missing or malformed webhook headers.');
	return value;
}

function isObject(value: unknown): value is IDataObject {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function verifyWebhook(input: {
	rawBody: unknown;
	headers: ReturnType<IWebhookFunctions['getHeaderData']>;
	signingKey: string;
	companyId: string;
	events: string[];
	now?: number;
}): IDataObject {
	const { rawBody, headers } = input;
	const encoding = headers['content-encoding'];
	if (encoding !== undefined && encoding !== 'identity')
		throw new Error('Unsupported webhook content encoding.');
	if (!Buffer.isBuffer(rawBody) || rawBody.length === 0)
		throw new Error('The original webhook body bytes are required.');
	const bodyText = rawBody.toString('utf8');
	if (!Buffer.from(bodyText, 'utf8').equals(rawBody))
		throw new Error('Malformed webhook UTF-8 body.');
	const payload: unknown = JSON.parse(bodyText);
	if (
		!isObject(payload) ||
		typeof payload.id !== 'string' ||
		!/^[A-Za-z0-9_-]{1,200}$/.test(payload.id) ||
		typeof payload.companyId !== 'string' ||
		!payload.companyId ||
		typeof payload.type !== 'string' ||
		!supportedEvents.has(payload.type) ||
		typeof payload.occurredAt !== 'string' ||
		!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(payload.occurredAt) ||
		!Number.isFinite(Date.parse(payload.occurredAt)) ||
		!isObject(payload.data)
	) {
		throw new Error('Malformed webhook event envelope.');
	}
	const timestamp = header(headers, 'x-fitsociety-webhook-timestamp');
	const deliveryId = header(headers, 'x-fitsociety-webhook-delivery');
	const eventType = header(headers, 'x-fitsociety-webhook-event');
	const signature = header(headers, 'x-fitsociety-webhook-signature');
	if (
		!/^[1-9]\d{0,12}$/.test(timestamp) ||
		Math.abs((input.now ?? Math.floor(Date.now() / 1000)) - Number(timestamp)) > 300
	) {
		throw new Error('Webhook timestamp is malformed or outside the five-minute window.');
	}
	if (!/^[A-Za-z0-9_-]{1,200}$/.test(deliveryId) || !/^v1=[a-f0-9]{64}$/.test(signature))
		throw new Error('Malformed webhook signature or delivery header.');
	const expected = createHmac('sha256', input.signingKey)
		.update([timestamp, deliveryId, payload.id, canonicalJson(payload)].join('.'))
		.digest();
	if (!timingSafeEqual(expected, Buffer.from(signature.slice(3), 'hex')))
		throw new Error('Webhook signature verification failed.');
	if (payload.companyId !== input.companyId)
		throw new Error('Webhook company does not match these credentials.');
	if (payload.type !== eventType || !input.events.includes(payload.type))
		throw new Error('Webhook event is not selected or does not match its header.');
	return payload;
}
