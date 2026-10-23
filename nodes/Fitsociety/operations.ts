import type { IDataObject, IHttpRequestMethods } from 'n8n-workflow';

export interface OperationRequest {
	method: IHttpRequestMethods;
	path: string;
	body?: IDataObject;
	qs?: IDataObject;
	collection?: string;
	output?: string;
}
export interface CustomFieldDefinition extends IDataObject {
	key: string;
	type: string;
	readOnly?: boolean;
	source?: string;
	mode?: string;
	label?: IDataObject | string;
	options?: Array<{ value: string; label?: IDataObject | string }>;
	validation?: {
		min?: number | null;
		max?: number | null;
		minLength?: number | null;
		maxLength?: number | null;
	};
}
export const operationCatalog = {
	client: [
		['search', 'Search', 'Search clients'],
		['get', 'Get', 'Get a client'],
		['create', 'Create', 'Create a client'],
		['update', 'Update', 'Update a client'],
		['invite', 'Send Invitation', 'Send a client invitation'],
	],
	tag: [
		['list', 'Get Many', 'Get many tags'],
		['add', 'Add to Client', 'Add tags to a client'],
		['remove', 'Remove From Client', 'Remove tags from a client'],
	],
	coach: [
		['list', 'Get Many', 'Get many coaches'],
		['assign', 'Assign to Client', 'Assign a coach to a client'],
	],
	booking: [
		['search', 'Search', 'Search bookings'],
		['get', 'Get', 'Get a booking'],
		['create', 'Create', 'Create a booking'],
		['cancel', 'Cancel', 'Cancel a booking'],
		['updateAttendance', 'Update Attendance', 'Update booking attendance'],
	],
	calendar: [['list', 'Get Many', 'Get many calendar events']],
	form: [
		['list', 'Get Many', 'Get many forms'],
		['assignIntake', 'Assign Intake', 'Assign an intake form'],
		['scheduleCheckup', 'Schedule Check-Up', 'Schedule a check-up'],
	],
	customField: [
		['list', 'Get Definitions', 'Get custom field definitions'],
		['get', 'Get Client Values', 'Get client custom field values'],
		['update', 'Update Client Values', 'Update client custom field values'],
	],
} as const;
export const weekdays = [
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday',
	'Sunday',
];
export const monthlyWeeks = ['First', 'Second', 'Third', 'Fourth', 'Last'];
export const scheduleTypes = ['Today', 'Daily', 'Weekly', 'Monthly', 'Weekends', 'Weekdays'];

