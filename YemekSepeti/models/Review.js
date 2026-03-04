// Review model - Yorum tablosu
module.exports=(sequelize, DataTypes)=>{
    const Review=sequelize.define('Review', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        order_id: {
            type: DataTypes.INTEGER,
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
        rating: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 5
            }
        },
        comment: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        meal_ratings: {
            type: DataTypes.JSON,
            allowNull: true
        },
        is_visible: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        tableName: 'reviews',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['seller_id'] },
            { fields: ['rating'] },
            { fields: ['created_at'] }
        ]
    });

    return Review;
};

