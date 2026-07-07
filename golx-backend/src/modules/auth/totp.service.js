const crypto = require('node:crypto');
const env = require('../../config/env');
const { UnauthorizedError, BadRequestError } = require('../../shared/errors');
const { decryptText, encryptText } = require('../../shared/crypto-at-rest');
const BACKUP_CODE_BYTES = 10;

function loadTotpDependencies() {
    return {
        otplib: require('otplib'),
        QRCode: require('qrcode'),
    };
}

function issuerForRole(role) {
    if (role === 'admin') return 'Goalix Academy Admin';
    if (role === 'coach') return 'Goalix Academy Coach';
    return env.TOTP_ISSUER;
}

function labelForUser(user) {
    return user.email || user.username || user.phone || user.id;
}

function publicDevice(row) {
    return {
        id: row.id,
        deviceName: row.device_name,
        status: row.status,
        isPrimary: Boolean(row.is_primary),
        verifiedAt: row.verified_at,
        lastUsedAt: row.last_used_at,
        createdAt: row.created_at,
    };
}

function normalizeBackupCode(code) {
    return String(code || '').replace(/[\s-]/g, '').toLowerCase();
}

function formatBackupCode(rawCode) {
    return rawCode.match(/.{1,4}/g).join('-');
}

function backupCodeHash(code) {
    return crypto
        .createHmac('sha256', env.COOKIE_SECRET)
        .update(normalizeBackupCode(code))
        .digest('hex');
}

function legacyBackupCodeHash(code) {
    return crypto
        .createHash('sha256')
        .update(normalizeBackupCode(code))
        .digest('hex');
}

function backupCodeHashesForLookup(code) {
    return [...new Set([backupCodeHash(code), legacyBackupCodeHash(code)])];
}

function decryptTotpSecret(secret) {
    try {
        return decryptText(secret);
    } catch {
        return secret;
    }
}

function verifyTotpToken(verifySync, token, encryptedSecret) {
    const result = verifySync({
        token,
        secret: decryptTotpSecret(encryptedSecret),
        epochTolerance: 30,
    });
    return Boolean(result?.valid);
}

function generateBackupCodes() {
    const backupCodes = [];
    const codeHashes = [];
    for (let i = 0; i < 10; i++) {
        const code = formatBackupCode(crypto.randomBytes(BACKUP_CODE_BYTES).toString('hex'));
        backupCodes.push(code);
        codeHashes.push(backupCodeHash(code));
    }
    return { backupCodes, codeHashes };
}

class TotpService {
    constructor(authRepository) {
        this.repo = authRepository;
    }

    async setup(userId) {
        const user = await this.repo.findById(userId);
        if (!user) throw new UnauthorizedError('User not found');
        if (user.totp_enabled) throw new BadRequestError('2FA is already enabled');
        await this.repo.deletePendingTotpDevices(userId);

        const { otplib, QRCode } = loadTotpDependencies();
        const { generateSecret, generateURI } = otplib;
        const secret = generateSecret({ length: 20 });
        const encryptedSecret = encryptText(secret);
        await this.repo.setTotpSecret(userId, encryptedSecret);
        const device = await this.repo.createTotpDevice(userId, {
            deviceName: 'Primary device',
            secret: encryptedSecret,
            status: 'pending',
            isPrimary: true,
        });

        const otpauth = generateURI({
            label: labelForUser(user),
            issuer: issuerForRole(user.role),
            secret,
        });
        const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

        return { deviceId: device.id, deviceName: device.device_name, issuer: issuerForRole(user.role), secret, qrCode: qrCodeDataUrl };
    }

