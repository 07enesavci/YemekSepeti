module.exports = (sequelize, DataTypes) => {
    const WalletTransaction = sequelize.define('WalletTransaction', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        transaction_type: {
            type: DataTypes.ENUM('deposit', 'withdrawal', 'order_payment', 'refund', 'coupon_bonus'),
            allowNull: false
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        balance_after: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        related_order_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        }
    }, {
        tableName: 'wallet_transactions',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['transaction_type'] },
            { fields: ['created_at'] }
        ]
    });

    return WalletTransaction;
};

