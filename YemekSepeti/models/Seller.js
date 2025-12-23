module.exports = (sequelize, DataTypes) => {
    const Seller = sequelize.define('Seller', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true
        },
        shop_name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
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
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        tableName: 'sellers',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['location'] },
            { fields: ['rating'] },
            { fields: ['is_active'] }
        ]
    });

    return Seller;
};