function object(value: unknown): IDataObject {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as IDataObject)
		: {};
}
function required(parameters: IDataObject, key: string): string {
	const value = parameters[key];
	if (typeof value !== 'string' || !value.trim()) throw new Error(`Provide ${key}.`);
	return value.trim();
}
function id(parameters: IDataObject, key: string): string {
	return encodeURIComponent(required(parameters, key));
}
function only(parameters: IDataObject, keys: string[]): IDataObject {
	return Object.fromEntries(
		keys
			.filter((key) => parameters[key] !== undefined && parameters[key] !== '')
			.map((key) => [key, parameters[key]]),
	);
}
export function utcDateTime(value: unknown): string {
	if (
		typeof value !== 'string' ||
		!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ||
		!Number.isFinite(Date.parse(value))
	)
		throw new Error('Provide a valid date and time with a time zone offset.');
	const date = value.slice(0, 10);
	if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)
		throw new Error('Provide a valid calendar date.');
	return new Date(value).toISOString();
}
function range(parameters: IDataObject): IDataObject {
	const dateFrom = utcDateTime(parameters.dateFrom);
	const dateTo = utcDateTime(parameters.dateTo);
	const duration = Date.parse(dateTo) - Date.parse(dateFrom);
	if (duration <= 0 || Math.ceil(duration / 86400000) + 1 > 92)
		throw new Error('Date To must follow Date From within a maximum range of 92 days.');
	return { dateFrom, dateTo };
}
export function isWritableField(field: CustomFieldDefinition): boolean {
	return (
		!field.readOnly &&
		field.source !== 'autoSequence' &&
		field.mode !== 'hidden' &&
		['text', 'textarea', 'number', 'checkbox', 'date', 'select'].includes(field.type)
	);
}
export function customFieldValue(
	field: CustomFieldDefinition,
	value: unknown,
): string | number | boolean | null {
	if (value === null) return null;
	const rule = field.validation || {};
	if (field.type === 'checkbox') {
		if (value === true || value === 'true') return true;
		if (value === false || value === 'false') return false;
		throw new Error(`Choose true or false for ${field.key}.`);
	}
	if (field.type === 'number') {
		const text = typeof value === 'string' ? value.trim() : String(value);
		if (!/^-?\d+(?:[.,]\d+)?$/.test(text))
			throw new Error(`Enter a number without thousands separators for ${field.key}.`);
		const number = Number(text.replace(',', '.'));
		if (
			!Number.isFinite(number) ||
			(rule.min != null && number < rule.min) ||
			(rule.max != null && number > rule.max)
		)
			throw new Error(`Number outside the allowed range for ${field.key}.`);
		return number;
	}
	if (field.type === 'date') {
		if (
			typeof value !== 'string' ||
			!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
			!Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
			new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
		)
			throw new Error(`Use a valid calendar date in YYYY-MM-DD format for ${field.key}.`);
		return value;
	}
	if (typeof value !== 'string') throw new Error(`Enter text for ${field.key}.`);
	if (field.type === 'select' && !(field.options || []).some((option) => option.value === value))
		throw new Error(`Choose a configured option for ${field.key}.`);
	if (
		(rule.minLength != null && value.length < rule.minLength) ||
		(rule.maxLength != null && value.length > rule.maxLength)
	)
		throw new Error(`Text length outside the allowed range for ${field.key}.`);
	return value;
}
export function buildOperation(
	resource: string,
	operation: string,
	p: IDataObject,
	definitions: CustomFieldDefinition[] = [],
): OperationRequest {
	const clientPath = () => `/clients/${id(p, 'clientId')}`;
	if (resource === 'client') {
		if (operation === 'search')
			return {
				method: 'GET',
				path: '/clients',
				collection: 'data',
				qs: only(object(p.filters), ['search', 'email', 'status', 'externalId']),
			};
		if (operation === 'get') return { method: 'GET', path: clientPath(), output: 'client' };
		if (operation === 'create')
			return {
				method: 'POST',
				path: '/clients',
				body: {
					firstName: required(p, 'firstName'),
					email: required(p, 'email'),
					...only(object(p.additionalFields), ['lastName', 'language', 'timeZone']),
					inviteByEmail: false,
				},
				output: 'client',
			};
		if (operation === 'update') {
			const body = only(object(p.updateFields), [
				'firstName',
				'lastName',
				'email',
				'phoneNumber',
				'language',
				'timeZone',
			]);
			if (!Object.keys(body).length) throw new Error('Provide at least one field to update.');
			return { method: 'PATCH', path: clientPath(), body, output: 'client' };
		}
		if (operation === 'invite')
			return { method: 'POST', path: `${clientPath()}/invite`, body: {}, output: 'invite' };
	}
	if (resource === 'tag') {
		if (operation === 'list') return { method: 'GET', path: '/client-tags', collection: 'data' };
		if (operation === 'add' || operation === 'remove') {
			const tagIds = p.tagIds;
			if (
				!Array.isArray(tagIds) ||
				!tagIds.length ||
				tagIds.some((tag) => typeof tag !== 'string' || !tag.trim())
			)
				throw new Error('Choose at least one tag.');
			return {
				method: 'PATCH',
				path: clientPath(),
				body: { [operation === 'add' ? 'assignTagIds' : 'removeTagIds']: tagIds },
			};
		}
	}
	if (resource === 'coach') {
		if (operation === 'list') return { method: 'GET', path: '/coaches', collection: 'data' };
		if (operation === 'assign')
			return {
				method: 'PATCH',
				path: clientPath(),
				body: { assignedCoach: required(p, 'coachId') },
			};
	}
	if (resource === 'booking') {
		if (operation === 'search')
			return {
				method: 'GET',
				path: '/bookings',
				collection: 'bookings',
				qs: { ...range(p), ...only(object(p.filters), ['clientId', 'coachId', 'status']) },
			};
		if (operation === 'get')
			return { method: 'GET', path: `/bookings/${id(p, 'bookingId')}`, output: 'booking' };
		if (operation === 'create') {
			const options = object(p.bookingOptions);
			return {
				method: 'POST',
				path: '/bookings',
				body: {
					clientId: required(p, 'clientId'),
					calendarEventId: required(p, 'calendarEventId'),
					...(options.instanceDate ? { instanceDate: utcDateTime(options.instanceDate) } : {}),
					paymentMethod: 'product',
				},
				output: 'booking',
			};
		}
		if (operation === 'cancel') {
			const options = object(p.cancelOptions);
			return {
				method: 'POST',
				path: `/bookings/${id(p, 'bookingId')}/cancel`,
				body: {
					financialAction: 'followPolicy',
					...(options.instanceDate ? { instanceDate: utcDateTime(options.instanceDate) } : {}),
					notifyClient: options.notifyClient === true,
					notifyCoach: options.notifyCoach === true,
				},
			};
		}
		if (operation === 'updateAttendance') {
			const status = required(p, 'attendanceStatus');
			if (!['attended', 'noshow', 'unknown'].includes(status))
				throw new Error('Choose a valid attendance status.');
			return {
				method: 'PATCH',
				path: `/bookings/${id(p, 'bookingId')}`,
				body: { status, ...only(object(p.attendanceOptions), ['noShowReason', 'remarks']) },
			};
		}
	}
	if (resource === 'calendar' && operation === 'list')
		return {
			method: 'GET',
			path: '/calendar-events',
			collection: 'events',
			qs: { ...range(p), ...only(object(p.filters), ['coachId']) },
		};
	if (resource === 'form') {
		if (operation === 'list')
			return {
				method: 'GET',
				path: '/forms',
				collection: 'forms',
				qs: only(object(p.filters), ['formType']),
			};
		if (operation === 'assignIntake')
			return {
				method: 'POST',
				path: `${clientPath()}/intake-assignments`,
				body: { formId: required(p, 'formId') },
				output: 'assignment',
			};
		if (operation === 'scheduleCheckup') {
			const type = required(p, 'scheduleType');
			if (!scheduleTypes.includes(type)) throw new Error('Choose a valid check-up schedule.');
			const schedule: IDataObject = { type };
			if (type === 'Weekly') {
				if (!weekdays.includes(String(p.weeklyOn)))
					throw new Error('Choose a valid day for the weekly schedule.');
				schedule.weeklyOn = p.weeklyOn;
			}
			if (type === 'Monthly') {
				if (
					!weekdays.includes(String(p.monthlyDay)) ||
					!monthlyWeeks.includes(String(p.monthlyWeek))
				)
					throw new Error('Choose a valid day and week for the monthly schedule.');
				schedule.monthlyDay = p.monthlyDay;
				schedule.monthlyWeek = p.monthlyWeek;
			}
			return {
				method: 'POST',
				path: `${clientPath()}/checkups`,
				body: { formId: required(p, 'formId'), schedule },
				output: 'checkup',
			};
		}
	}
	if (resource === 'customField') {
		if (operation === 'list')
			return { method: 'GET', path: '/client-custom-fields', collection: 'customFields' };
		if (operation === 'get') return { method: 'GET', path: `${clientPath()}/custom-fields` };
		if (operation === 'update') {
			const values = object(object(p.customFields).value);
			if (!Object.keys(values).length) throw new Error('Map at least one custom field to update.');
			const customFieldValues = Object.entries(values)
				.filter(([, value]) => value !== undefined)
				.map(([key, value]) => {
					const definition = definitions.find(
						(field) => field.key === key && isWritableField(field),
					);
					if (!definition)
						throw new Error(`Select an editable custom field from this company: ${key}.`);
					return { key, value: customFieldValue(definition, value) };
				});
			if (!customFieldValues.length) throw new Error('Map at least one custom field to update.');
			return {
				method: 'PATCH',
				path: `${clientPath()}/custom-fields`,
				body: { customFieldValues },
			};
		}
	}
	throw new Error(`Unsupported FITsociety operation: ${resource}.${operation}.`);
}
