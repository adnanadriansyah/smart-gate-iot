// ============================================================
// config/db.js — Koneksi MySQL (mysql2 + promise pool)
// ============================================================

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || '127.0.0.1',
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'smartgate',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+07:00', // WIB
});

// Test koneksi saat server start
pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL terhubung ke database:', process.env.DB_NAME || 'smartgate');
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL gagal konek:', err.message);
    console.error('   Pastikan DB_HOST, DB_USER, DB_PASSWORD, DB_NAME di .env sudah benar');
  });

module.exports = pool;