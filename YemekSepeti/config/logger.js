/**
 * Log rotasyonu: Günlük dosyalar, en fazla 14 gün saklanır.
 * SQL injection önlemi: Uygulama kodu Sequelize ORM kullanıyor; ham SQL yazılacaksa
 * mutlaka sequelize.query(sql, { replacements: {...} }) ile parametre binding kullanılmalı.
 */
const path = require('path');
const fs = require('fs');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logsDir = path.resolve(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    try { fs.mkdirSync(logsDir, { recursive: true }); } catch (err) {}
}

const transport = new DailyRotateFile({
    dirname: logsDir,
    filename: 'app-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
            return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
        })
    )
});

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
            return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
        })
    ),
    transports: [transport]
});

function writeLog(level, message, data = null) {
    const meta = data && typeof data === 'object' ? data : (data ? { data } : {});
    logger.log(level.toLowerCase(), message, meta);
    if (level === 'ERROR') {
        console.error(`[${new Date().toISOString()}] ${message}`, data || '');
    } else if (level === 'WARN') {
        console.warn(`[${new Date().toISOString()}] ${message}`, data || '');
    }
}

module.exports = { writeLog, logger };
