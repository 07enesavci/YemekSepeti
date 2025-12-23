module.exports = (sequelize, DataTypes) => {
    const Meal = sequelize.define('Meal', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        seller_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        category: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        price: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        image_url: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        is_available: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        stock_quantity: {
            type: DataTypes.INTEGER,
            defaultValue: -1 // -1 = sınırsız
        }
    }, {
        tableName: 'meals',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['seller_id'] },
            { fields: ['category'] },
            { fields: ['is_available'] }
        ]
    });

    return Meal;
};

