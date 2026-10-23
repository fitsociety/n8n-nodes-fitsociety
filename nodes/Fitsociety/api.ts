import { createHash } from 'node:crypto';
import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { normalizeApiBaseUrl } from '../../credentials/FitsocietyOAuth2Api.credentials';
export { normalizeApiBaseUrl } from '../../credentials/FitsocietyOAuth2Api.credentials';

export type ApiContext = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions;
export interface ApiOptions {
	body?: IDataObject;
	qs?: IDataObject;
	idempotencyKey?: string;
}
export interface ListOptions extends ApiOptions {
	collection: string;
	maxItems?: number;
}

export function buildIdempotencyKey(
	executionId: string,
	nodeId: string,
	itemIndex: number,
	operation: string,
	businessKey?: string,
): string {
	const source = businessKey?.trim()
		? ['business', businessKey.trim(), nodeId, operation, itemIndex]
		: ['execution', executionId, nodeId, operation, itemIndex];
	return `n8n:${createHash('sha256').update(JSON.stringify(source)).digest('hex')}`;
}

function errorMessage(status: number): string {
	if (status === 401)
		return 'The FITsociety connection expired or was revoked. Reconnect using active company credentials.';
	if (status === 403)
		return 'This FITsociety connection lacks permission or company consent. Check its access and reconnect.';
	if (status === 404)
		return 'The requested FITsociety record was not found in the connected company.';
	if (status === 409)
		return 'FITsociety found conflicting data or an idempotency key reused with different input. Check the record and source event key.';
	if (status === 429)
		return 'FITsociety is receiving too many requests. Wait before retrying; keep the same source event key for writes.';
	if (status >= 500)
		return 'FITsociety could not complete the request. Retry later using the same source event key for writes.';
	return 'FITsociety rejected the input. Check required fields, dates and the connected company.';
}

export async function apiRequest(
	this: ApiContext,
	method: IHttpRequestMethods,
	path: string,
	options: ApiOptions = {},
): Promise<IDataObject> {
	if (
		!/^\/(?!\/)/.test(path) ||
		path.includes('\\') ||
		/(?:^|\/)\.{1,2}(?:\/|$)|%2e|%2f|%5c/i.test(path) ||
		path.includes('?') ||
		path.includes('#')
	)
		throw new NodeOperationError(this.getNode(), 'Invalid FITsociety API path.');
	if (!['GET', 'HEAD'].includes(method) && !options.idempotencyKey)
		throw new NodeOperationError(
			this.getNode(),
			'A stable idempotency key is required for this write.',
		);
	const credentials = await this.getCredentials('fitsocietyOAuth2Api');
	const url = `${normalizeApiBaseUrl(credentials.apiBaseUrl)}${path}`;
	const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': 'en' };
	if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
	let response: { statusCode: number; body: unknown };
	try {
		response = (await this.helpers.httpRequestWithAuthentication.call(this, 'fitsocietyOAuth2Api', {
			method,
			url,
			headers,
			qs: options.qs,
			body: options.body,
			json: true,
			returnFullResponse: true,
			// Keep 401 visible to n8n's OAuth2 refresh logic; map other API errors below.
			ignoreHttpStatusErrors: { ignore: true, except: [401] },
			disableFollowRedirect: true,
			timeout: 30000,
		})) as { statusCode: number; body: unknown };
	} catch {
		// Transport errors may contain authorization headers or echoed provider bodies.
		throw new NodeOperationError(
			this.getNode(),
			'Could not connect to FITsociety. Check the API URL and connection, then retry with the same source event key.',
		);
	}
	const body = response.body as IDataObject | undefined;
	if (response.statusCode < 200 || response.statusCode >= 300 || body?.error) {
		throw new NodeApiError(
			this.getNode(),
			{ statusCode: response.statusCode },
			{
				message: errorMessage(response.statusCode),
				httpCode: String(response.statusCode),
				description: `HTTP ${response.statusCode}`,
			},
		);
	}
	if (!body || body.data === undefined || body.data === null || typeof body.data !== 'object')
		throw new NodeOperationError(this.getNode(), 'FITsociety returned an unexpected response.');
	return body.data as IDataObject;
}

export async function apiRequestAll(
	this: ApiContext,
	method: IHttpRequestMethods,
	path: string,
	options: ListOptions,
): Promise<IDataObject[]> {
	if (method !== 'GET')
		throw new NodeOperationError(
			this.getNode(),
			'Pagination is only supported for read operations.',
		);
	const maxItems = options.maxItems ?? 1000;
	if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 10000)
		throw new NodeOperationError(
			this.getNode(),
			'Choose a maximum item count between 1 and 10000.',
		);
	const limit = Math.min(Number(options.qs?.limit) || 100, 500, maxItems);
	let page = Math.max(Number(options.qs?.page) || 1, 1);
	const result: IDataObject[] = [];
	for (let count = 0; count < 100; count++, page++) {
		const data = await apiRequest.call(this, method, path, {
			...options,
			qs: { ...options.qs, page, limit },
		});
		const rows = data[options.collection];
		if (!Array.isArray(rows))
			throw new NodeOperationError(
				this.getNode(),
				'FITsociety returned an unexpected list response.',
			);
		result.push(...(rows.slice(0, maxItems - result.length) as IDataObject[]));
		const pagination = (data.pagination as IDataObject | undefined) ?? data;
		if (result.length >= maxItems || rows.length === 0 || pagination.hasNextPage === false)
			return result;
		const totalPages = Number(pagination.totalPages);
		const total = Number(pagination.total);
		if (Number.isFinite(totalPages) && page >= totalPages) return result;
		const effectiveLimit = Number(pagination.limit) || limit;
		if (pagination.hasNextPage !== true && Number.isFinite(total) && page * effectiveLimit >= total)
			return result;
		if (pagination.hasNextPage !== true && !Number.isFinite(totalPages) && !Number.isFinite(total))
			return result;
	}
	throw new NodeOperationError(
		this.getNode(),
		'FITsociety pagination exceeded 100 pages. Use narrower filters or a lower maximum item count.',
	);
}