    async verifyAndEnable(userId, token) {
        const user = await this.repo.findById(userId);
        if (!user || !user.totp_secret) throw new BadRequestError('2FA setup not initiated');
        if (user.totp_enabled) throw new BadRequestError('2FA is already enabled');

        const { verifySync } = loadTotpDependencies().otplib;
        if (!verifyTotpToken(verifySync, token, user.totp_secret)) {
            throw new UnauthorizedError('Invalid TOTP code');
        }

        const pendingDevices = await this.repo.db('auth_totp_devices')
            .where({ user_id: userId, status: 'pending' })
            .whereNull('revoked_at')
            .orderBy('created_at', 'desc');
        if (pendingDevices[0]) {
            await this.repo.activateTotpDevice(userId, pendingDevices[0].id);
        }
        await this.repo.enableTotp(userId);

        const { backupCodes, codeHashes } = generateBackupCodes();

        await this.repo.deleteBackupCodes(userId);
        await this.repo.createBackupCodes(userId, codeHashes);

        return { backupCodes };
    }

    async verify(userId, token) {
        const user = await this.repo.findById(userId);
        if (!user || !user.totp_enabled || !user.totp_secret) {
            throw new UnauthorizedError('2FA is not enabled');
        }

        const { verifySync } = loadTotpDependencies().otplib;
        const devices = await this.repo.findActiveTotpDevices(userId);
        for (const device of devices) {
            if (verifyTotpToken(verifySync, token, device.secret)) {
                await this.repo.touchTotpDevice(device.id);
                return true;
            }
        }

        if (!verifyTotpToken(verifySync, token, user.totp_secret)) {
            throw new UnauthorizedError('Invalid TOTP code');
        }

        return true;
    }

    async listDevices(userId) {
        const devices = await this.repo.findActiveTotpDevices(userId);
        return devices.map(publicDevice);
    }

    async setupDevice(userId, { deviceName } = {}) {
        const user = await this.repo.findById(userId);
        if (!user) throw new UnauthorizedError('User not found');
        if (!user.totp_enabled) throw new BadRequestError('Enable 2FA before adding another device');
        const activeDevices = await this.repo.findActiveTotpDevices(userId);

        const { otplib, QRCode } = loadTotpDependencies();
        const { generateSecret, generateURI } = otplib;
        const secret = generateSecret({ length: 20 });
        const device = await this.repo.createTotpDevice(userId, {
            deviceName: deviceName || 'Authenticator app',
            secret: encryptText(secret),
            status: 'pending',
            isPrimary: activeDevices.length === 0,
        });

        const otpauth = generateURI({
            label: labelForUser(user),
            issuer: issuerForRole(user.role),
            secret,
        });
        const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

        return {
            deviceId: device.id,
            deviceName: device.device_name,
            issuer: issuerForRole(user.role),
            secret,
            qrCode: qrCodeDataUrl,
        };
    }

    async setupManagedDevice(userId, { deviceName, resetExisting = false } = {}) {
        const user = await this.repo.findById(userId);
        if (!user) throw new UnauthorizedError('User not found');
        if (!['admin', 'coach'].includes(user.role)) {
            throw new BadRequestError('Managed MFA setup is only available for admin and coach accounts');
        }

        if (resetExisting) {
            await this.disableWithoutPassword(userId);
        }

        const currentUser = resetExisting ? await this.repo.findById(userId) : user;
        if (!currentUser.totp_enabled) {
            const result = await this.setup(userId);
            if (deviceName) {
                await this.repo.db('auth_totp_devices')
                    .where({ id: result.deviceId, user_id: userId, status: 'pending' })
                    .update({ device_name: deviceName, updated_at: new Date() });
                result.deviceName = deviceName;
            }
            return result;
        }

        return this.setupDevice(userId, { deviceName });
    }

    async verifyManagedDevice(userId, deviceId, token) {
        const user = await this.repo.findById(userId);
        if (!user) throw new UnauthorizedError('User not found');
        if (!user.totp_enabled) {
            const pendingDevice = await this.repo.findTotpDeviceById(userId, deviceId);
            if (!pendingDevice || pendingDevice.status !== 'pending') {
                throw new BadRequestError('MFA device setup not found');
            }
            return this.verifyAndEnable(userId, token);
        }
        const device = await this.verifyDevice(userId, deviceId, token);
        return { device, backupCodes: [] };
    }

