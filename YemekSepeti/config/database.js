const mysql = require('mysql2/promise');
require('dotenv').config();

const isCloudDB = process.env.DB_HOST && (process.env.DB_HOST.includes('aivencloud.com') || process.env.DB_SSL === 'true');

const sslConfig = isCloudDB ? {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2',
    ...(process.env.DB_CA_PATH ? { ca: require('fs').readFileSync(process.env.DB_CA_PATH) } : {})
} : false;

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'yemek_sepeti',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    connectTimeout: 30000,
    ssl: sslConfig,
    timezone: '+00:00',
    dateStrings: false
};

const pool = mysql.createPool(dbConfig);

async function testConnection() {
    try {
        const connection = await pool.getConnection();
        connection.release();
        return true;
    } catch (error) {
        return false;
    }
}

async function query(sql, params = []) {
    try {
        const [rows] = await pool.execute(sql, params);
        return rows;
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ER_BAD_DB_ERROR') {
            return [];
        }
        throw error;
    }
}

async function execute(sql, params = []) {
    try {
        const [result] = await pool.execute(sql, params);
        return result;
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === 'ER_BAD_DB_ERROR') {
            return { insertId: 0, affectedRows: 0 };
        }
        throw error;
    }
}

const { sequelize: sequelizeInstance, testConnection: sequelizeTestConnection } = require('./sequelize');
const dbModels = require('../models');

module.exports = {
    pool,
    testConnection,
    query,
    execute,
    sequelize: sequelizeInstance,
    sequelizeTestConnection,
    models: dbModels
};
