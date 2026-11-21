/// <reference lib="webworker" />
import { SimulationEngine } from './engine.js';
import type { BenchmarkConfig } from './types.js';

self.onmessage = (event: MessageEvent<BenchmarkConfig>) => {
	try {
		const result = new SimulationEngine(event.data).run(progress => self.postMessage({ payload: progress, type: 'progress' }));
		self.postMessage({ payload: result, type: 'result' });
	} catch (error) {
		console.error('Simulation Worker Error:', error);
		self.postMessage({ payload: error instanceof Error ? error.message : String(error), type: 'error' });
	}
};
