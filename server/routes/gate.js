// ============================================================
// routes/gate.js — Smart Gate API
// Alur: ESP32 → POST /api/gate/log → MySQL → Socket.IO → Dashboard
// ============================================================

const express       = require('express');
const router        = express.Router();
const db            = require('../config/db');
const sendTelegram  = require('../services/telegram'); // ← tambah ini

// ── In-memory cache (untuk gate:history ke dashboard baru konek) ──
const MAX_CACHE = 100;
let logCache = [];

// ============================================================
// POST /api/gate/log
// ============================================================
router.post('/log', async (req, res) => {
  const io = req.app.get('io');

  try {
    const {
      fingerprint_id,
      status,
      metode        = 'Fingerprint',
      servo_angle,
      relay_state,
      buzzer_type   = 'NONE',
      led_merah,
      led_biru,
      lcd_pesan     = null,
      telegram_sent = 0,
      telegram_chat = null,
      wifi_rssi     = null,
      esp_ip        = null,
    } = req.body;

    if (!fingerprint_id || !status) {
      return res.status(400).json({
        message: 'fingerprint_id dan status wajib diisi'
      });
    }

    const isOk = String(status).toUpperCase() === 'BERHASIL';

    const servoVal = servo_angle !== undefined ? servo_angle : (isOk ? 90 : 0);
    const relayVal = relay_state !== undefined ? relay_state : (isOk ? 1  : 0);
    const redVal   = led_merah   !== undefined ? led_merah   : (isOk ? 0  : 1);
    const blueVal  = led_biru    !== undefined ? led_biru    : (isOk ? 1  : 0);
    const buzzer   = buzzer_type !== 'NONE'    ? buzzer_type : (isOk ? 'BERHASIL' : 'GAGAL');
    const lcdPesan = lcd_pesan || (isOk ? 'Akses Diterima' : 'Akses Ditolak');

    const [rows] = await db.query(
      `CALL catat_akses(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fingerprint_id,
        status,
        metode,
        servoVal,
        relayVal,
        buzzer,
        redVal,
        blueVal,
        lcdPesan,
        telegram_sent,
        telegram_chat,
        wifi_rssi,
        esp_ip,
      ]
    );

    const result  = rows[0][0];
    const log_id  = result?.log_id  || null;
    const user_id = result?.user_id || null;

    const fpLabel = user_id
      ? `FP-${String(fingerprint_id).padStart(3, '0')}`
      : 'TIDAK DIKENAL';

    const entry = {
      id:             log_id,
      fingerprint_id: fingerprint_id,
      user_id:        user_id,
      fp_label:       fpLabel,
      status:         status,
      metode:         metode,
      servo_angle:    servoVal,
      relay_state:    relayVal,
      led_merah:      redVal,
      led_biru:       blueVal,
      buzzer_type:    buzzer,
      lcd_pesan:      lcdPesan,
      wifi_rssi:      wifi_rssi,
      esp_ip:         esp_ip,
      created_at:     new Date().toISOString(),
    };

    logCache.unshift(entry);
    if (logCache.length > MAX_CACHE) logCache.pop();

    // Broadcast ke dashboard
    const clientCount = io.sockets.sockets.size;
    io.emit('gate:log', entry);
    console.log(`📡 gate:log → FP-${fingerprint_id} (user_id=${user_id}) → ${status} → ${clientCount} client(s)`);

    // ── Notif Telegram ────────────────────────────────────────
    const waktu = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const icon  = isOk ? '✅' : '❌';
    const notif = [
      `${icon} <b>Smart Gate — ${lcdPesan}</b>`,
      ``,
      `🔑 Fingerprint : <code>${fpLabel}</code>`,
      `👤 User ID     : <code>${user_id ?? 'Tidak Dikenal'}</code>`,
      `📋 Status      : <b>${status}</b>`,
      `🔧 Metode      : ${metode}`,
      `🕐 Waktu       : ${waktu}`,
      `📶 WiFi RSSI   : ${wifi_rssi ?? '-'} dBm`,
      `🌐 ESP IP      : ${esp_ip ?? '-'}`,
    ].join('\n');

    sendTelegram(notif).catch(e =>
      console.error('❌ Telegram notify error:', e.message)
    );
    // ─────────────────────────────────────────────────────────

    // Auto-close gate setelah 5 detik jika berhasil
    if (isOk) {
      setTimeout(async () => {
        try {
          await db.query('CALL tutup_gate()');
          console.log('🔒 Gate ditutup otomatis (auto-close 5s)');
        } catch (e) {
          console.error('❌ Auto-close gate error:', e.message);
        }
      }, 5000);
    }

    return res.status(200).json({ message: 'OK', data: entry });

  } catch (err) {
    console.error('❌ POST /api/gate/log error:', err.message);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ============================================================
// GET /api/gate/logs
// ============================================================
router.get('/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const [rows] = await db.query(
      `SELECT * FROM v_log_akses LIMIT ?`,
      [limit]
    );
    return res.json(rows);
  } catch (err) {
    console.error('❌ GET /api/gate/logs error:', err.message);
    return res.json(logCache);
  }
});

// ============================================================
// GET /api/gate/status
// ============================================================
router.get('/status', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM gate_status WHERE id = 1 LIMIT 1`
    );
    return res.json(rows[0] || { status: 'TUTUP' });
  } catch (err) {
    console.error('❌ GET /api/gate/status error:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================
// GET /api/gate/stats
// ============================================================
router.get('/stats', async (req, res) => {
  try {
    const [[today]] = await db.query(
      `SELECT
         COUNT(*)                                           AS total,
         SUM(status = 'BERHASIL')                          AS berhasil,
         SUM(status = 'GAGAL')                             AS gagal,
         ROUND(SUM(status='BERHASIL') / COUNT(*) * 100, 1) AS pct
       FROM log_akses
       WHERE DATE(waktu) = CURDATE()`
    );
    const [perJam] = await db.query(
      `SELECT * FROM v_aktivitas_per_jam`
    );
    return res.json({ today, perJam });
  } catch (err) {
    console.error('❌ GET /api/gate/stats error:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ── Export ───────────────────────────────────────────────────
module.exports = router;
module.exports.getHistory = () => logCache;