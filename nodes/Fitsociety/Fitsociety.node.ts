import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type ILoadOptionsFunctions,
	type INodeExecutionData,
	type INodePropertyOptions,
	type INodeType,
	type INodeTypeDescription,
	type ResourceMapperFields,
} from 'n8n-workflow';
import { apiRequest, apiRequestAll, buildIdempotencyKey } from './api';
import { actionProperties, customFieldSchema, operationParameters } from './fields';
import { buildOperation, type CustomFieldDefinition } from './operations';

async function resourceOptions(
	context: ILoadOptionsFunctions,
	path: string,
	collection: string,
	idKey: string,
	qs: IDataObject = {},
): Promise<INodePropertyOptions[]> {
	const rows = await apiRequestAll.call(context, 'GET', path, { collection, maxItems: 1000, qs });
	return rows.map((row) => ({
		name: String(row.name || `${row.firstName || ''} ${row.lastName || ''}`.trim() || row[idKey]),
		value: String(row[idKey]),
	}));
}

export class Fitsociety implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'FITsociety',
		name: 'fitsociety',
		icon: { light: 'file:fitsociety.svg', dark: 'file:fitsociety.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Manage FITsociety clients, bookings, forms and custom fields',
		defaults: { name: 'FITsociety' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'fitsocietyOAuth2Api', required: true }],
		properties: actionProperties,
	};
	methods = {
		loadOptions: {
			async getTags(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return resourceOptions(this, '/client-tags', 'data', 'tagId');
			},
			async getCoaches(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return resourceOptions(this, '/coaches', 'data', 'coachId');
			},
			async getIntakeForms(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return resourceOptions(this, '/forms', 'forms', 'formId', { formType: 'intake' });
			},
			async getCheckupForms(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return resourceOptions(this, '/forms', 'forms', 'formId', { formType: 'checkup' });
			},
		},
		resourceMapping: {
			async getCustomFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				const result = await apiRequest.call(this, 'GET', '/client-custom-fields');
				return customFieldSchema((result.customFields || []) as CustomFieldDefinition[]);
			},
		},
	};
	// Dynamic validation requires fetching the current company schema before a write;
	// bounded multi-page list aggregation also needs programmatic control flow.
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const input = this.getInputData();
		const output: INodeExecutionData[] = [];
		for (let itemIndex = 0; itemIndex < input.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const key = `${resource}.${operation}`;
				const parameters: IDataObject = {};
				for (const name of operationParameters[key] || [])
					parameters[name] = this.getNodeParameter(name, itemIndex, '') as IDataObject[string];
				const definitions =
					key === 'customField.update'
						? ((await apiRequest.call(this, 'GET', '/client-custom-fields'))
								.customFields as CustomFieldDefinition[])
						: [];
				const request = buildOperation(resource, operation, parameters, definitions);
				if (request.collection) {
					const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
					const maxItems = Number(
						this.getNodeParameter(
							returnAll ? 'maxItems' : 'limit',
							itemIndex,
							returnAll ? 1000 : 50,
						),
					);
					if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 10000)
						throw new NodeOperationError(
							this.getNode(),
							'Limit and Max Items must be whole numbers between 1 and 10000.',
							{ itemIndex },
						);
					const rows = await apiRequestAll.call(this, request.method, request.path, {
						collection: request.collection,
						qs: request.qs,
						maxItems,
					});
					output.push(...rows.map((json) => ({ json, pairedItem: { item: itemIndex } })));
				} else {
					const idempotencyKey =
						request.method === 'GET'
							? undefined
							: buildIdempotencyKey(
									this.getExecutionId(),
									this.getNode().id,
									itemIndex,
									key,
									this.getNodeParameter('businessKey', itemIndex, '') as string,
								);
					const result = await apiRequest.call(this, request.method, request.path, {
						body: request.body,
						qs: request.qs,
						idempotencyKey,
					});
					// Keep mutation metadata (for example existingAccount and email status).
					const nested = request.output && result[request.output];
					const json =
						request.method === 'GET' &&
						nested &&
						typeof nested === 'object' &&
						!Array.isArray(nested)
							? (nested as IDataObject)
							: result;
					output.push({ json, pairedItem: { item: itemIndex } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					output.push({
						json: { error: (error as Error).message },
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}
		return [output];
	}
}
