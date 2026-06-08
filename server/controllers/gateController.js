const db = require('../config/db');
const sendWhatsApp = require('../services/whatsapp');

// ================= LOG AKSES =================
exports.logAkses = async (req, res) => {
  const { user_id, status, metode } = req.body;
  const io = req.app.get('io');

  console.log("Data masuk:", req.body);

  if (!status || !metode) {
    return res.status(400).json({
      message: "Data tidak lengkap"
    });
  }

  const gateStatus = status === "BERHASIL" ? "BUKA" : "TUTUP";
  const now = new Date().toLocaleString("id-ID");

  let waMessage =
`🚪 SMART GATE
━━━━━━━━━━━━━━
${status === "BERHASIL" ? "✅ Akses BERHASIL" : "❌ Akses GAGAL"}
👤 User ID: ${user_id || "Unknown"}
🔐 Metode: ${metode}
🕒 ${now}
━━━━━━━━━━━━━━`;

db.query(
     "INSERT INTO log_akses (user_id, status, metode) VALUES (?, ?, ?)",
     [user_id || null, status, metode],
     async (err, result) => {
       if (err) {
         console.log("DB Error:", err);
         return res.status(500).json({ message: "DB Error" });
       }

       db.query(
         "INSERT INTO gate_status (status) VALUES (?)",
         [gateStatus]
       );

       db.query(
         "SELECT phone FROM users WHERE phone IS NOT NULL AND phone != ''",
         (err, users) => {
           const phones = users.map(u => u.phone);
           sendWhatsApp(waMessage, phones.length > 0 ? phones : null);
         }
       );

       io.emit("gate_update", {
         user_id: user_id || "Unknown",
         status: gateStatus,
         metode,
         waktu: now
       });

       res.json({
         message: "Log tersimpan + Realtime + WhatsApp terkirim",
         log_id: result.insertId,
         gate_status: gateStatus
       });
     }
   );
};

// ================= GET STATUS =================
exports.getStatus = (req, res) => {
  db.query(
    "SELECT status, updated_at FROM gate_status ORDER BY id DESC LIMIT 1",
    (err, result) => {
      if (err) {
        return res.status(500).json({ message: "DB Error" });
      }

      if (result.length === 0) {
        return res.json({
          status: "UNKNOWN",
          updated_at: null
        });
      }

      res.json(result[0]);
    }
  );
};

// ================= GET LOGS =================
exports.getLogs = (req, res) => {
  db.query(
    `
    SELECT 
      COALESCE(u.nama, 'Unknown') AS nama,
      l.status,
      l.metode,
      l.waktu
    FROM log_akses l
    LEFT JOIN users u ON l.user_id = u.id
    ORDER BY l.id DESC
    LIMIT 10
    `,
    (err, result) => {
      if (err) {
        return res.status(500).json({ message: "DB Error" });
      }

      res.json(result);
    }
  );
};