    async verifyDevice(userId, deviceId, token) {
        const device = await this.repo.findTotpDeviceById(userId, deviceId);
        if (!device || device.status !== 'pending') {
            throw new BadRequestError('MFA device setup not found');
        }

        const { verifySync } = loadTotpDependencies().otplib;
        if (!verifyTotpToken(verifySync, token, device.secret)) {
            throw new UnauthorizedError('Invalid TOTP code');
        }

        const activated = await this.repo.activateTotpDevice(userId, deviceId);
        return publicDevice(activated);
    }

    async revokeDevice(userId, deviceId) {
        const user = await this.repo.findById(userId);
        if (!user) throw new UnauthorizedError('User not found');
        const devices = await this.repo.findActiveTotpDevices(userId);
        const targetDevice = devices.find((device) => device.id === deviceId);
        if (!targetDevice) throw new BadRequestError('MFA device not found');

        const remainingDevices = devices.filter((device) => device.id !== deviceId);
        if (remainingDevices.length === 0) {
            throw new BadRequestError('At least one active MFA device is required');
        }

        const revoked = await this.repo.revokeTotpDevice(userId, deviceId);
        if (!revoked) throw new BadRequestError('MFA device not found');

        if (targetDevice.is_primary) {
            await this.repo.setPrimaryTotpDevice(userId, remainingDevices[0].id);
        }

        return publicDevice(revoked);
    }

    async verifyBackupCode(userId, code) {
        const backupCode = await this.repo.consumeUnusedBackupCode(
            userId,
            backupCodeHashesForLookup(code),
        );
        if (!backupCode) throw new UnauthorizedError('Invalid or already used backup code');
        return true;
    }

    async regenerateBackupCodes(userId, password) {
        const bcrypt = require('bcrypt');
        const user = await this.repo.findById(userId);
        if (!user || !user.totp_enabled) throw new UnauthorizedError('2FA is not enabled');

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) throw new UnauthorizedError('Invalid password');

        const { backupCodes, codeHashes } = generateBackupCodes();
        await this.repo.deleteBackupCodes(userId);
        await this.repo.createBackupCodes(userId, codeHashes);

        return { backupCodes };
    }

    async regenerateManagedBackupCodes(userId) {
        const user = await this.repo.findById(userId);
        if (!user) throw new UnauthorizedError('User not found');
        if (!user.totp_enabled) throw new UnauthorizedError('2FA is not enabled');
        if (!['admin', 'coach'].includes(user.role)) {
            throw new BadRequestError('Managed backup codes are only available for admin and coach accounts');
        }

        const { backupCodes, codeHashes } = generateBackupCodes();
        await this.repo.deleteBackupCodes(userId);
        await this.repo.createBackupCodes(userId, codeHashes);

        return { backupCodes };
    }

    async disable(userId, password) {
        const bcrypt = require('bcrypt');
        const user = await this.repo.findById(userId);
        if (!user) throw new UnauthorizedError('User not found');

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) throw new UnauthorizedError('Invalid password');

        await this.repo.disableTotp(userId);
        await this.repo.db('auth_totp_devices')
            .where({ user_id: userId })
            .whereNull('revoked_at')
            .update({
                status: 'revoked',
                revoked_at: new Date(),
                updated_at: new Date(),
            });
        await this.repo.deleteBackupCodes(userId);

        return { message: '2FA disabled successfully' };
    }

    async disableWithoutPassword(userId) {
        const user = await this.repo.findById(userId);
        if (!user) throw new UnauthorizedError('User not found');

        await this.repo.disableTotp(userId);
        await this.repo.db('auth_totp_devices')
            .where({ user_id: userId })
            .whereNull('revoked_at')
            .update({
                status: 'revoked',
                revoked_at: new Date(),
                updated_at: new Date(),
            });
        await this.repo.deleteBackupCodes(userId);

        return { message: '2FA disabled successfully' };
    }
}

module.exports = TotpService;
