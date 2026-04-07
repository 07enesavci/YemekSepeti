/**
 * Eski DB'lerde eksik sellers sütunlarını ekler (is_open, delivery_radius_km, latitude, longitude).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
    const sqlPath = path.join(__dirname, '..', 'sql', 'sellers_add_delivery_columns.sql');
    let sql = fs.readFileSync(sqlPath, 'utf8');
    sql = sql.replace(/--.*$/gm, '');
    const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: process.env.DB_CA_PATH ? { ca: fs.readFileSync(process.env.DB_CA_PATH) } : undefined
    });

    for (let i = 0; i < statements.length; i++) {
        const st = statements[i];
        try {
            await connection.query(st + ';');
            console.log(`OK ${i + 1}/${statements.length}`);
        } catch (err) {
            if (
                err.code === 'ER_DUP_FIELDNAME' ||
                (err.message && err.message.includes('Duplicate column'))
            ) {
                console.log(`Skip (already exists) ${i + 1}/${statements.length}`);
            } else {
                throw err;
            }
        }
    }
    await connection.end();
    console.log('Done.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
