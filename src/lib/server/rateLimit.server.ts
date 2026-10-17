/** Per-isolate on Workers, so this is a best-effort throttle rather than a hard limit. */
export class RateLimiter {
	private readonly hits = new Map<string, number[]>();

	constructor(
		private readonly windowMs: number,
		private readonly max: number,
		private readonly maxKeys = 10_000,
	) {}

	/** Records a hit for the key and says whether it went over `max` within the last `windowMs`. */
	limited(key: string): boolean {
		const now = Date.now();
		const timestamps = (this.hits.get(key) ?? []).filter(timestamp => now - timestamp < this.windowMs);
		if (timestamps.length >= this.max) return true;

		if (this.hits.size >= this.maxKeys) this.hits.clear();
		timestamps.push(now);
		this.hits.set(key, timestamps);
		return false;
	}
}
