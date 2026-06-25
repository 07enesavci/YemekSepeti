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

/**
 * Eski veritabanlarinda orders.delivery_type kolonu olmadiginda siparis olusturma 500 verir.
 * Pickup akisinin da sorunsuz calismasi icin address_id nullable olacak sekilde korunur.
 */
async function ensureOrderDeliveryTypeColumn() {
    try {
        await sequelize.query(
            `ALTER TABLE orders MODIFY COLUMN address_id INT DEFAULT NULL`
        );
    } catch (_) {}

    try {
        await sequelize.query(
            `ALTER TABLE orders ADD COLUMN delivery_type ENUM('delivery','pickup','cargo') NOT NULL DEFAULT 'delivery' AFTER address_id`
        );
    } catch (_) {}

    // Kolon zaten varsa yukarıdaki ADD sessizce başarısız olur (kolon mevcut) ve eski ENUM tanımı
    // ('cargo' içermeyen) kalır — modeldeki (models/Order.js) üç değerle senkron tutmak için her
    // başlangıçta ENUM'u genişlet. Aksi halde delivery_type='cargo' ile sipariş oluşturma
    // "Data truncated for column 'delivery_type'" hatasıyla 500 döner (şema sürüklenmesi düzeltmesi).
    try {
        await sequelize.query(
            `ALTER TABLE orders MODIFY COLUMN delivery_type ENUM('delivery','pickup','cargo') NOT NULL DEFAULT 'delivery'`
        );
    } catch (_) {}
}

/** Kapıda ödeme alt seçeneği (nakit/kart) */
async function ensureOrderCashPaymentMethodColumn() {
    try {
        await sequelize.query(
            `ALTER TABLE orders ADD COLUMN cash_payment_method ENUM('cash','card') NULL AFTER payment_method`
        );
    } catch (_) {}
    try {
        await sequelize.query(
            `ALTER TABLE orders MODIFY COLUMN cash_payment_method ENUM('cash','card') NULL`
        );
    } catch (_) {}
}

/**
 * meals.is_approved sütununun varlığını ve NOT NULL + DEFAULT 0 olmasını garanti eder.
 * Önce ADD (sütun yoksa); MODIFY yalnızca mevcut sütun için anlamlıdır — eski kodda
 * sadece MODIFY kullanıldığı için sütun hiç yokken hata yutuluyor ve public menü 500 veriyordu.
 */
async function ensureMealIsApprovedColumn() {
    let added = false;
    try {
        await sequelize.query(
            `ALTER TABLE meals ADD COLUMN is_approved TINYINT(1) NOT NULL DEFAULT 0`
        );
        added = true;
    } catch (e) {
        const msg = String(e.message || '');
        const errno = e.parent && e.parent.errno;
        const dup = msg.includes('Duplicate column') || errno === 1060;
        if (!dup) {
            // Tablo yok vb. — MODIFY da muhtemelen başarısız olur
        }
    }
    if (added) {
        try {
            // Sütun yeni eklendiyse: daha önce eklenmiş satırlar alıcı menüsünde görünsün
            await sequelize.query(`UPDATE meals SET is_approved = 1`);
        } catch (_) {}
    }
    try {
        await sequelize.query(
            `ALTER TABLE meals MODIFY COLUMN is_approved TINYINT(1) NOT NULL DEFAULT 0`
        );
    } catch (_) {}
}

async function ensurePaymentCardsEncryptionColumns() {
    try {
        await sequelize.query(`ALTER TABLE payment_cards ADD COLUMN card_number_encrypted TEXT NULL`);
    } catch (_) {}
    try {
        await sequelize.query(`ALTER TABLE payment_cards ADD COLUMN card_cvc_encrypted TEXT NULL`);
    } catch (_) {}
}

/**
 * sellers.is_open (mağaza açık/kapalı) — modelde var; eski DB'lerde sütun yoksa admin all-sellers 500 veriyordu.
 */
async function ensureSellerIsOpenColumn() {
    try {
        await sequelize.query(
            `ALTER TABLE sellers ADD COLUMN is_open TINYINT(1) NOT NULL DEFAULT 1`
        );
    } catch (_) {}
    try {
        await sequelize.query(
            `ALTER TABLE sellers MODIFY COLUMN is_open TINYINT(1) NOT NULL DEFAULT 1`
        );
    } catch (_) {}
}

/**
 * Modelde olan teslimat/konum alanları eski veritabanlarında yoksa INSERT 500 verir (submit-documents-json).
 */
async function ensureSellerGeoColumns() {
    const alters = [
        `ALTER TABLE sellers ADD COLUMN delivery_radius_km INT NOT NULL DEFAULT 0`,
        `ALTER TABLE sellers ADD COLUMN latitude DECIMAL(10,8) NULL`,
        `ALTER TABLE sellers ADD COLUMN longitude DECIMAL(11,8) NULL`
    ];
    for (const sql of alters) {
        try {
            await sequelize.query(sql);
        } catch (_) {}
    }
}

/**
 * APPROVE_ALL_SELLERS_ON_STARTUP=true iken tüm satıcıları onaylı ve açık işaretler (partner girişi / admin liste).
 * Kapatmak için .env: APPROVE_ALL_SELLERS_ON_STARTUP=false
 */
async function ensureSellerPickupEnabledColumn() {
    try {
        await sequelize.query(
            `ALTER TABLE sellers ADD COLUMN pickup_enabled TINYINT(1) NOT NULL DEFAULT 1`
        );
    } catch (_) {}
    try {
        await sequelize.query(
            `ALTER TABLE sellers MODIFY COLUMN pickup_enabled TINYINT(1) NOT NULL DEFAULT 1`
        );
    } catch (_) {}
}

