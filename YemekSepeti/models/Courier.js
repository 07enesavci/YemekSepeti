module.exports = (sequelize, DataTypes) => {
    const Courier = sequelize.define('Courier', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        id_card: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: "Kimlik Fotokopisi"
        },
        driver_license: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: "Ehliyet Fotokopisi"
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        /** Zincir restoran kuryesi ise bağlı olduğu satıcı ID'si; platform kuryesi ise null */
        seller_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
            comment: "Bağlı olduğu satıcı (zincir restoran). NULL ise platform kuryesi."
        },
        /** Bir satıcının kuryeyi kadrosuna eklemesi, kuryenin onayına bağlıdır — seller_id bu onay verilene kadar set edilmez. */
        invite_status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'none',
            comment: "none | pending | accepted — satıcı daveti onay durumu"
        },
        invited_by_seller_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
            comment: "invite_status='pending' iken davet eden satıcı ID'si"
        }
    }, {
        tableName: 'couriers',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { unique: true, fields: ['user_id'] },
            { fields: ['is_active'] }
        ]
    });
    return Courier;
};
