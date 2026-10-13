/** Counts streamed bytes, a chunked upload sends no Content-Length. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<{ body: unknown } | { error: Response }> {
	const tooLarge = { error: Response.json({ error: 'Payload too large' }, { status: 413 }) };
	if (Number(request.headers.get('content-length')) > maxBytes) return tooLarge;

	let text = '';
	if (request.body) {
		const reader = request.body.getReader();
		const decoder = new TextDecoder();
		let size = 0;
		for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
			size += chunk.value.byteLength;
			if (size > maxBytes) {
				await reader.cancel();
				return tooLarge;
			}
			text += decoder.decode(chunk.value, { stream: true });
		}
		text += decoder.decode();
	}

	try {
		return { body: JSON.parse(text) };
	} catch {
		return { error: Response.json({ error: 'Invalid JSON' }, { status: 400 }) };
	}
}
