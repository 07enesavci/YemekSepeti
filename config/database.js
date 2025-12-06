const mysql = require('mysql2/promise');
require('dotenv').config();

// ============================================
// VERİTABANI BAĞLANTI AYARLARI
// ============================================

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'yemek_sepeti',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    // Bağlantı hatası durumunda daha açıklayıcı mesaj
    connectTimeout: 5000
};

// Connection pool oluştur
const pool = mysql.createPool(dbConfig);

// ============================================
// BAĞLANTI TEST FONKSİYONU
// ============================================

async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ MySQL veritabanına başarıyla bağlandı!');
        connection.release();
        return true;
    } catch (error) {
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('❌ MySQL bağlantı hatası: Kullanıcı adı veya şifre hatalı.');
            console.log('💡 Çözüm: .env dosyasında DB_PASSWORD değerini kontrol edin.');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('❌ MySQL bağlantı hatası: MySQL servisi çalışmıyor.');
            console.log('💡 Çözüm: MySQL servisini başlatın veya XAMPP/WAMP kullanıyorsanız kontrol edin.');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.error('❌ MySQL bağlantı hatası: Veritabanı bulunamadı.');
            console.log('💡 Çözüm: database/yemek_sepeti.sql dosyasını çalıştırarak veritabanını oluşturun.');
        } else {
            console.error('❌ MySQL bağlantı hatası:', error.message);
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

module.exports = {
    pool,
    testConnection,
    query,
    execute
};

