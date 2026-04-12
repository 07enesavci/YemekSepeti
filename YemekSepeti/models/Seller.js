module.exports = (sequelize, DataTypes) => {
    const Seller = sequelize.define('Seller', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        shop_name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        // --- YENİ EKLENEN BELGE ALANLARI ---
        tax_plate: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: "Vergi Levhası Dosya Yolu"
        },
        id_card: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: "Kimlik Fotokopisi Dosya Yolu"
        },
        activity_cert: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: "Faaliyet Belgesi Dosya Yolu"
        },
        business_license: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: "İşyeri Ruhsatı Dosya Yolu"
        },
        // ---------------------------------
        location: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        logo_url: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        banner_url: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        rating: {
            type: DataTypes.DECIMAL(3, 2),
            defaultValue: 0.00
        },
        total_reviews: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        opening_hours: {
            type: DataTypes.JSON,
            allowNull: true
        },
        delivery_fee: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 15.00
        },
        min_order_amount: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 50.00
        },
        // --- TESLİMAT YARICAPI ---
        delivery_radius_km: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            comment: "Teslimat yarıçapı (km). 0 = sınırsız"
        },
        latitude: {
            type: DataTypes.DECIMAL(10, 8),
            allowNull: true,
            comment: "Satıcı konum enlem"
        },
        longitude: {
            type: DataTypes.DECIMAL(11, 8),
            allowNull: true,
            comment: "Satıcı konum boylam"
        },
        // --------------------------
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: false // Belgeler onaylanana kadar varsayılan olarak kapalı (false) olması daha güvenlidir
        },
        is_open: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        /** Gel Al (mağazadan teslim) — checkout ve sipariş doğrulamasında kullanılır */
        pickup_enabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false
        },
        /** Uzak Mesafe Kargo — satıcı kargo ile Türkiye geneline ürün gönderebilir */
        uzak_mesafe_enabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        }
    }, {
        tableName: 'sellers',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { unique: true, fields: ['user_id'] },
            { fields: ['location'] },
            { fields: ['rating'] },
            { fields: ['is_active'] }
        ]
    });

    return Seller;
};