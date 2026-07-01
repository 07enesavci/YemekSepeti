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
            // Kayıt/2FA kodları 6 hane; şifre sıfırlama token'ı 64 karakter (crypto.randomBytes(32).hex).
            // Bu yüzden 255 karakter — dar tutulursa reset token sığmaz ve mail hiç gönderilmez.
            type: DataTypes.STRING(255),
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

