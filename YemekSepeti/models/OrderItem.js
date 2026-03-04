// OrderItem model - Sipariş öğesi tablosu
module.exports=(sequelize, DataTypes)=>{
    const OrderItem=sequelize.define('OrderItem', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        order_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        meal_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        meal_name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        meal_price: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        subtotal: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        }
    }, {
        tableName: 'order_items',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            { fields: ['order_id'] }
        ]
    });

    return OrderItem;
};

