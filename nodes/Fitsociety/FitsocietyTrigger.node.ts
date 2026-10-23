import { randomUUID } from 'node:crypto';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { apiRequest } from './api';
import {
	deriveSigningKey,
	selectedEvents,
	signingKeyHash,
	verifyWebhook,
	webhookEvents,
} from './webhooks';

function isNotFound(error: unknown): boolean {
	const value = error as { statusCode?: number; httpCode?: string; response?: { status?: number } };
	return value?.statusCode === 404 || value?.httpCode === '404' || value?.response?.status === 404;
}

async function configuration(context: IHookFunctions) {
	const credentials = await context.getCredentials('fitsocietyOAuth2Api');
	const url = context.getNodeWebhookUrl('default');
	if (!url || !url.startsWith('https://'))
		throw new NodeOperationError(
			context.getNode(),
			'Configure a public HTTPS n8n webhook URL before activating the trigger.',
		);
	return {
		url,
		events: selectedEvents(context.getNodeParameter('events')),
		signingSecret: deriveSigningKey(
			String(credentials.clientSecret || ''),
			context.getNode().webhookId || '',
		),
	};
}

function matches(
	record: IDataObject,
	config: { url: string; events: string[]; signingSecret: string },
): boolean {
	return (
		record.status === 'active' &&
		record.url === config.url &&
		record.signingKeyHash === signingKeyHash(config.signingSecret) &&
		Array.isArray(record.events) &&
		JSON.stringify([...new Set(record.events)].sort()) === JSON.stringify(config.events)
	);
}

export class FitsocietyTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FITsociety Trigger',
		name: 'fitsocietyTrigger',
		icon: { light: 'file:fitsociety.svg', dark: 'file:fitsociety.svg' },
		subtitle: '={{$parameter["events"].join(", ")}}',
		group: ['trigger'],
		version: 1,
		description: 'Start a workflow from signed FITsociety business events',
		defaults: { name: 'FITsociety Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'fitsocietyOAuth2Api', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
				rawBody: true,
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				options: webhookEvents
					.map(({ event, description }) => ({
						name: event
							.split(/[._]/)
							.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
							.join(' '),
						value: event,
						description,
					}))
					.sort((a, b) => a.name.localeCompare(b.name)),
				default: ['client.created'],
				description:
					'Events that start this workflow. Deliveries may repeat; use the signed event ID for downstream deduplication. Reactivate after changing events or rotating credentials.',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const config = await configuration(this);
				const state = this.getWorkflowStaticData('node');
				if (typeof state.subscriptionId === 'string') {
					try {
						const record = await apiRequest.call(
							this,
							'GET',
							`/n8n/webhooks/${encodeURIComponent(state.subscriptionId)}`,
						);
						return matches(record, config);
					} catch (error) {
						if (!isNotFound(error)) throw new NodeOperationError(this.getNode(), error as Error);
					}
				}
				const response = await apiRequest.call(this, 'GET', '/n8n/webhooks');
				const records = Array.isArray(response)
					? response
					: Array.isArray(response.data)
						? response.data
						: [];
				const record = records.find(
					(entry) => entry && typeof entry === 'object' && matches(entry as IDataObject, config),
				) as IDataObject | undefined;
				if (!record || typeof record.id !== 'string') return false;
				state.subscriptionId = record.id;
				return true;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const config = await configuration(this);
				const state = this.getWorkflowStaticData('node');
				const previousId = state.subscriptionId;
				// Each activation must reach the upsert; a configuration-derived key can replay a deleted subscription.
				const record = await apiRequest.call(this, 'POST', '/n8n/webhooks', {
					body: config,
					idempotencyKey: `n8n:webhook:create:${randomUUID()}`,
				});
				if (typeof record.id !== 'string' || !matches(record, config))
					throw new NodeOperationError(
						this.getNode(),
						'FITsociety did not confirm the requested webhook configuration. Reactivate the trigger.',
					);
				if (typeof previousId === 'string' && previousId !== record.id) {
					try {
						await apiRequest.call(
							this,
							'DELETE',
							`/n8n/webhooks/${encodeURIComponent(previousId)}`,
							{ idempotencyKey: `n8n:webhook:delete:${signingKeyHash(previousId)}` },
						);
					} catch (error) {
						if (!isNotFound(error)) throw new NodeOperationError(this.getNode(), error as Error);
					}
				}
				state.subscriptionId = record.id;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const state = this.getWorkflowStaticData('node');
				if (typeof state.subscriptionId !== 'string') return true;
				try {
					await apiRequest.call(
						this,
						'DELETE',
						`/n8n/webhooks/${encodeURIComponent(state.subscriptionId)}`,
						{ idempotencyKey: `n8n:webhook:delete:${signingKeyHash(state.subscriptionId)}` },
					);
				} catch (error) {
					if (!isNotFound(error)) throw new NodeOperationError(this.getNode(), error as Error);
				}
				delete state.subscriptionId;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const credentials = await this.getCredentials('fitsocietyOAuth2Api');
		try {
			const envelope = verifyWebhook({
				rawBody: this.getRequestObject().rawBody,
				headers: this.getHeaderData(),
				signingKey: deriveSigningKey(
					String(credentials.clientSecret || ''),
					this.getNode().webhookId || '',
				),
				companyId: String(credentials.companyId || ''),
				events: selectedEvents(this.getNodeParameter('events')),
			});
			return { workflowData: [[{ json: envelope }]] };
		} catch {
			const response = this.getResponseObject();
			response.status(401).json({ error: 'Invalid FITsociety webhook' });
			return { noWebhookResponse: true };
		}
	}
}
