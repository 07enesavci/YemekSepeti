module.exports = (sequelize, DataTypes) => {
    const Order = sequelize.define('Order', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        order_number: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        seller_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        courier_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        address_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        payment_method: {
            type: DataTypes.ENUM('credit_card', 'cash', 'wallet'),
            allowNull: false
        },
        subtotal: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        delivery_fee: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 15.00
        },
        discount_amount: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.00
        },
        coupon_code: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        total_amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('pending', 'confirmed', 'preparing', 'ready', 'on_delivery', 'delivered', 'cancelled'),
            defaultValue: 'pending'
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        estimated_delivery_time: {
            type: DataTypes.DATE,
            allowNull: true
        },
        delivered_at: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'orders',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['user_id'] },
            { fields: ['seller_id'] },
            { fields: ['courier_id'] },
            { fields: ['status'] },
            { fields: ['created_at'] }
        ]
    });

    return Order;
};

