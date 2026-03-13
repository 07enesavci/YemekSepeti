// Favori restoran (alıcı - satıcı ilişkisi)
module.exports = (sequelize, DataTypes) => {
    const UserFavoriteSeller = sequelize.define('UserFavoriteSeller', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        seller_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        tableName: 'user_favorite_sellers',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['seller_id'] },
            { unique: true, fields: ['user_id', 'seller_id'] }
        ]
    });
    return UserFavoriteSeller;
};
