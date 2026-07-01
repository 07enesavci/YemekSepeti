// Feedback model - Öneri ve Şikayet tablosu (alıcı, satıcı, kurye)
module.exports=(sequelize, DataTypes)=>{
    const Feedback=sequelize.define('Feedback', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        // Gönderen rolü — kayıt anındaki rol (sonradan değişse bile korunur)
        role: {
            type: DataTypes.ENUM('buyer', 'seller', 'courier'),
            allowNull: false
        },
        // Öneri mi şikayet mi
        type: {
            type: DataTypes.ENUM('suggestion', 'complaint'),
            allowNull: false
        },
        subject: {
            type: DataTypes.STRING(150),
            allowNull: false
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        // İşlem durumu — admin yönetir
        status: {
            type: DataTypes.ENUM('open', 'in_review', 'resolved'),
            allowNull: false,
            defaultValue: 'open'
        },
        // Admin yanıtı / notu
        admin_note: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'feedbacks',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['user_id'] },
            { fields: ['role'] },
            { fields: ['type'] },
            { fields: ['status'] },
            { fields: ['created_at'] }
        ]
    });

    return Feedback;
};
