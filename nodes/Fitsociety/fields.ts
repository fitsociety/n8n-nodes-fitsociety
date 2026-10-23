import type { IDataObject, INodeProperties, ResourceMapperFields } from 'n8n-workflow';
import {
	isWritableField,
	monthlyWeeks,
	operationCatalog,
	scheduleTypes,
	weekdays,
} from './operations';
import type { CustomFieldDefinition } from './operations';

export function displayText(value: unknown, fallback: string): string {
	if (typeof value === 'string') return value.trim() || fallback;
	if (value && typeof value === 'object')
		return (
			(Object.values(value as IDataObject).find(
				(text) => typeof text === 'string' && text.trim(),
			) as string) || fallback
		);
	return fallback;
}
export function customFieldSchema(definitions: CustomFieldDefinition[]): ResourceMapperFields {
	return {
		fields: definitions.filter(isWritableField).map((field) => ({
			id: field.key,
			displayName: displayText(field.label, field.key),
			required: false,
			defaultMatch: false,
			canBeUsedToMatch: false,
			display: true,
			type:
				field.type === 'checkbox'
					? 'boolean'
					: field.type === 'number'
						? 'number'
						: field.type === 'select'
							? 'options'
							: 'string',
			...(field.type === 'select'
				? {
						options: (field.options || []).map((option) => ({
							name: displayText(option.label, option.value),
							value: option.value,
						})),
					}
				: {}),
		})),
	};
}
const show = (resource: string[], operation: string[]) => ({ show: { resource, operation } });
const choices = (values: string[]) => values.map((value) => ({ name: value, value }));
const language: INodeProperties = {
	displayName: 'Language',
	name: 'language',
	type: 'options',
	default: 'en',
	options: [
		{ name: 'Dutch', value: 'nl' },
		{ name: 'English', value: 'en' },
		{ name: 'French', value: 'fr' },
		{ name: 'German', value: 'de' },
		{ name: 'Spanish', value: 'es' },
	],
};
const text = (
	displayName: string,
	name: string,
	extra: Partial<INodeProperties> = {},
): INodeProperties => ({ displayName, name, type: 'string', default: '', ...extra });
const optionsField = (
	displayName: string,
	name: string,
	method: string,
	extra: Partial<INodeProperties> = {},
): INodeProperties => ({
	displayName,
	name,
	type: 'options',
	default: '',
	typeOptions: { loadOptionsMethod: method },
	description:
		'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	...extra,
});
const contactFields: INodeProperties[] = [
	text('Email', 'email'),
	text('First Name', 'firstName'),
	language,
	text('Last Name', 'lastName'),
	text('Phone Number', 'phoneNumber'),
	text('Time Zone', 'timeZone', { description: 'IANA time zone, for example Europe/Amsterdam' }),
];
const collection = (
	displayName: string,
	name: string,
	resource: string[],
	operations: string[],
	options: INodeProperties[],
): INodeProperties => ({
	displayName,
	name,
	type: 'collection',
	placeholder: 'Add Field',
	default: {},
	displayOptions: show(resource, operations),
	options,
});
export const actionProperties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		default: 'client',
		options: [
			{ name: 'Booking', value: 'booking' },
			{ name: 'Calendar Event', value: 'calendar' },
			{ name: 'Client', value: 'client' },
			{ name: 'Coach', value: 'coach' },
			{ name: 'Custom Field', value: 'customField' },
			{ name: 'Form', value: 'form' },
			{ name: 'Tag', value: 'tag' },
		],
	},
	...Object.entries(operationCatalog).map(([resource, operations]): INodeProperties => {
		const property: INodeProperties = {
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			default: 'list',
			displayOptions: { show: { resource: [resource] } },
			options: operations.map(([value, name, action]) => ({ name, value, action })),
		};
		property.default = operations[0][0];
		return property;
	}),
	text('Client ID', 'clientId', {
		required: true,
		displayOptions: { show: { resource: ['client'], operation: ['get', 'update', 'invite'] } },
		description: 'Client ID from a previous FITsociety step',
	}),
	text('Client ID', 'clientId', {
		required: true,
		displayOptions: {
			show: { resource: ['tag', 'coach'], operation: ['add', 'remove', 'assign'] },
		},
	}),
	text('Client ID', 'clientId', { required: true, displayOptions: show(['booking'], ['create']) }),
	text('Client ID', 'clientId', {
		required: true,
		displayOptions: show(['form'], ['assignIntake', 'scheduleCheckup']),
	}),
	text('Client ID', 'clientId', {
		required: true,
		displayOptions: show(['customField'], ['get', 'update']),
	}),
	text('First Name', 'firstName', {
		required: true,
		displayOptions: show(['client'], ['create']),
		description: 'Between 2 and 50 characters',
	}),
	text('Email', 'email', { required: true, displayOptions: show(['client'], ['create']) }),
	collection(
		'Additional Fields',
		'additionalFields',
		['client'],
		['create'],
		contactFields.filter((field) => ['lastName', 'language', 'timeZone'].includes(field.name)),
	),
	collection('Update Fields', 'updateFields', ['client'], ['update'], contactFields),
	{
		displayName: 'Client Creation',
		name: 'createNotice',
		type: 'notice',
		default:
			'New accounts are created without an app invitation. Existing accounts are linked and notified by email. Use Send Invitation to invite a new account.',
		displayOptions: show(['client'], ['create']),
	},
	{
		displayName: 'Invitation Email',
		name: 'inviteNotice',
		type: 'notice',
		default: 'This operation sends the client an invitation email.',
		displayOptions: show(['client'], ['invite']),
	},
	collection(
		'Filters',
		'filters',
		['client'],
		['search'],
		[
			text('Email', 'email', { description: 'Exact email address, case-insensitive' }),
			text('External ID', 'externalId'),
			text('Search', 'search'),
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: 'active',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'All Accessible Statuses', value: '' },
					{ name: 'Archived', value: 'archived' },
					{ name: 'Inactive', value: 'inactive' },
					{ name: 'Invited', value: 'invited' },
					{ name: 'Paused', value: 'paused' },
					{ name: 'Pending Approval', value: 'pending_approval' },
					{ name: 'Pending Removal', value: 'pending_removal' },
					{ name: 'Trial', value: 'trial' },
				],
			},
		],
	),
	{
		displayName: 'Tag Names or IDs',
		name: 'tagIds',
		type: 'multiOptions',
		default: [],
		required: true,
		typeOptions: { loadOptionsMethod: 'getTags' },
		displayOptions: show(['tag'], ['add', 'remove']),
		description:
			'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	},
	optionsField('Coach Name or ID', 'coachId', 'getCoaches', {
		required: true,
		displayOptions: show(['coach'], ['assign']),
	}),
	text('Booking ID', 'bookingId', {
		required: true,
		displayOptions: show(['booking'], ['get', 'cancel', 'updateAttendance']),
	}),
	text('Calendar Event ID', 'calendarEventId', {
		required: true,
		displayOptions: show(['booking'], ['create']),
		description:
			'Event ID from Get Many Calendar Events. Recurring events also require an occurrence date and time.',
	}),
	collection(
		'Booking Options',
		'bookingOptions',
		['booking'],
		['create'],
		[
			{
				displayName: 'Occurrence Date and Time',
				name: 'instanceDate',
				type: 'dateTime',
				default: '',
				description: 'Required for a recurring event. Include a time zone offset.',
			},
		],
	),
	{
		displayName: 'Booking Policy',
		name: 'bookingNotice',
		type: 'notice',
		default: 'Uses the client’s eligible products and the company’s normal booking rules.',
		displayOptions: show(['booking'], ['create']),
	},
	collection(
		'Cancellation Options',
		'cancelOptions',
		['booking'],
		['cancel'],
		[
			{ displayName: 'Notify Client', name: 'notifyClient', type: 'boolean', default: false },
			{ displayName: 'Notify Coach', name: 'notifyCoach', type: 'boolean', default: false },
			{
				displayName: 'Occurrence Date and Time',
				name: 'instanceDate',
				type: 'dateTime',
				default: '',
			},
		],
	),
	{
		displayName: 'Cancellation Policy',
		name: 'cancelNotice',
		type: 'notice',
		default: 'Cancels the booking using the company’s normal cancellation and credit policy.',
		displayOptions: show(['booking'], ['cancel']),
	},
	{
		displayName: 'Attendance Status',
		name: 'attendanceStatus',
		type: 'options',
		default: 'attended',
		required: true,
		displayOptions: show(['booking'], ['updateAttendance']),
		options: [
			{ name: 'Attended', value: 'attended' },
			{ name: 'No-Show', value: 'noshow' },
			{ name: 'Unknown', value: 'unknown' },
		],
	},
	collection(
		'Attendance Options',
		'attendanceOptions',
		['booking'],
		['updateAttendance'],
		[text('No-Show Reason', 'noShowReason'), text('Remarks', 'remarks')],
	),
	{
		displayName: 'Date From',
		name: 'dateFrom',
		type: 'dateTime',
		default: '',
		required: true,
		displayOptions: show(['booking', 'calendar'], ['search', 'list']),
		description: 'Start of the date range, including a time zone offset. Maximum range: 92 days.',
	},
	{
		displayName: 'Date To',
		name: 'dateTo',
		type: 'dateTime',
		default: '',
		required: true,
		displayOptions: show(['booking', 'calendar'], ['search', 'list']),
		description: 'End of the date range, including a time zone offset',
	},
	collection(
		'Filters',
		'filters',
		['booking'],
		['search'],
		[text('Client ID', 'clientId'), text('Coach ID', 'coachId'), text('Status', 'status')],
	),
	collection('Filters', 'filters', ['calendar'], ['list'], [text('Coach ID', 'coachId')]),
	collection(
		'Filters',
		'filters',
		['form'],
		['list'],
		[
			{
				displayName: 'Form Type',
				name: 'formType',
				type: 'options',
				default: 'intake',
				options: [
					{ name: 'Check-Up', value: 'checkup' },
					{ name: 'Intake', value: 'intake' },
				],
			},
		],
	),
	optionsField('Intake Form Name or ID', 'formId', 'getIntakeForms', {
		required: true,
		displayOptions: show(['form'], ['assignIntake']),
	}),
	optionsField('Check-Up Form Name or ID', 'formId', 'getCheckupForms', {
		required: true,
		displayOptions: show(['form'], ['scheduleCheckup']),
	}),
	{
		displayName: 'Schedule',
		name: 'scheduleType',
		type: 'options',
		default: 'Today',
		required: true,
		options: choices(scheduleTypes),
		displayOptions: show(['form'], ['scheduleCheckup']),
	},
	{
		displayName: 'Day of Week',
		name: 'weeklyOn',
		type: 'options',
		default: 'Monday',
		required: true,
		options: choices(weekdays),
		displayOptions: {
			show: { resource: ['form'], operation: ['scheduleCheckup'], scheduleType: ['Weekly'] },
		},
	},
	{
		displayName: 'Week of Month',
		name: 'monthlyWeek',
		type: 'options',
		default: 'First',
		required: true,
		options: choices(monthlyWeeks),
		displayOptions: {
			show: { resource: ['form'], operation: ['scheduleCheckup'], scheduleType: ['Monthly'] },
		},
	},
	{
		displayName: 'Day of Week',
		name: 'monthlyDay',
		type: 'options',
		default: 'Monday',
		required: true,
		options: choices(weekdays),
		displayOptions: {
			show: { resource: ['form'], operation: ['scheduleCheckup'], scheduleType: ['Monthly'] },
		},
	},
	{
		displayName: 'Custom Fields',
		name: 'customFields',
		type: 'resourceMapper',
		default: { mappingMode: 'defineBelow', value: null },
		noDataExpression: true,
		required: true,
		displayOptions: show(['customField'], ['update']),
		typeOptions: {
			resourceMapper: {
				resourceMapperMethod: 'getCustomFields',
				mode: 'update',
				addAllFields: false,
				supportAutoMap: false,
				fieldWords: { singular: 'field', plural: 'fields' },
			},
		},
	},
	{
		displayName: 'Field Values',
		name: 'customFieldsNotice',
		type: 'notice',
		default:
			'Map only fields to change. Dates use YYYY-MM-DD. Null explicitly clears a value; empty text remains empty. Company validation still applies.',
		displayOptions: show(['customField'], ['update']),
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: { show: { operation: ['list', 'search'] } },
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1, maxValue: 10000 },
		displayOptions: { show: { operation: ['list', 'search'], returnAll: [false] } },
		description: 'Max number of results to return',
	},
	{
		displayName: 'Max Items',
		name: 'maxItems',
		type: 'number',
		default: 1000,
		typeOptions: { minValue: 1, maxValue: 10000 },
		displayOptions: { show: { operation: ['list', 'search'], returnAll: [true] } },
		description:
			'Safety cap for Return All. Calendar events may be truncated by the API for dense date ranges.',
	},
	{
		displayName: 'Business Event Key',
		name: 'businessKey',
		type: 'string',
		default: '',
		displayOptions: { hide: { operation: ['list', 'search', 'get'] } },
		description:
			'Optional unique source event ID for safe retries across executions. Reuse it only for the same intended action. Otherwise the execution, node, item and operation identify retries.',
	},
];

