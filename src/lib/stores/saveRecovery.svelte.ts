import { keys, removeItem, setItem } from '#lib/utils/safeLocalStorage.js';

export type SaveErrorType = 'corrupted' | 'invalid_json' | 'migration_failed' | 'validation_failed' | 'unknown';

const BACKUP_PREFIX = 'atomic-clicker-backup-';
const KEPT_BACKUPS = 3;

class SaveRecovery {
	backupKey = $state<string | null>(null);
	errorDetails = $state<string | null>(null);
	errorType = $state<SaveErrorType | null>(null);
	hasError = $state(false);

	/** The unreadable save is copied to a timestamped key first, the game overwrites the main one on its next save. */
	setError(errorType: SaveErrorType, errorDetails: string, rawSaveData: string | null = null) {
		this.backupKey = rawSaveData ? `${BACKUP_PREFIX}${Date.now()}` : null;
		if (this.backupKey && rawSaveData) setItem(this.backupKey, rawSaveData);
		this.errorDetails = errorDetails;
		this.errorType = errorType;
		this.hasError = true;
	}

	clearError() {
		this.backupKey = null;
		this.errorDetails = null;
		this.errorType = null;
		this.hasError = false;
	}

	cleanOldBackups() {
		const backups = keys()
			.filter(key => key.startsWith(BACKUP_PREFIX))
			.map(key => ({ key, time: Number.parseInt(key.slice(BACKUP_PREFIX.length)) }))
			.filter(backup => !Number.isNaN(backup.time))
			.sort((a, b) => b.time - a.time);
		for (const { key } of backups.slice(KEPT_BACKUPS)) removeItem(key);
	}
}

export const saveRecovery = new SaveRecovery();
