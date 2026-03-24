const { Sequelize } = require('sequelize');
require('dotenv').config();

const isCloudDB = process.env.DB_HOST && (process.env.DB_HOST.includes('aivencloud.com') || process.env.DB_SSL === 'true');

const sslConfig = isCloudDB ? {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2',
    ...(process.env.DB_CA_PATH ? { ca: require('fs').readFileSync(process.env.DB_CA_PATH) } : {})
} : false;

const sequelize = new Sequelize(
    process.env.DB_NAME || 'yemek_sepeti',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        dialect: 'mysql',
        dialectOptions: {
            ssl: sslConfig,
            charset: 'utf8mb4'
        },
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        logging: false,
        timezone: '+00:00',
        define: {
            charset: 'utf8mb4',
            collate: 'utf8mb4_unicode_ci',
            timestamps: true,
            underscored: false
        }
    }
);

async function testConnection() {
    try {
        await sequelize.authenticate();
        return true;
    } catch (error) {
        return false;
    }
}

/** MySQL/TiDB ENUM güncellemesi (iyzico ödeme yöntemi). Başarısız olursa sessiz geçilir. */
async function ensureOrderPaymentMethodEnum() {
    try {
        await sequelize.query(
            `ALTER TABLE orders MODIFY COLUMN payment_method ENUM('credit_card','cash','wallet','iyzico') NOT NULL`
        );
    } catch (e) {
        // Sütun zaten güncel, farklı tip veya yetki — uygulama yine de çalışsın
    }
}

module.exports = {
    sequelize,
    testConnection,
    ensureOrderPaymentMethodEnum
};
