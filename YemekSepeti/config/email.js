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

function emailLayout(innerHtml, title = 'Ev Lezzetleri') {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f5f5f5}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#DC2626 0%,#EF4444 100%);color:white;padding:24px;text-align:center;border-radius:10px 10px 0 0}.content{background:#fff;padding:24px;border-radius:0 0 10px 10px;box-shadow:0 2px 8px rgba(0,0,0,0.08)}.footer{text-align:center;margin-top:16px;color:#666;font-size:12px}</style>
</head>
<body>
<div class="container">
<div class="header"><h1 style="margin:0;font-size:1.5rem">${title}</h1></div>
<div class="content">${innerHtml}</div>
<div class="footer"><p>© ${new Date().getFullYear()} ${title}. Tüm hakları saklıdır.</p></div>
</div>
</body>
</html>`;
}

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

async function sendPasswordResetLink(email, resetLink, ttlMinutes = 15) {
    const ttlText = `${ttlMinutes} dakika`;
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { 
                    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
                    line-height: 1.6; 
                    color: #374151; 
                    background-color: #f3f4f6; 
                    margin: 0; 
                    padding: 40px 20px; 
                }
                .container { 
                    max-width: 600px; 
                    margin: 0 auto; 
                    background: #ffffff; 
                    border-radius: 16px; 
                    overflow: hidden; 
                    box-shadow: 0 10px 25px rgba(0,0,0,0.05); 
                }
                .header { 
                    background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); 
                    color: white; 
                    padding: 40px 30px; 
                    text-align: center; 
                }
                .header h1 { 
                    margin: 0; 
                    font-size: 28px; 
                    font-weight: 800; 
                    letter-spacing: -0.5px; 
                }
                .header p { 
                    margin: 5px 0 0; 
                    font-size: 16px; 
                    opacity: 0.9; 
                }
                .content { 
                    padding: 40px 30px; 
                }
                .content p { 
                    margin-bottom: 20px; 
                    font-size: 16px; 
                }
                .button-container { 
                    text-align: center; 
                    margin: 35px 0; 
                }
                .button { 
                    display: inline-block; 
                    background: #dc2626; 
                    color: #ffffff; 
                    padding: 14px 32px; 
                    text-decoration: none; 
                    border-radius: 50px; 
                    font-weight: 600; 
                    font-size: 16px; 
                    box-shadow: 0 4px 6px rgba(220, 38, 38, 0.25);
                }
                a.button { color: #ffffff !important; }
                .link-box {
                    background-color: #f9fafb;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 16px;
                    margin-top: 10px;
                    word-break: break-all;
                    font-size: 13px;
                    color: #6b7280;
                }
                .footer { 
                    text-align: center; 
                    padding: 20px 30px 40px; 
                    color: #9ca3af; 
                    font-size: 13px; 
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Ev Lezzetleri</h1>
                    <p>Şifre Sıfırlama Talebi</p>
                </div>
                <div class="content">
                    <p>Merhaba,</p>
                    <p>Hesabınızın şifresini sıfırlamak için bir talep aldık. Aşağıdaki butona tıklayarak yeni şifrenizi belirleyebilirsiniz:</p>
                    
                    <div class="button-container">
                        <a href="${resetLink}" class="button">Şifremi Sıfırla</a>
                    </div>
                    
                    <p style="font-size: 14px; margin-bottom: 8px;">Veya bu bağlantıyı kopyalayıp tarayıcınıza yapıştırın:</p>
                    <div class="link-box">
                        <a href="${resetLink}" style="color: #6b7280; text-decoration: none;">${resetLink}</a>
                    </div>
                    
                    <p style="margin-top: 25px; font-size: 14px; color: #6b7280;">
                        <strong>Not:</strong> Bu bağlantı güvenlik amacıyla yalnızca <strong>${ttlText}</strong> boyunca geçerlidir ve tek kullanımlıktır. Süresi dolduktan sonra çalışmaz; bu sayede e-postanıza sonradan erişen biri hesabınıza giremez.
                        <br><br>
                        Eğer şifre sıfırlama talebinde bulunmadıysanız, bu e-postayı güvenle göz ardı edebilirsiniz. Hesabınız güvendedir.
                    </p>
                </div>
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} Ev Lezzetleri. Tüm hakları saklıdır.</p>
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

async function sendPickupReadyEmail(email, orderNumber, shopName) {
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
                .order-id { font-size: 20px; font-weight: bold; color: #DC2626; margin: 15px 0; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Ev Lezzetleri</h1>
                    <p>Siparişiniz Hazır!</p>
                </div>
                <div class="content">
                    <p>Merhaba,</p>
                    <p><strong>${shopName}</strong> restoranından verdiğiniz <strong>${orderNumber}</strong> numaralı Gel Al siparişiniz hazırlanmıştır.</p>
                    <div class="order-id">Sipariş Hazır!</div>
                    <p>Dilediğiniz zaman restorandan siparişinizi teslim alabilirsiniz.</p>
                    <p>Afiyet olsun!</p>
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()} Ev Lezzetleri. Tüm hakları saklıdır.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    return await sendEmail(email, `Siparişiniz Hazır - ${orderNumber}`, html);
}

async function sendInvoiceEmail(email, orderData) {
    const kdvRate = 20; // %20 KDV varsayımı
    const total = parseFloat(orderData.totalAmount || 0);
    const kdvMatrahi = (total / (1 + (kdvRate / 100))).toFixed(2);
    const hesaplananKdv = (total - kdvMatrahi).toFixed(2);
    
    // ETTN (UUID)
    const ettn = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });

    const faturaNo = 'EAV' + new Date().getFullYear() + Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');

    const itemsHtml = (orderData.items || []).map(item => `
        <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 11px;">${item.meal_name}</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 11px; text-align: center;">${item.quantity} Adet</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 11px; text-align: right;">${item.meal_price} TL</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 11px; text-align: right;">${item.subtotal} TL</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 11px; text-align: right;">0.00 TL</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 11px; text-align: right;">${item.subtotal} TL</td>
        </tr>
    `).join('');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, Helvetica, sans-serif; line-height: 1.4; color: #333333; background-color: #f5f5f5; margin: 0; padding: 20px 0; }
                .container { max-width: 800px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; }
                
                .header-banner { background-color: #dc2626; padding: 30px; text-align: center; }
                .header-banner h1 { margin: 0; color: white; font-size: 32px; font-weight: 800; font-style: italic; letter-spacing: -1px; }
                
                .rate-section { text-align: center; padding: 20px; border-bottom: 1px solid #eee; }
                .rate-section p { margin: 0 0 10px 0; font-weight: bold; font-size: 14px; }
                .rate-btn { display: inline-block; background-color: #c026d3; color: white; text-decoration: none; padding: 8px 25px; border-radius: 4px; font-weight: bold; font-size: 13px; }
                
                .invoice-body { padding: 40px; }
                .top-row { display: table; width: 100%; margin-bottom: 30px; }
                .col-left, .col-right { display: table-cell; vertical-align: top; width: 50%; font-size: 10px; color: #444; }
                
                .company-info p, .buyer-info p { margin: 2px 0; }
                .buyer-info { margin-top: 20px; }
                .buyer-name { font-weight: bold; font-size: 12px; margin-bottom: 5px; color: #000; }
                .ettn { margin-top: 20px; font-weight: bold; font-size: 11px; color: #000; }
                
                .e-arsiv-logo { width: 80px; height: 80px; border: 2px solid #dc2626; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #dc2626; font-weight: bold; font-size: 36px; font-style: italic; margin-bottom: 5px; }
                .e-arsiv-text { color: #dc2626; font-weight: bold; font-size: 11px; margin-bottom: 20px; letter-spacing: 1px; }
                
                .invoice-meta { margin-top: 20px; }
                .invoice-meta table { width: 100%; font-size: 10px; }
                .invoice-meta td.lbl { color: #dc2626; font-weight: bold; width: 40%; padding: 3px 0; }
                .invoice-meta td.val { font-weight: bold; color: #000; padding: 3px 0; }
                
                .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; margin-top: 20px; }
                .items-table th { color: #dc2626; font-size: 10px; font-weight: bold; text-align: left; padding: 10px 0; border-bottom: 2px solid #eee; }
                .items-table th.right { text-align: right; }
                .items-table th.center { text-align: center; }
                
                .totals-section { display: table; width: 100%; margin-top: 20px; font-size: 11px; }
                .totals-left { display: table-cell; vertical-align: bottom; width: 50%; font-weight: bold; color: #000; }
                .totals-right { display: table-cell; vertical-align: top; width: 50%; }
                .totals-table { width: 100%; border-collapse: collapse; }
                .totals-table td { padding: 4px 0; }
                .totals-table td.lbl { color: #dc2626; font-weight: bold; text-align: right; padding-right: 15px; }
                .totals-table td.val { text-align: right; color: #000; font-weight: bold; }
                
                .footer-notes { display: table; width: 100%; margin-top: 40px; font-size: 9px; color: #666; }
                .footer-col { display: table-cell; vertical-align: top; width: 50%; padding-right: 20px; }
                .footer-col strong { color: #000; }
                .footer-col p { margin: 3px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header-banner">
                    <h1>Ev Lezzetleri</h1>
                </div>
                
                <div class="rate-section">
                    <p>Siparişiniz nasıldı?</p>
                    <a href="#" class="rate-btn">Değerlendir</a>
                </div>
                
                <div class="invoice-body">
                    <div class="top-row">
                        <div class="col-left">
                            <div class="company-info">
                                <p><strong>Ev Lezzetleri Elektronik İletişim Perakende Gıda Anonim Şirketi</strong></p>
                                <p>Esentepe Mahallesi, Dede Korkut Sokak No:28 34394 Şişli, İstanbul</p>
                                <p>Tel: 0212 000 00 00 &nbsp; Fax: 0212 000 00 01</p>
                                <p>Web: www.evlezzetleri.com</p>
                                <p>E-Posta: destek@evlezzetleri.com</p>
                                <p>Vergi Dairesi: BOĞAZİÇİ KURUMLAR</p>
                                <p>VKN: 1111111111</p>
                                <p>Mersis No: 0000000000000000</p>
                                <p>Ticaret Sicil No: 000000</p>
                            </div>
                            
                            <div class="buyer-info">
                                <p>SAYIN</p>
                                <p class="buyer-name">${orderData.buyerName}</p>
                                <p>${orderData.address}</p>
                                <p>E-Posta: <a href="mailto:${email}" style="color: #0066cc;">${email}</a></p>
                                <p>Tel: ${orderData.buyerPhone}</p>
                                <p>Vergi Dairesi: </p>
                                <p>TCKN: 11111111111</p>
                            </div>
                            
                            <div class="ettn">
                                ETTN: ${ettn}
                            </div>
                        </div>
                        
                        <div class="col-right" style="text-align: center;">
                            <div style="display: flex; justify-content: center; gap: 20px; align-items: flex-start; margin-bottom: 20px;">
                                <div>
                                    <div class="e-arsiv-logo">GİB</div>
                                    <div class="e-arsiv-text">e-ARŞİV FATURA</div>
                                </div>
                                <div style="width: 80px; height: 80px; background-color: #eee; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 8px;">[QR KOD]</div>
                            </div>
                            
                            <div class="invoice-meta" style="text-align: left; padding-left: 20px;">
                                <table>
                                    <tr><td class="lbl">Fatura Tipi:</td><td class="val">SATIŞ</td></tr>
                                    <tr><td class="lbl">Fatura No:</td><td class="val">${faturaNo}</td></tr>
                                    <tr><td class="lbl">Fatura Tarihi:</td><td class="val">${orderData.date.split(' ')[0]} ${orderData.date.split(' ')[1]}</td></tr>
                                    <tr><td class="lbl">Alışveriş Tarihi:</td><td class="val">${orderData.date.split(' ')[0]}</td></tr>
                                </table>
                            </div>
                        </div>
                    </div>
                    
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th>Mal/Hizmet Açıklaması</th>
                                <th class="center">Miktar</th>
                                <th class="right">Birim Fiyat</th>
                                <th class="right">Mal / Hizmet Tutarı</th>
                                <th class="right">İsk. Tutar</th>
                                <th class="right">Net Tutar</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                    
                    <div class="totals-section">
                        <div class="totals-left">
                            Yalnız: ${total} TürkLirası Sıfır Kuruş
                        </div>
                        <div class="totals-right">
                            <table class="totals-table">
                                <tr><td class="lbl">Mal Hizmet Toplam Tutarı</td><td class="val">${total.toFixed(2)} TL</td></tr>
                                <tr><td class="lbl">Toplam İskonto</td><td class="val">0.00 TL</td></tr>
                                <tr><td class="lbl">KDV Matrahı</td><td class="val">${kdvMatrahi} TL</td></tr>
                                <tr><td class="lbl">Hesaplanan KDV (%20.00)</td><td class="val">${hesaplananKdv} TL</td></tr>
                                <tr><td class="lbl">Vergiler Dahil Toplam Tutar</td><td class="val">${total.toFixed(2)} TL</td></tr>
                                <tr><td class="lbl" style="color: #dc2626;">Ödenecek Tutar</td><td class="val">${total.toFixed(2)} TL</td></tr>
                            </table>
                        </div>
                    </div>
                    
                    <div class="footer-notes">
                        <div class="footer-col">
                            <strong>İnternet Satış Bilgileri</strong>
                            <p>Ödeme Şekli: ${orderData.paymentMethod === 'credit_card' ? 'Online Kredi/Banka Kartı' : 'Kapıda Ödeme'}</p>
                            <p>Satış İşleminin Yapıldığı Web Adresi: <a href="http://www.evlezzetleri.com" style="color:#0066cc;">www.evlezzetleri.com</a></p>
                            <p>Ödeme Aracısı: Banka</p>
                            <p>Ödeme Tarihi: ${orderData.date.split(' ')[0]}</p>
                        </div>
                        <div class="footer-col">
                            <strong>Genel Açıklamalar:</strong> Bu Fatura E-Arşiv İzni Kapsamında Oluşturulmuştur.<br>
                            Bu Satış İnternet Üzerinden Yapılmıştır.<br>
                            E-Arşiv İzni Kapsamında Elektronik Ortamda İletilmiştir.
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
    
    return await sendEmail(email, `Ev Lezzetleri E-Arşiv Faturanız (#${faturaNo})`, html);
}

