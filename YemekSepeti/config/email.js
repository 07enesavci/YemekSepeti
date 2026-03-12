const nodemailer = require('nodemailer');
require('dotenv').config();

let cachedTransporter = null;
let cachedMode = null;

const createTransporter = () => {
    if (cachedTransporter) return cachedTransporter;

    const hasLiveCreds = Boolean(process.env.EMAIL_USER && (process.env.EMAIL_HOST || process.env.EMAIL_SERVICE));

    if (!hasLiveCreds) {
        cachedMode = 'test';
        console.warn('[E-posta] .env içinde EMAIL_USER ve (EMAIL_HOST veya EMAIL_SERVICE) tanımlı değil → e-postalar GÖNDERİLMİYOR (test modu). Kayıt doğrulama kodu mail ile gitmez. .env.example dosyasına bakın.');
        cachedTransporter = {
            async sendMail(opts) {
                console.warn('[E-posta Test] Gerçek gönderim yok. Alıcı:', opts.to, 'Konu:', opts.subject);
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

const CONTACT_EMAIL = 'evlezzetleri.site@gmail.com';

async function sendSellerApprovalEmail(email, shopName = '') {
    const shopText = shopName ? ` (${shopName})` : '';
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Ev Lezzetleri</h1>
                    <p>Satıcı Hesabı Onaylandı</p>
                </div>
                <div class="content">
                    <p>Merhaba${shopText},</p>
                    <p><strong>Hesabınız onaylandı.</strong> Artık satıcı panelinize giriş yaparak mağazanızı yönetebilir, ürün ekleyebilir ve siparişleri takip edebilirsiniz.</p>
                    <p>Hayırlı satışlar dileriz.</p>
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()} Ev Lezzetleri. Tüm hakları saklıdır.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    return await sendEmail(email, 'Hesabınız Onaylandı - Ev Lezzetleri', html);
}

async function sendSellerRejectionEmail(email) {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .contact { background: #fff; border-left: 4px solid #4b5563; padding: 12px 16px; margin: 16px 0; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Ev Lezzetleri</h1>
                    <p>Başvuru Sonucu</p>
                </div>
                <div class="content">
                    <p>Merhaba,</p>
                    <p>Maalesef satıcı hesabınız onaylanmadı.</p>
                    <p>Detaylar için <strong>evlezzetleri.site@gmail.com</strong> adresi üzerinden bizimle iletişime geçebilirsiniz.</p>
                    <div class="contact">İletişim: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></div>
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()} Ev Lezzetleri. Tüm hakları saklıdır.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    return await sendEmail(email, 'Başvuru Sonucu - Ev Lezzetleri', html);
}

async function sendCourierApprovalEmail(email) {
    const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8">
        <style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#059669 0%,#10b981 100%);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0}.content{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}.footer{text-align:center;margin-top:20px;color:#666;font-size:12px}</style>
        </head>
        <body>
        <div class="container">
        <div class="header"><h1>Ev Lezzetleri</h1><p>Kurye Hesabı Onaylandı</p></div>
        <div class="content">
        <p>Merhaba,</p>
        <p><strong>Kurye hesabınız onaylandı.</strong> Artık kurye panelinize giriş yaparak teslimat yapabilirsiniz.</p>
        <p>Hayırlı teslimatlar dileriz.</p>
        </div>
        <div class="footer"><p>© ${new Date().getFullYear()} Ev Lezzetleri.</p></div>
        </div>
        </body>
        </html>`;
    return await sendEmail(email, 'Kurye Hesabınız Onaylandı - Ev Lezzetleri', html);
}

async function sendCourierRejectionEmail(email) {
    const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8">
        <style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#6b7280 0%,#4b5563 100%);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0}.content{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}.contact{background:#fff;border-left:4px solid #4b5563;padding:12px 16px;margin:16px 0}.footer{text-align:center;margin-top:20px;color:#666;font-size:12px}</style>
        </head>
        <body>
        <div class="container">
        <div class="header"><h1>Ev Lezzetleri</h1><p>Başvuru Sonucu</p></div>
        <div class="content">
        <p>Merhaba,</p>
        <p>Maalesef kurye hesabınız onaylanmadı.</p>
        <p>Detaylar için <strong>${CONTACT_EMAIL}</strong> adresi üzerinden bizimle iletişime geçebilirsiniz.</p>
        <div class="contact">İletişim: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></div>
        </div>
        <div class="footer"><p>© ${new Date().getFullYear()} Ev Lezzetleri.</p></div>
        </div>
        </body>
        </html>`;
    return await sendEmail(email, 'Kurye Başvuru Sonucu - Ev Lezzetleri', html);
}

module.exports = {
    sendEmail,
    sendVerificationCode,
    sendPasswordResetLink,
    sendSellerApprovalEmail,
    sendSellerRejectionEmail,
    sendCourierApprovalEmail,
    sendCourierRejectionEmail
};
