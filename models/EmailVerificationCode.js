module.exports = (sequelize, DataTypes) => {
    const EmailVerificationCode = sequelize.define('EmailVerificationCode', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        code: {
            type: DataTypes.STRING(10),
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM('registration', 'two_factor', 'password_reset'),
            allowNull: false
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false
        },
        used: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'email_verification_codes',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            { fields: ['email', 'type'] },
            { fields: ['expires_at'] },
            { fields: ['used'] }
        ]
    });

    return EmailVerificationCode;
};

