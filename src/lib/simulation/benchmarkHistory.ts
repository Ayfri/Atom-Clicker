/** IndexedDB store for benchmark report history. */
import type { MilestoneHit, RunInsights, SimulationResult, SpikeEvent } from './types.js';

const DB_NAME = 'atom-clicker-benchmarks';
const DB_VERSION = 2;
const STORE_NAME = 'reports';

export interface BenchmarkReport {
	config: SimulationResult['config'];
	createdAt: number;
	durationMs: number;
	finalSnapshot: SimulationResult['snapshots'][number] | null;
	id: string;
	/** Absent on reports saved before it was kept. */
	insights?: RunInsights;
	milestoneCount: number;
	milestones: MilestoneHit[];
	name: string;
	snapshots: SimulationResult['snapshots'];
	spikes: SpikeEvent[];
	wasCompleted: boolean;
}

export interface BenchmarkReportSummary {
	config: SimulationResult['config'];
	createdAt: number;
	durationMs: number;
	finalAPS: number;
	finalAtoms: number;
	finalLevel: number;
	id: string;
	milestoneCount: number;
	name: string;
	wasCompleted: boolean;
}

let db: IDBDatabase | null = null;

function promisify<T>(request: IDBRequest<T>): Promise<T> {
	const { promise, reject, resolve } = Promise.withResolvers<T>();
	request.onerror = () => reject(request.error);
	request.onsuccess = () => resolve(request.result);
	return promise;
}

async function openDB(): Promise<IDBDatabase> {
	if (db) return db;

	const request = indexedDB.open(DB_NAME, DB_VERSION);
	request.onupgradeneeded = () => {
		if (request.result.objectStoreNames.contains(STORE_NAME)) return;
		const store = request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
		store.createIndex('createdAt', 'createdAt', { unique: false });
		store.createIndex('name', 'name', { unique: false });
	};
	db = await promisify(request);
	return db;
}

async function openStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
	return (await openDB()).transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

/** `result` must be plain data, IndexedDB's structured clone rejects Svelte proxies. */
export async function saveReport(result: SimulationResult, customName?: string): Promise<string> {
	const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
	const report: BenchmarkReport = {
		config: result.config,
		createdAt: Date.now(),
		durationMs: result.durationMs,
		finalSnapshot: result.snapshots.at(-1) ?? null,
		id,
		insights: result.insights,
		milestoneCount: result.milestones.length,
		milestones: result.milestones,
		name: customName || `${result.config.name} - ${new Date().toLocaleString()}`,
		snapshots: result.snapshots,
		spikes: result.spikes,
		wasCompleted: !result.cancelled,
	};

	await promisify((await openStore('readwrite')).add(report));
	return id;
}

export async function listReports(): Promise<BenchmarkReportSummary[]> {
	const request = (await openStore('readonly')).index('createdAt').openCursor(null, 'prev');
	const { promise, reject, resolve } = Promise.withResolvers<BenchmarkReportSummary[]>();
	const summaries: BenchmarkReportSummary[] = [];

	request.onerror = () => reject(request.error);
	request.onsuccess = () => {
		const cursor = request.result;
		if (!cursor) return resolve(summaries);

		const report: BenchmarkReport = cursor.value;
		summaries.push({
			config: report.config,
			createdAt: report.createdAt,
			durationMs: report.durationMs,
			finalAPS: report.finalSnapshot?.atomsPerSecond ?? 0,
			finalAtoms: report.finalSnapshot?.atoms ?? 0,
			finalLevel: report.finalSnapshot?.playerLevel ?? 0,
			id: report.id,
			milestoneCount: report.milestoneCount,
			name: report.name,
			wasCompleted: report.wasCompleted,
		});
		cursor.continue();
	};
	return promise;
}

export async function getReport(id: string): Promise<BenchmarkReport | null> {
	return (await promisify((await openStore('readonly')).get(id))) ?? null;
}

export async function deleteReport(id: string): Promise<void> {
	await promisify((await openStore('readwrite')).delete(id));
}

export async function renameReport(id: string, newName: string): Promise<void> {
	const report = await getReport(id);
	if (!report) return;

	report.name = newName;
	await promisify((await openStore('readwrite')).put(report));
}

export async function clearAllReports(): Promise<void> {
	await promisify((await openStore('readwrite')).clear());
}
