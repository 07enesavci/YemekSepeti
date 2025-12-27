// Kupon kullanımı tablosu
module.exports=(sequelize, DataTypes)=>{
    const CouponUsage=sequelize.define('CouponUsage', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        coupon_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        order_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        discount_amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        used_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'coupon_usages',
        timestamps: false,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['coupon_id'] },
            { 
                fields: ['order_id', 'coupon_id'],
                unique: true,
                name: 'unique_order_coupon'
            }
        ]
    });

    return CouponUsage;
};

