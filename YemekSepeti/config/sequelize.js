const { Sequelize } = require('sequelize');
require('dotenv').config();

// Bulut veritabanı için SSL yapılandırması
// Aiven Cloud SSL zorunludur
const isCloudDB = process.env.DB_HOST && 
                  (process.env.DB_HOST.includes('aivencloud.com') || 
                   process.env.DB_SSL === 'true');

const sslConfig = isCloudDB ? {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2',
    ...(process.env.DB_CA_PATH ? { ca: require('fs').readFileSync(process.env.DB_CA_PATH) } : {})
} : false;

// Sequelize instance oluştur
const sequelize = new Sequelize(
    process.env.DB_NAME || 'yemek_sepeti',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        dialect: 'mysql',
        dialectOptions: {
            ssl: sslConfig ? {
                rejectUnauthorized: false,
                minVersion: 'TLSv1.2',
                ...(process.env.DB_CA_PATH ? { ca: require('fs').readFileSync(process.env.DB_CA_PATH) } : {})
            } : false,
            charset: 'utf8mb4',
            collate: 'utf8mb4_unicode_ci'
        },
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        timezone: '+00:00', // UTC
        define: {
            charset: 'utf8mb4',
            collate: 'utf8mb4_unicode_ci',
            timestamps: true,
            underscored: false
        }
    }
);

// Bağlantı testi
async function testConnection() {
    try {
        await sequelize.authenticate();
        const dbType = process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? 'Bulut' : 'Yerel';
        console.log(`✅ ${dbType} veritabanına başarıyla bağlandı! (Sequelize)`);
        console.log(`   Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);
        console.log(`   Database: ${process.env.DB_NAME || 'yemek_sepeti'}`);
        return true;
    } catch (error) {
        console.error('❌ Veritabanı bağlantı hatası:', error.message);
        return false;
    }
}

module.exports = {
    sequelize,
    testConnection
};

