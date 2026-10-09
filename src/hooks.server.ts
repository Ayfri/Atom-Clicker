import { dev } from '$app/env';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { logError } from '#lib/server/errorHandler.server.js';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	// Frame hosts: itch.io, galaxy.click, and local development
	response.headers.set('Content-Security-Policy', "frame-ancestors 'self' https://*.itch.io https://*.itch.zone https://galaxy.click https://*.galaxy.click file:");
	// CSP frame-ancestors takes precedence over X-Frame-Options and allows several hosts
	response.headers.delete('X-Frame-Options');
	response.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
	return response;
};

export const handleError: HandleServerError = async ({ error, event, kind }) => {
	// Errors thrown with `error(...)` are expected and keep their own status and message
	if (kind === 'app') return;
	const status = kind === 'unknown' ? 500 : error.status;
	// Only server faults are worth an alert, everything below 500 is a bad request, most of them scanners
	if (status < 500) {
		return { message: status === 404 ? 'Page not found' : 'This request could not be handled.' };
	}

	console.error('[Server Error]', error);

	const errorMessage = error instanceof Error ? error.message : kind === 'unknown' ? 'Unknown server error' : error.message;
	const stackTrace = error instanceof Error ? error.stack : undefined;
	try {
		await logError({
			browserInfo: {
				acceptLanguage: event.request.headers.get('accept-language'),
				platform: 'server',
				userAgent: event.request.headers.get('user-agent')
			},
			errorMessage,
			stackTrace: stackTrace ?? null,
			url: event.url.href
		});
	} catch (logErr) {
		console.error('[Server Error] Failed to log error:', logErr);
	}

	return dev ? { message: errorMessage, stack: stackTrace } : { message: 'An unexpected error occurred on the server.' };
};
