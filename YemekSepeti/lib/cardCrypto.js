const crypto = require('crypto');

function getKey() {
    const raw = process.env.CARD_ENCRYPTION_KEY || process.env.JWT_SECRET || '';
    return crypto.createHash('sha256').update(String(raw)).digest();
}

function encryptText(plain) {
    if (!plain) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptText(payload) {
    if (!payload || typeof payload !== 'string') return null;
    const parts = payload.split(':');
    if (parts.length !== 3) return null;
    const [ivHex, tagHex, dataHex] = parts;
    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        const out = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
        return out.toString('utf8');
    } catch (_) {
        return null;
    }
}

module.exports = { encryptText, decryptText };