async function approveAllSellersOnStartupIfEnabled() {
    // Varsayılan: KAPALI. Yalnızca env'de açıkça 'true' yazılırsa çalışır.
    // UYARI: Bu özellik yalnızca geliştirme/test ortamları için tasarlanmıştır.
    // Üretim ortamında APPROVE_ALL_SELLERS_ON_STARTUP=true kullanmayın.
    if (process.env.APPROVE_ALL_SELLERS_ON_STARTUP !== 'true') return;
    if (process.env.NODE_ENV === 'production') {
        console.warn('[SECURITY] APPROVE_ALL_SELLERS_ON_STARTUP=true üretim ortamında tehlikelidir! Devre dışı bırakıldı.');
        return;
    }
    try {
        await sequelize.query(`UPDATE sellers SET is_active = 1`);
        try {
            await sequelize.query(`UPDATE sellers SET is_open = 1`);
        } catch (_) {}
        console.warn('[DEV] Tüm satıcılar otomatik onaylandı (APPROVE_ALL_SELLERS_ON_STARTUP=true)');
    } catch (_) {}
}

async function ensureSellerOwnCouriersColumn() {
    try {
        await sequelize.query(
            `ALTER TABLE sellers ADD COLUMN has_own_couriers TINYINT(1) NOT NULL DEFAULT 0`
        );
    } catch (_) {}
    try {
        await sequelize.query(
            `ALTER TABLE sellers MODIFY COLUMN has_own_couriers TINYINT(1) NOT NULL DEFAULT 0`
        );
    } catch (_) {}
}

async function ensureCourierSellerIdColumn() {
    try {
        await sequelize.query(
            `ALTER TABLE couriers ADD COLUMN seller_id INT NULL DEFAULT NULL`
        );
    } catch (_) {}
    // Index eklenmesi (sütun zaten varsa hata yutulur)
    try {
        await sequelize.query(
            `ALTER TABLE couriers ADD INDEX idx_couriers_seller_id (seller_id)`
        );
    } catch (_) {}
}

/**
 * Satıcının kuryeyi kadrosuna eklemesi artık kurye onayına bağlı (invite/accept akışı).
 * Eski DB'lerde bu sütunlar yoksa eklenir.
 */
async function ensureCourierInviteColumns() {
    try {
        await sequelize.query(
            `ALTER TABLE couriers ADD COLUMN invite_status VARCHAR(20) NOT NULL DEFAULT 'none'`
        );
    } catch (_) {}
    try {
        await sequelize.query(
            `ALTER TABLE couriers ADD COLUMN invited_by_seller_id INT NULL DEFAULT NULL`
        );
    } catch (_) {}
}

async function ensureUserOptionalColumns() {
    const alters = [
        `ALTER TABLE users ADD COLUMN courier_status ENUM('online','offline') DEFAULT 'offline'`,
        `ALTER TABLE users ADD COLUMN vehicle_type VARCHAR(50) NULL`,
        `ALTER TABLE users ADD COLUMN last_latitude DECIMAL(10,8) NULL`,
        `ALTER TABLE users ADD COLUMN last_longitude DECIMAL(11,8) NULL`,
        `ALTER TABLE users ADD COLUMN email_verified TINYINT(1) DEFAULT 0`,
        `ALTER TABLE users ADD COLUMN two_factor_enabled TINYINT(1) DEFAULT 0`,
        `ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(255) NULL`,
        `ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(255) NULL`,
        `ALTER TABLE users ADD COLUMN password_reset_expires DATETIME NULL`
    ];
    for (const sql of alters) {
        try {
            await sequelize.query(sql);
        } catch (_) {}
    }
}
async function ensureOrderIsPoolRequestedColumn() {
    try {
        await sequelize.query(
            `ALTER TABLE orders ADD COLUMN is_pool_requested TINYINT(1) DEFAULT 0`
        );
    } catch (_) {}
}

/**
 * Yorum yanıtlama (satıcı cevabı) sütunları. Eski DB'lerde yoksa eklenir.
 */
async function ensureReviewSellerReplyColumns() {
    try {
        await sequelize.query(`ALTER TABLE reviews ADD COLUMN seller_reply TEXT NULL`);
    } catch (_) {}
    try {
        await sequelize.query(`ALTER TABLE reviews ADD COLUMN seller_reply_at DATETIME NULL`);
    } catch (_) {}
}

/**
 * Push notification subscription tablosu. İlk açılışta oluşturulur.
 */
async function ensurePushSubscriptionsTable() {
    try {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                endpoint VARCHAR(500) NOT NULL,
                p256dh VARCHAR(255) NOT NULL,
                auth VARCHAR(255) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_push_user (user_id),
                UNIQUE KEY uniq_push_endpoint (endpoint(255))
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
    } catch (_) {}
}

module.exports = {
    sequelize,
    testConnection,
    ensureOrderDeliveryTypeColumn,
    ensureOrderPaymentMethodEnum,
    ensureOrderCashPaymentMethodColumn,
    ensureMealIsApprovedColumn,
    ensureSellerIsOpenColumn,
    ensureSellerGeoColumns,
    ensureSellerPickupEnabledColumn,
    approveAllSellersOnStartupIfEnabled,
    ensurePaymentCardsEncryptionColumns,
    ensureUserOptionalColumns,
    ensureSellerOwnCouriersColumn,
    ensureCourierSellerIdColumn,
    ensureCourierInviteColumns,
    ensureOrderIsPoolRequestedColumn,
    ensureReviewSellerReplyColumns,
    ensurePushSubscriptionsTable
};
