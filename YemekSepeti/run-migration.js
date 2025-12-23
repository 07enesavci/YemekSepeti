require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function runMigration() {
    let connection;
    
    try {
        // Veritabanı bağlantısı
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: process.env.DB_CA_PATH ? { ca: fs.readFileSync(process.env.DB_CA_PATH) } : undefined
        });

        console.log('✅ Veritabanı bağlantısı başarılı');

        // SQL dosyasını oku
        const sqlPath = path.join(__dirname, 'database', 'migrations', 'add_2fa_and_email_verification.sql');
        let sql = fs.readFileSync(sqlPath, 'utf8');

        // Yorumları ve USE komutunu temizle
        sql = sql.replace(/--.*$/gm, ''); // Satır yorumlarını kaldır
        sql = sql.replace(/USE\s+\w+\s*;/gi, ''); // USE komutunu kaldır
        
        // SQL komutlarını ayır (noktalı virgül ile)
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.match(/^\s*$/));

        console.log(`📝 ${statements.length} SQL komutu bulundu`);

        // Her komutu çalıştır
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.length > 0) {
                try {
                    await connection.query(statement + ';');
                    console.log(`✅ Komut ${i + 1}/${statements.length} başarıyla çalıştırıldı`);
                } catch (error) {
                    // Eğer tablo zaten varsa veya kolon zaten varsa hata verme
                    if (error.code === 'ER_DUP_FIELDNAME' || 
                        error.code === 'ER_TABLE_EXISTS_ERROR' ||
                        error.code === 'ER_DUP_ENTRY' ||
                        error.message.includes('Duplicate column') ||
                        error.message.includes('already exists')) {
                        console.log(`⚠️  Komut ${i + 1}/${statements.length} zaten mevcut, atlanıyor`);
                    } else {
                        console.error(`❌ Komut ${i + 1} hatası:`, error.message);
                        throw error;
                    }
                }
            }
        }

        console.log('\n✅ Migration başarıyla tamamlandı!');
        
    } catch (error) {
        console.error('❌ Migration hatası:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

runMigration();

