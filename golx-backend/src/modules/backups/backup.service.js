const bcrypt = require('bcrypt');
const path = require('node:path');

const env = require('../../config/env');
const {
    createPostgresBackup,
    listPostgresBackups,
    prunePostgresBackups,
    restorePostgresBackup,
} = require('../../shared/postgres-backup');
const { AppError, BadRequestError, ForbiddenError, UnauthorizedError } = require('../../shared/errors');

const RESTORE_CONFIRMATION = 'RESTORE GOALIX';

function publicBackup(backup) {
    const safeBackup = { ...backup };
    delete safeBackup.filePath;
    return safeBackup;
}

class BackupService {
    constructor(db) {
        this.db = db;
        this.backupRunning = false;
        this.restoreRunning = false;
    }

    get backupDir() {
        return path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), 'backups'));
    }

    get restoreEnabled() {
        return env.NODE_ENV !== 'production' || env.BACKUP_RESTORE_ENABLED === true;
    }

    async getStatus() {
        const backups = await this.listBackups();
        return {
            backupDir: this.backupDir,
            automaticEnabled: env.BACKUP_AUTOMATION_ENABLED === true,
            intervalMinutes: env.BACKUP_INTERVAL_MINUTES,
            retentionDays: env.BACKUP_RETENTION_DAYS,
            restoreEnabled: this.restoreEnabled,
            restoreConfirmation: RESTORE_CONFIRMATION,
            latestBackup: backups[0] || null,
            backups,
        };
    }

    async listBackups() {
        return listPostgresBackups(this.backupDir);
    }

    async createBackup({ label = 'manual' } = {}) {
        if (this.backupRunning) {
            throw new AppError('A database backup is already running', 409, 'BACKUP_ALREADY_RUNNING');
        }

        this.backupRunning = true;
        try {
            const backup = await createPostgresBackup({
                databaseUrl: env.DATABASE_URL,
                backupDir: this.backupDir,
                label,
            });
            await prunePostgresBackups(this.backupDir, env.BACKUP_RETENTION_DAYS);
            return publicBackup(backup);
        } finally {
            this.backupRunning = false;
        }
    }

    async createScheduledBackupIfDue() {
        const backups = await this.listBackups();
        const latest = backups[0];
        const intervalMs = env.BACKUP_INTERVAL_MINUTES * 60 * 1000;
        if (latest && Date.now() - new Date(latest.createdAt).getTime() < intervalMs) {
            return { skipped: true, reason: 'latest_backup_is_still_fresh', latestBackup: latest };
        }

        const backup = await this.createBackup({ label: 'auto' });
        return { skipped: false, backup };
    }

    async assertAdminPassword(userId, password) {
        if (!password) throw new BadRequestError('Admin password is required');
        const user = await this.db('auth_users')
            .where({ id: userId, role: 'admin', is_active: true })
            .whereNull('deleted_at')
            .first();
        if (!user) throw new ForbiddenError('Only active admins can restore database backups');

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) throw new UnauthorizedError('Invalid admin password');
    }

    async restoreBackup({ fileName, password, confirmation, userId }) {
        if (!this.restoreEnabled) {
            throw new AppError(
                'Database restore is disabled on this server. Set BACKUP_RESTORE_ENABLED=true to allow it.',
                403,
                'BACKUP_RESTORE_DISABLED',
            );
        }
        if (this.restoreRunning) {
            throw new AppError('A database restore is already running', 409, 'RESTORE_ALREADY_RUNNING');
        }
        if (confirmation !== RESTORE_CONFIRMATION) {
            throw new BadRequestError(`Type ${RESTORE_CONFIRMATION} to confirm database restore`);
        }

        await this.assertAdminPassword(userId, password);

        this.restoreRunning = true;
        try {
            const safetyBackup = await this.createBackup({ label: 'pre_restore' });
            const restored = await restorePostgresBackup({
                databaseUrl: env.DATABASE_URL,
                backupDir: this.backupDir,
                fileName,
            });
            return { ...restored, safetyBackup };
        } finally {
            this.restoreRunning = false;
        }
    }
}

module.exports = BackupService;
