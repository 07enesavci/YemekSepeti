module.exports = (sequelize, DataTypes) => {
    const Courier = sequelize.define('Courier', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true
        },
        id_card: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: "Kimlik Fotokopisi"
        },
        driver_license: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: "Ehliyet Fotokopisi"
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'couriers',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['is_active'] }
        ]
    });
    return Courier;
};