async function sendOrderReceivedEmail(email, orderData) {
    const itemsHtml = orderData.items.map(item => `
        <tr>
            <td style="padding: 10px 15px; border-bottom: 1px solid #eee; font-size: 11px;">${item.quantity} X &nbsp; ${item.meal_name}</td>
            <td style="padding: 10px 15px; border-bottom: 1px solid #eee; font-size: 11px; text-align: right;">${item.subtotal} TL</td>
        </tr>
    `).join('');

    let totalsHtml = '';
    if (orderData.deliveryFee && parseFloat(orderData.deliveryFee) > 0) {
        totalsHtml += `
        <tr>
            <td style="padding: 10px 15px; text-align: right; font-size: 11px; color: #555;">Gönderim Ücreti</td>
            <td style="padding: 10px 15px; text-align: right; font-size: 11px; color: #555;">${orderData.deliveryFee} TL</td>
        </tr>`;
    }
    if (orderData.discountAmount && parseFloat(orderData.discountAmount) > 0) {
        totalsHtml += `
        <tr>
            <td style="padding: 10px 15px; text-align: right; font-size: 11px; color: #555;">Kupon</td>
            <td style="padding: 10px 15px; text-align: right; font-size: 11px; color: #555;">-${orderData.discountAmount} TL</td>
        </tr>`;
    }
    totalsHtml += `
        <tr>
            <td style="padding: 15px; text-align: right; font-weight: bold; font-size: 12px;">Toplam</td>
            <td style="padding: 15px; text-align: right; font-weight: bold; font-size: 12px; color: #dc2626;">${orderData.totalAmount} TL</td>
        </tr>`;

    let paymentText = orderData.paymentMethod === 'credit_card' ? 'Online Kredi/Banka Kartı' : 'Kapıda Ödeme';
    if (orderData.paymentMethod === 'cash' && orderData.cashPaymentMethod === 'credit_card') {
        paymentText = 'Kapıda Kredi/Banka Kartı';
    } else if (orderData.paymentMethod === 'cash') {
        paymentText = 'Kapıda Nakit';
    }

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #333333; background-color: #f5f5f5; margin: 0; padding: 20px 0; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
                .logo-header { text-align: center; padding: 20px; font-size: 28px; font-weight: 800; color: #dc2626; letter-spacing: -0.5px; }
                
                .banner { 
                    background: linear-gradient(90deg, #dc2626 0%, #ef4444 100%); 
                    color: white; 
                    text-align: center; 
                    padding: 40px 20px; 
                }
                .banner-icon { font-size: 40px; margin-bottom: 10px; display: inline-block; border: 2px solid white; border-radius: 50%; width: 60px; height: 60px; line-height: 60px; }
                .banner h2 { margin: 0; font-size: 20px; font-weight: 700; }
                .banner p { margin: 10px 0 0 0; font-size: 12px; opacity: 0.9; padding: 0 40px; }

                .content-box { padding: 30px; }
                
                .details-title { font-weight: bold; font-size: 14px; margin-bottom: 15px; }
                .details-table { width: 100%; font-size: 11px; color: #555; border-collapse: collapse; margin-bottom: 20px; }
                .details-table td { padding: 5px 0; }
                .details-table td.label { width: 30%; font-weight: 600; }
                .details-table td.value { text-align: right; }
                
                .divider { border-top: 2px dashed #000000; margin: 20px 0; }
                
                .message-body { font-size: 12px; color: #444; }
                .message-body p { margin-bottom: 15px; }
                
                .signature { font-size: 12px; margin-bottom: 25px; }
                .signature-brand { color: #dc2626; }
                
                .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                .items-header { background-color: #6ee7b7; font-weight: bold; font-size: 12px; }
                .items-header td { padding: 10px 15px; }

                .footer { text-align: center; padding: 20px 30px; font-size: 9px; color: #888; background-color: #ffffff; border-top: 1px dotted #ccc; }
                .social-icons { margin: 15px 0; }
                .social-icons span { display: inline-block; width: 24px; height: 24px; background-color: #dc2626; color: white; border-radius: 50%; line-height: 24px; font-size: 12px; margin: 0 5px; }
                .bottom-banner { background-color: #dc2626; color: white; text-align: center; padding: 15px; font-size: 18px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo-header">
                    Ev Lezzetleri
                </div>
                
                <div class="banner">
                    <div class="banner-icon">✓</div>
                    <h2>Siparişiniz bize ulaşmıştır.<br>Teşekkür ederiz.</h2>
                    <p>Siparişlerinizle veya sistemimizle ilgili sorularınızı online olarak cevaplıyoruz! Hemen Yardım Merkezi'nden bize ulaşın!</p>
                </div>
                
                <div class="content-box">
                    <div class="details-title">Sipariş detayları:</div>
                    <table class="details-table">
                        <tr>
                            <td class="label">Satıcı:</td>
                            <td class="value">${orderData.sellerName}</td>
                        </tr>
                        <tr>
                            <td class="label">Sipariş zamanı:</td>
                            <td class="value">${orderData.date}</td>
                        </tr>
                        <tr>
                            <td class="label">Sipariş numarası:</td>
                            <td class="value">${orderData.orderNumber}</td>
                        </tr>
                        <tr>
                            <td class="label">Ödeme Yöntemi:</td>
                            <td class="value">${paymentText}</td>
                        </tr>
                    </table>
                    
                    <div class="divider"></div>
                    
                    <div class="details-title">Teslimat Bilgileri:</div>
                    <table class="details-table">
                        <tr>
                            <td class="label">İsim:</td>
                            <td class="value">${orderData.buyerName}</td>
                        </tr>
                        <tr>
                            <td class="label">Adres:</td>
                            <td class="value">${orderData.address}</td>
                        </tr>
                        <tr>
                            <td class="label">Telefon:</td>
                            <td class="value">${orderData.buyerPhone}</td>
                        </tr>
                    </table>
                    
                    <div style="text-align: center; margin: 20px 0;">
                        <div style="width: 60px; height: 3px; background-color: #6ee7b7; margin: 0 auto;"></div>
                    </div>
                    
                    <div class="message-body">
                        <p>Merhaba ${orderData.buyerName},</p>
                        <p>${orderData.sellerName} siparişiniz için teşekkürler!</p>
                    </div>
                    
                    <div class="signature">
                        Saygılarımızla,<br>
                        <span class="signature-brand">Ev Lezzetleri</span>
                    </div>
                    
                    <table class="items-table">
                        <tr class="items-header">
                            <td>Adet | Ürünler</td>
                            <td style="text-align: right;">Toplam</td>
                        </tr>
                        ${itemsHtml}
                        ${totalsHtml}
                    </table>
                </div>
                
                <div class="footer">
                    <p style="color: #dc2626; margin-bottom: 20px;">Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesini görüntülemek için tıklayınız...</p>
                    <p>Bu e-posta Ev Lezzetleri siparişinizi takiben gönderilmiştir.</p>
                    <p>Ev Lezzetleri Elektronik İletişim Perakende Gıda Anonim Şirketi<br>
                    © ${new Date().getFullYear()} Ev Lezzetleri. Tüm hakları saklıdır.</p>
                </div>
                
                <div class="bottom-banner">
                    Ev Lezzetleri
                </div>
            </div>
        </body>
        </html>
    `;
    return await sendEmail(email, `Siparişiniz Alındı - ${orderData.orderNumber}`, html);
}

async function sendFeedbackConfirmationEmail(email, ticketId, subject) {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #333333; background-color: #f5f5f5; margin: 0; padding: 20px 0; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
                .logo-header { text-align: center; padding: 20px; font-size: 28px; font-weight: 800; color: #dc2626; letter-spacing: -0.5px; }
                
                .banner { 
                    background: linear-gradient(90deg, #dc2626 0%, #ef4444 100%); 
                    color: white; 
                    text-align: center; 
                    padding: 40px 20px; 
                }
                .banner-icon { font-size: 40px; margin-bottom: 10px; display: inline-block; border: 2px solid white; border-radius: 50%; width: 60px; height: 60px; line-height: 60px; }
                .banner h2 { margin: 0; font-size: 24px; font-weight: 700; }
                .banner p { margin: 10px 0 0 0; font-size: 14px; opacity: 0.9; }

                .content-box { padding: 30px; }
                
                .details-title { font-weight: bold; font-size: 16px; margin-bottom: 15px; }
                .details-table { width: 100%; font-size: 13px; color: #555; border-collapse: collapse; margin-bottom: 25px; }
                .details-table td { padding: 4px 0; }
                .details-table td.label { width: 30%; font-weight: 600; }
                .details-table td.value { text-align: right; }
                
                .divider { border-top: 2px dashed #e0e0e0; margin: 25px 0; }
                
                .message-body { font-size: 14px; color: #444; }
                .message-body p { margin-bottom: 15px; }
                
                .signature { font-size: 14px; margin-top: 30px; }
                .signature-brand { color: #dc2626; font-weight: bold; }
                
                .footer { text-align: center; padding: 20px 30px; font-size: 11px; color: #888; background-color: #ffffff; border-top: 1px solid #f0f0f0; }
                .social-icons { margin: 15px 0; }
                .social-icons span { display: inline-block; width: 30px; height: 30px; background-color: #dc2626; color: white; border-radius: 50%; line-height: 30px; font-size: 14px; margin: 0 5px; }
                .bottom-banner { background-color: #dc2626; color: white; text-align: center; padding: 15px; font-size: 18px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo-header">
                    Ev Lezzetleri
                </div>
                
                <div class="banner">
                    <div class="banner-icon">✓</div>
                    <h2>Talebiniz bize ulaşmıştır.<br>Teşekkür ederiz.</h2>
                    <p>Talebinizle ilgili en kısa sürede size dönüş yapacağız.</p>
                </div>
                
                <div class="content-box">
                    <div class="details-title">Talep detayları:</div>
                    <table class="details-table">
                        <tr>
                            <td class="label">Takip Numarası:</td>
                            <td class="value">#${ticketId}</td>
                        </tr>
                        <tr>
                            <td class="label">Konu:</td>
                            <td class="value">${subject}</td>
                        </tr>
                        <tr>
                            <td class="label">Tarih:</td>
                            <td class="value">${new Date().toLocaleString('tr-TR')}</td>
                        </tr>
                    </table>
                    
                    <div class="divider"></div>
                    
                    <div class="message-body">
                        <p>Merhaba,</p>
                        <p>Yardım talebinizi aldık ve sistemimize kaydettik. Destek ekibimiz belirttiğiniz konu hakkında incelemelerini tamamlayıp size en kısa süre içinde geri dönüş sağlayacaktır.</p>
                        <p>Bu süreçte gösterdiğiniz sabır için teşekkür ederiz.</p>
                    </div>
                    
                    <div class="signature">
                        Saygılarımızla,<br>
                        <span class="signature-brand">Ev Lezzetleri</span>
                    </div>
                    
                    <div class="divider"></div>
                </div>
                
                <div class="footer">
                    <p>Bu e-posta Ev Lezzetleri sistemi tarafından otomatik oluşturulmuştur. Lütfen cevaplamayınız.</p>
                    <p>Ev Lezzetleri Elektronik İletişim Perakende Gıda Anonim Şirketi<br>
                    © ${new Date().getFullYear()} Ev Lezzetleri. Tüm hakları saklıdır.</p>
                </div>
                
                <div class="bottom-banner">
                    Ev Lezzetleri
                </div>
            </div>
        </body>
        </html>
    `;
    return await sendEmail(email, `Talebiniz Alındı (#${ticketId}) - Ev Lezzetleri`, html);
}

module.exports = {
    sendEmail,
    sendVerificationCode,
    sendPasswordResetLink,
    sendSellerApprovalEmail,
    sendSellerRejectionEmail,
    sendCourierApprovalEmail,
    sendCourierRejectionEmail,
    sendPickupReadyEmail,
    sendFeedbackConfirmationEmail,
    sendOrderReceivedEmail,
    sendInvoiceEmail
};
