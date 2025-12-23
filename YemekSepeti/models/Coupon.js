module.exports = (sequelize, DataTypes) => {
    const Coupon = sequelize.define('Coupon', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        code: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        discount_type: {
            type: DataTypes.ENUM('fixed', 'percentage'),
            allowNull: false,
            defaultValue: 'fixed'
        },
        discount_value: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        min_order_amount: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.00
        },
        max_discount_amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        applicable_seller_ids: {
            type: DataTypes.JSON,
            allowNull: true
        },
        usage_limit: {
            type: DataTypes.INTEGER,
            defaultValue: -1 // -1 = sınırsız
        },
        used_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        valid_from: {
            type: DataTypes.DATE,
            allowNull: false
        },
        valid_until: {
            type: DataTypes.DATE,
            allowNull: false
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        created_by: {
            type: DataTypes.INTEGER,
            allowNull: true
        }
    }, {
        tableName: 'coupons',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['code'] },
            { fields: ['is_active'] },
            { fields: ['valid_from', 'valid_until'] }
        ]
    });

    return Coupon;
};

