// Payment model - Ödeme tablosu
module.exports=(sequelize, DataTypes)=>{
    const Payment=sequelize.define('Payment', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        order_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        payment_method: {
            type: DataTypes.ENUM('credit_card', 'cash', 'wallet'),
            allowNull: false
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
            defaultValue: 'pending'
        },
        transaction_id: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        card_last_four: {
            type: DataTypes.STRING(4),
            allowNull: true
        },
        payment_date: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'payments',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['order_id'] },
            { fields: ['status'] },
            { fields: ['payment_date'] }
        ]
    });

    return Payment;
};

