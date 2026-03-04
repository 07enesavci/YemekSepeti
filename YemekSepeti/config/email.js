const nodemailer = require('nodemailer');
require('dotenv').config();

let cachedTransporter = null;
let cachedMode = null;

const createTransporter = () => {
    if (cachedTransporter) return cachedTransporter;

    const hasLiveCreds = Boolean(process.env.EMAIL_USER && (process.env.EMAIL_HOST || process.env.EMAIL_SERVICE));

    if (!hasLiveCreds) {
        cachedMode = 'test';
        cachedTransporter = {
            async sendMail(opts) {
                return { messageId: 'test-message-id' };
            }
        };
        return cachedTransporter;
    }

    cachedMode = 'live';

    const allowSelfSigned = process.env.EMAIL_SSL_ALLOW_SELF_SIGNED === 'true';
    const common = {
        pool: process.env.EMAIL_POOL === 'true',
        maxConnections: parseInt(process.env.EMAIL_MAX_CONNECTIONS || '5'),
        maxMessages: parseInt(process.env.EMAIL_MAX_MESSAGES || '100'),
        rateDelta: parseInt(process.env.EMAIL_RATE_DELTA || '1000'),
        rateLimit: parseInt(process.env.EMAIL_RATE_LIMIT || '5'),
        tls: allowSelfSigned ? { rejectUnauthorized: false, minVersion: 'TLSv1.2' } : { minVersion: 'TLSv1.2' }
    };

    if (process.env.EMAIL_SERVICE) {
        cachedTransporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            ...common
        });
        return cachedTransporter;
    }

    cachedTransporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        ...common
    });
    return cachedTransporter;
};

async function sendEmail(to, subject, html, text = null) {
    try {
        const transporter = createTransporter();
        const fromAddress = (process.env.EMAIL_FROM_NAME
            ? `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@example.com'}>`
            : (process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@example.com'));

        const info = await transporter.sendMail({
            from: fromAddress,
            to: to,
            subject: subject,
            text: text || html.replace(/<[^>]*>/g, ''),
            html: html
        });
        
        if (cachedMode === 'test') {
            return { success: true, message: 'Email test modunda gösterildi', messageId: info.messageId };
        }

        return { success: true, messageId: info.messageId };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function sendVerificationCode(email, code, type = 'registration') {
    const typeNames = {
        'registration': 'Kayıt Doğrulama',
        'two_factor': 'İki Faktörlü Kimlik Doğrulama',
        'password_reset': 'Şifre Sıfırlama'
    };
    
    const typeName = typeNames[type] || 'Doğrulama';
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .code { background: #fff; border: 2px dashed #DC2626; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 10px; margin: 20px 0; border-radius: 5px; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Ev Lezzetleri</h1>
                    <p>${typeName} Kodu</p>
                </div>
                <div class="content">
                    <p>Merhaba,</p>
                    <p>${typeName} için doğrulama kodunuz:</p>
                    <div class="code">${code}</div>
                    <p>Bu kod <strong>5 dakika</strong> geçerlidir.</p>
                    <p>Eğer bu işlemi siz yapmadıysanız, bu emaili görmezden gelebilirsiniz.</p>
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()} Ev Lezzetleri. Tüm hakları saklıdır.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    return await sendEmail(email, `${typeName} - Doğrulama Kodu`, html);
}

async function sendPasswordResetLink(email, resetLink) {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; background: #DC2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Ev Lezzetleri</h1>
                    <p>Şifre Sıfırlama</p>
                </div>
                <div class="content">
                    <p>Merhaba,</p>
                    <p>Şifrenizi sıfırlamak için aşağıdaki butona tıklayın:</p>
                    <div style="text-align: center;">
                        <a href="${resetLink}" class="button">Şifremi Sıfırla</a>
                    </div>
                    <p>Veya bu linki kopyalayıp tarayıcınıza yapıştırın:</p>
                    <p style="word-break: break-all; color: #666;">${resetLink}</p>
                    <p><strong>Bu link 1 saat geçerlidir.</strong></p>
                    <p>Eğer bu işlemi siz yapmadıysanız, bu emaili görmezden gelebilirsiniz.</p>
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()} Ev Lezzetleri. Tüm hakları saklıdır.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    return await sendEmail(email, 'Şifre Sıfırlama - Ev Lezzetleri', html);
}

module.exports = {
    sendEmail,
    sendVerificationCode,
    sendPasswordResetLink
};
