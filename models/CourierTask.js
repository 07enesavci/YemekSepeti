// CourierTask model - Kurye görevi tablosu
module.exports=(sequelize, DataTypes)=>{
    const CourierTask=sequelize.define('CourierTask', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        order_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        courier_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        pickup_location: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        delivery_location: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        estimated_payout: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('assigned', 'picked_up', 'on_way', 'delivered', 'cancelled'),
            defaultValue: 'assigned'
        },
        picked_up_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        delivered_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        actual_payout: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        }
    }, {
        tableName: 'courier_tasks',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['courier_id'] },
            { fields: ['status'] },
            { fields: ['order_id'] }
        ]
    });

    return CourierTask;
};

