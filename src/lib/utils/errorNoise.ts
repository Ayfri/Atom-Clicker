/** Every chunk Vite emits is served under `/_app/`, so a stack without it never ran our code. */
const APP_FRAME_PATTERN = /\/_app\//;

/** An injected script (extension content script, devtools snippet) shows up as `<anonymous>:line:col`, native frames as a bare `<anonymous>`. */
const INJECTED_TOP_FRAME_PATTERN = /\(<anonymous>:\d+:\d+\)/;

/**
 * Nothing to fix on our side: network failures, tabs left open across a deploy, and the
 * "Request timeout <name>Distributor.getValue" family a ChromeOS text-prediction extension rejects with.
 */
const IGNORED_MESSAGE_PATTERNS = [
	/^Failed to fetch$/,
	/^Load failed$/,
	/^NetworkError when attempting to fetch resource/,
	/^Request timeout /,
	/^Importing a module script failed/,
	/^Failed to fetch dynamically imported module/,
	/error loading dynamically imported module/,
	/^The string did not match the expected pattern\.$/,
	/WKWebView API client did not respond to this postMessage/,
	/is not defined$/,
	/el\.click is not a function/,
	/Cannot read properties of undefined \(reading '_source'\)/,
];

/** True for reports that are never actionable, so neither the database nor Discord sees them. */
export function isNoiseError(errorMessage: string, stackTrace: string | null): boolean {
	if (IGNORED_MESSAGE_PATTERNS.some(pattern => pattern.test(errorMessage))) return true;
	if (!stackTrace) return false;

	const [, topFrame = ''] = stackTrace.split('\n');
	if (INJECTED_TOP_FRAME_PATTERN.test(topFrame)) return true;

	return !APP_FRAME_PATTERN.test(stackTrace);
}
