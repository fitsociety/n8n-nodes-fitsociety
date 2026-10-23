import type {
	ICredentialDataDecryptedObject,
	ICredentialType,
	IDataObject,
	INodeProperties,
} from 'n8n-workflow';

export function normalizeApiBaseUrl(value: unknown): string {
	let parsed: URL;
	try {
		parsed = new URL(String(value));
	} catch {
		throw new Error('Configure a valid HTTPS FITsociety API base URL ending in /public/v1.');
	}
	if (
		parsed.protocol !== 'https:' ||
		parsed.username ||
		parsed.password ||
		parsed.search ||
		parsed.hash ||
		parsed.pathname.replace(/\/$/, '') !== '/public/v1'
	) {
		throw new Error('Configure a valid HTTPS FITsociety API base URL ending in /public/v1.');
	}
	return parsed.toString().replace(/\/$/, '');
}

export function validateConnection(credentials: ICredentialDataDecryptedObject): void {
	normalizeApiBaseUrl(credentials.apiBaseUrl);
	const token = credentials.oauthTokenData as IDataObject | undefined;
	if (
		!token ||
		token.integration_key !== 'n8n' ||
		token.client_id !== credentials.clientId ||
		token.company_id !== credentials.companyId
	) {
		throw new Error(
			'This connection does not match the FITsociety n8n client and company. Check the company credentials and reconnect.',
		);
	}
}

export class FitsocietyOAuth2Api implements ICredentialType {
	name = 'fitsocietyOAuth2Api';
	displayName = 'FITsociety OAuth2 API';
	extends = ['oAuth2Api'];
	icon: ICredentialType['icon'] = { light: 'file:fitsociety.svg', dark: 'file:fitsociety.svg' };
	documentationUrl = 'https://github.com/fitsociety/n8n-nodes-fitsociety#credentials';
	properties: INodeProperties[] = [
		{
			displayName: 'API Base URL',
			name: 'apiBaseUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'https://api.example.com/public/v1',
			description: 'The HTTPS FITsociety API base URL, including /public/v1',
		},
		{
			displayName: 'Company ID',
			name: 'companyId',
			type: 'string',
			default: '',
			required: true,
			description: 'The company ID supplied with your company-specific n8n credentials',
		},
		{ displayName: 'Grant Type', name: 'grantType', type: 'hidden', default: 'clientCredentials' },
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: '={{$self["apiBaseUrl"].replace(/\\/$/, "") + "/oauth/token"}}',
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: '',
		},
		{ displayName: 'Scope', name: 'scope', type: 'hidden', default: '' },
		{ displayName: 'Authentication', name: 'authentication', type: 'hidden', default: 'header' },
	];
	async preAuthentication(credentials: ICredentialDataDecryptedObject): Promise<IDataObject> {
		validateConnection(credentials);
		return {};
	}
}
