import type { Handle, HandleServerError } from '@sveltejs/kit';
import { logError } from '$lib/server/errorHandler.server';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	// Allow itch.io to iframe the game
	response.headers.set('Content-Security-Policy', "frame-ancestors 'self' https://*.itch.io https://*.itch.zone");
	// Remove X-Frame-Options because CSP frame-ancestors takes precedence and is more flexible
	response.headers.delete('X-Frame-Options');
	return response;
};

/**
 * Extract browser info from request headers (server-side approximation)
 */
function getBrowserInfoFromHeaders(headers: Headers): Record<string, unknown> {
	return {
		acceptLanguage: headers.get('accept-language'),
		platform: 'server',
		userAgent: headers.get('user-agent')
	};
}

/**
 * Try to extract user ID from cookies (Supabase auth token)
 */
function getUserIdFromCookies(cookies: { get: (name: string) => string | undefined }): string | null {
	try {
		// Supabase stores auth in sb-<project-ref>-auth-token cookie
		const authCookie = cookies.get('sb-access-token') || cookies.get('sb-refresh-token');
		if (authCookie) {
			// Try to decode JWT to get user ID (payload is base64)
			const parts = authCookie.split('.');
			if (parts.length === 3) {
				// Decode JWT payload (base64) without validating signature! Do not use for authorization.
				const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
				return payload.sub || null;
			}
		}
	} catch {
		// Silently fail - can't extract user ID
	}
	return null;
}

/**
 * Global server-side error handler for SvelteKit
 * Catches unhandled errors during SSR and reports them
 */
export const handleError: HandleServerError = async ({ error, event, status, message }) => {
	// Don't report 404 errors
	if (status === 404) {
		return { message: 'Page not found' };
	}

	console.error('[Server Error]', error);

	// Extract what info we can from the request
	const browserInfo = getBrowserInfoFromHeaders(event.request.headers);
	const userId = getUserIdFromCookies(event.cookies);

	// Log the error to Supabase and Discord
	try {
		await logError({
			browserInfo,
			errorMessage: error instanceof Error ? error.message : message || 'Unknown server error',
			stackTrace: error instanceof Error ? error.stack : null,
			url: event.url.href,
			userId
		});
	} catch (logErr) {
		console.error('[Server Error] Failed to log error:', logErr);
	}

	// Return a user-friendly error message
	return {
		message: 'An unexpected error occurred on the server.'
	};
};
