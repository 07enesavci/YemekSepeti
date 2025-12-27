//Kullanıcı tablosu
module.exports=(sequelize, DataTypes)=>{
    const User=sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            }
        },
        password: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        fullname: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        phone: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        role: {
            type: DataTypes.ENUM('buyer', 'seller', 'courier', 'admin'),
            allowNull: false,
            defaultValue: 'buyer'
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        email_verified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        two_factor_enabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        two_factor_secret: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        password_reset_token: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        password_reset_expires: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'users',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['email'] },
            { fields: ['role'] }
        ]
    });

    return User;
};