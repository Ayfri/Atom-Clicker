import { getItem, keys, removeItem, setItem } from '$lib/utils/safeLocalStorage';
import { writable } from 'svelte/store';

export type SaveErrorType = 'corrupted' | 'invalid_json' | 'migration_failed' | 'validation_failed' | 'unknown';

interface SaveRecoveryState {
	hasError: boolean;
	backupKey: string | null;
	cloudSaveAvailable: boolean;
	errorDetails: string | null;
	errorType: SaveErrorType | null;
	rawSaveData: string | null;
}

const initialState: SaveRecoveryState = {
	backupKey: null,
	cloudSaveAvailable: false,
	errorDetails: null,
	errorType: null,
	hasError: false,
	rawSaveData: null,
};

function createSaveRecoveryStore() {
	const { subscribe, set, update } = writable<SaveRecoveryState>(initialState);

	return {
		subscribe,

		setError(errorType: SaveErrorType, errorDetails: string, rawSaveData: string | null = null) {
			const backupKey = rawSaveData ? `atomic-clicker-backup-${Date.now()}` : null;

			// Save backup if we have raw data
			if (backupKey && rawSaveData && setItem(backupKey, rawSaveData)) {
				console.log(`Backup saved to: ${backupKey}`);
			}

			update(state => ({
				...state,
				backupKey,
				errorDetails,
				errorType,
				hasError: true,
				rawSaveData,
			}));
		},

		setCloudSaveAvailable(available: boolean) {
			update(state => ({
				...state,
				cloudSaveAvailable: available,
			}));
		},

		clearError() {
			set(initialState);
		},

		// Attempt to recover a backup
		getBackupData(backupKey: string): string | null {
			return getItem(backupKey);
		},

		// List all backups
		listBackups(): { key: string; date: Date }[] {
			const backups: { key: string; date: Date }[] = [];
			for (const key of keys()) {
				if (!key.startsWith('atomic-clicker-backup-')) continue;
				const timestamp = parseInt(key.replace('atomic-clicker-backup-', ''));
				if (!isNaN(timestamp)) {
					backups.push({ key, date: new Date(timestamp) });
				}
			}
			return backups.sort((a, b) => b.date.getTime() - a.date.getTime());
		},

		// Clean old backups (keep last 3)
		cleanOldBackups() {
			const backups = this.listBackups();
			const toDelete = backups.slice(3);
			for (const backup of toDelete) {
				removeItem(backup.key);
			}
		}
	};
}

export const saveRecovery = createSaveRecoveryStore();