export const operationParameters: Record<string, string[]> = {
	'client.search': ['filters'],
	'client.get': ['clientId'],
	'client.create': ['firstName', 'email', 'additionalFields'],
	'client.update': ['clientId', 'updateFields'],
	'client.invite': ['clientId'],
	'tag.list': [],
	'tag.add': ['clientId', 'tagIds'],
	'tag.remove': ['clientId', 'tagIds'],
	'coach.list': [],
	'coach.assign': ['clientId', 'coachId'],
	'booking.search': ['dateFrom', 'dateTo', 'filters'],
	'booking.get': ['bookingId'],
	'booking.create': ['clientId', 'calendarEventId', 'bookingOptions'],
	'booking.cancel': ['bookingId', 'cancelOptions'],
	'booking.updateAttendance': ['bookingId', 'attendanceStatus', 'attendanceOptions'],
	'calendar.list': ['dateFrom', 'dateTo', 'filters'],
	'form.list': ['filters'],
	'form.assignIntake': ['clientId', 'formId'],
	'form.scheduleCheckup': [
		'clientId',
		'formId',
		'scheduleType',
		'weeklyOn',
		'monthlyDay',
		'monthlyWeek',
	],
	'customField.list': [],
	'customField.get': ['clientId'],
	'customField.update': ['clientId', 'customFields'],
};
