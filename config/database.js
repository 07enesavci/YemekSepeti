const mysql = require('mysql2/promise');
require('dotenv').config();

// ============================================
// VERİTABANI BAĞLANTI AYARLARI
// ============================================

// Bulut veritabanı için SSL yapılandırması
// Aiven Cloud SSL zorunludur - insecure transport yasaktır
// Aiven Cloud host kontrolü yaparak otomatik SSL aktif et
const isCloudDB = process.env.DB_HOST && 
                  (process.env.DB_HOST.includes('aivencloud.com') || 
                   process.env.DB_SSL === 'true');

const sslConfig = isCloudDB ? {
    // Aiven Cloud için SSL zorunlu - rejectUnauthorized: false kullanıyoruz
    // çünkü Aiven Cloud'un kendi sertifikası var ve genellikle self-signed
    rejectUnauthorized: false,
    // SSL modunu açıkça belirt
    minVersion: 'TLSv1.2',
    // CA sertifikası yolu (opsiyonel)
    ...(process.env.DB_CA_PATH ? { ca: require('fs').readFileSync(process.env.DB_CA_PATH) } : {})
} : false;

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'yemek_sepeti',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    connectTimeout: 30000, 
    ssl: sslConfig, // SSL desteği 
    timezone: '+00:00', // UTC timezone
    dateStrings: false
};

// Connection pool oluştur
const pool = mysql.createPool(dbConfig);

// ============================================
// BAĞLANTI TEST FONKSİYONU
// ============================================

async function testConnection() {
    try {
        const connection = await pool.getConnection();
        const dbType = process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? 'Bulut' : 'Yerel';
        console.log(`✅ ${dbType} veritabanına başarıyla bağlandı!`);
        console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
        console.log(`   Database: ${dbConfig.database}`);
        connection.release();
        return true;
    } catch (error) {
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('❌ Veritabanı bağlantı hatası: Kullanıcı adı veya şifre hatalı.');
            console.log('💡 Çözüm: .env dosyasında DB_USER ve DB_PASSWORD değerlerini kontrol edin.');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('❌ Veritabanı bağlantı hatası: Sunucuya bağlanılamıyor.');
            console.log('💡 Çözüm:');
            console.log('   - .env dosyasında DB_HOST ve DB_PORT değerlerini kontrol edin');
            console.log('   - Firewall ayarlarını kontrol edin');
            console.log('   - Bulut veritabanının çalıştığından emin olun');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.error('❌ Veritabanı bağlantı hatası: Veritabanı bulunamadı.');
            console.log('💡 Çözüm: Veritabanını oluşturun veya .env dosyasında DB_NAME değerini kontrol edin.');
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
            console.error('❌ Veritabanı bağlantı hatası: Sunucu bulunamadı veya zaman aşımı.');
            console.log('💡 Çözüm:');
            console.log('   - .env dosyasında DB_HOST değerini kontrol edin');
            console.log('   - İnternet bağlantınızı kontrol edin');
            console.log('   - Bulut veritabanı panelinden bağlantı bilgilerini doğrulayın');
        } else if (error.message && error.message.includes('insecure transport')) {
            console.error('❌ Veritabanı bağlantı hatası: SSL bağlantısı zorunlu!');
            console.log('💡 Çözüm:');
            console.log('   - .env dosyasında DB_SSL=true olduğundan emin olun');
            console.log('   - Aiven Cloud SSL bağlantısı zorunludur');
            console.log('   - Veritabanı yapılandırmasını kontrol edin');
        } else {
            console.error('❌ Veritabanı bağlantı hatası:', error.message);
            console.error('   Hata Kodu:', error.code);
        }
        console.log('⚠️  Mock (bellekte) veritabanı kullanılacak. Sistem normal çalışmaya devam edecek.');
        return false;
    }
}

// ============================================
// YARDIMCI FONKSİYONLAR
// ============================================

/**
 * SQL sorgusu çalıştır (SELECT için)
 */
async function query(sql, params = []) {
    try {
        const [rows] = await pool.execute(sql, params);
        return rows;
    } catch (error) {
        // Veritabanı bağlantısı yoksa mock'a dön
        if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ER_BAD_DB_ERROR') {
            console.error('SQL Query Hatası (Mock veritabanına dönülüyor):', error.message);
            return []; // Boş array döndür
        }
        console.error('SQL Query Hatası:', error.message);
        throw error;
    }
}

/**
 * SQL sorgusu çalıştır (INSERT, UPDATE, DELETE için)
 */
async function execute(sql, params = []) {
    try {
        const [result] = await pool.execute(sql, params);
        return result;
    } catch (error) {
        // Veritabanı bağlantısı yoksa mock'a dön
        if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ER_BAD_DB_ERROR') {
            console.error('SQL Execute Hatası (Mock veritabanına dönülüyor):', error.message);
            return { insertId: 0, affectedRows: 0 }; // Mock sonuç döndür
        }
        console.error('SQL Execute Hatası:', error.message);
        throw error;
    }
}

// Sequelize'i de export et (yeni kodlar için)
const { sequelize: sequelizeInstance, testConnection: sequelizeTestConnection } = require('./sequelize');
const dbModels = require('../models');

module.exports = {
    // Eski mysql2 metodları (geriye dönük uyumluluk için)
    pool,
    testConnection,
    query,
    execute,
    // Yeni Sequelize instance ve modelleri
    sequelize: sequelizeInstance,
    sequelizeTestConnection,
    models: dbModels
};

