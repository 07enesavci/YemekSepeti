const crypto = require('crypto');

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';
const PBKDF2_SALT = 'ys-card-encryption-salt-v2';

function deriveKeyPBKDF2(rawSecret) {
    return crypto.pbkdf2Sync(
        String(rawSecret),
        PBKDF2_SALT,
        PBKDF2_ITERATIONS,
        PBKDF2_KEYLEN,
        PBKDF2_DIGEST
    );
}

function deriveKeyLegacy(rawSecret) {
    return crypto.createHash('sha256').update(String(rawSecret)).digest();
}

function getRawSecret() {
    return process.env.CARD_ENCRYPTION_KEY || process.env.JWT_SECRET || '';
}

function encryptText(plain) {
    if (!plain) return null;
    const raw = getRawSecret();
    const key = deriveKeyPBKDF2(raw);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v2:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptText(payload) {
    if (!payload || typeof payload !== 'string') return null;
    const raw = getRawSecret();

    if (payload.startsWith('v2:')) {
        const parts = payload.slice(3).split(':');
        if (parts.length !== 3) return null;
        const [ivHex, tagHex, dataHex] = parts;
        try {
            const key = deriveKeyPBKDF2(raw);
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
            decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
            const out = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
            return out.toString('utf8');
        } catch (_) {
            return null;
        }
    }

    // Geriye dönük uyumluluk: eski SHA-256 tabanlı şifreli veriler
    const parts = payload.split(':');
    if (parts.length !== 3) return null;
    const [ivHex, tagHex, dataHex] = parts;
    try {
        const key = deriveKeyLegacy(raw);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        const out = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
        return out.toString('utf8');
    } catch (_) {
        return null;
    }
}

module.exports = { encryptText, decryptText };
