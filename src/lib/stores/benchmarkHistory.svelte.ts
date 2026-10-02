/** IndexedDB store for benchmark report history. */
import type { MilestoneHit, SimulationResult, SpikeEvent } from '#lib/simulation/types.js';

const DB_NAME = 'atom-clicker-benchmarks';
const DB_VERSION = 2;
const STORE_NAME = 'reports';

export interface BenchmarkReport {
	config: SimulationResult['config'];
	createdAt: number;
	durationMs: number;
	finalSnapshot: SimulationResult['snapshots'][number] | null;
	id: string;
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

async function openDB(): Promise<IDBDatabase> {
	if (db) return db;

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			db = request.result;
			resolve(db);
		};

		request.onupgradeneeded = event => {
			const database = (event.target as IDBOpenDBRequest).result;

			if (!database.objectStoreNames.contains(STORE_NAME)) {
				const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
				store.createIndex('createdAt', 'createdAt', { unique: false });
				store.createIndex('name', 'name', { unique: false });
			}
		};
	});
}

function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** `result` must be plain data, IndexedDB's structured clone rejects Svelte proxies. */
export async function saveReport(result: SimulationResult, customName?: string): Promise<string> {
	const database = await openDB();
	const id = generateId();

	const finalSnapshot = result.snapshots.at(-1) ?? null;
	const report: BenchmarkReport = {
		config: result.config,
		createdAt: Date.now(),
		durationMs: result.durationMs,
		finalSnapshot,
		id,
		milestoneCount: result.milestones.length,
		milestones: result.milestones,
		name: customName || `${result.config.name} - ${new Date().toLocaleString()}`,
		snapshots: result.snapshots,
		spikes: result.spikes,
		wasCompleted: !result.cancelled,
	};

	return new Promise((resolve, reject) => {
		const transaction = database.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.add(report);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(id);
	});
}

export async function listReports(): Promise<BenchmarkReportSummary[]> {
	const database = await openDB();

	return new Promise((resolve, reject) => {
		const transaction = database.transaction(STORE_NAME, 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		const index = store.index('createdAt');
		const request = index.openCursor(null, 'prev');

		const summaries: BenchmarkReportSummary[] = [];

		request.onerror = () => reject(request.error);
		request.onsuccess = event => {
			const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
			if (cursor) {
				const report = cursor.value as BenchmarkReport;
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
			} else {
				resolve(summaries);
			}
		};
	});
}

export async function getReport(id: string): Promise<BenchmarkReport | null> {
	const database = await openDB();

	return new Promise((resolve, reject) => {
		const transaction = database.transaction(STORE_NAME, 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.get(id);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result ?? null);
	});
}

export async function deleteReport(id: string): Promise<void> {
	const database = await openDB();

	return new Promise((resolve, reject) => {
		const transaction = database.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.delete(id);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}

export async function renameReport(id: string, newName: string): Promise<void> {
	const database = await openDB();
	const report = await getReport(id);
	if (!report) return;

	report.name = newName;

	return new Promise((resolve, reject) => {
		const transaction = database.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.put(report);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}

export async function clearAllReports(): Promise<void> {
	const database = await openDB();

	return new Promise((resolve, reject) => {
		const transaction = database.transaction(STORE_NAME, 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const request = store.clear();

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}
