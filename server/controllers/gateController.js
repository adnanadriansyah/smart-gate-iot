const db = require('../config/db');

// ================= LOG AKSES =================
exports.logAkses = (req, res) => {
  const { user_id, status, metode } = req.body;
  const io = req.app.get('io'); // 🔥 ambil socket

  console.log("Data masuk:", req.body);

  if (!status || !metode) {
    return res.status(400).json({ message: "Data tidak lengkap" });
  }

  // simpan log
  db.query(
    "INSERT INTO log_akses (user_id, status, metode) VALUES (?, ?, ?)",
    [user_id || null, status, metode],
    (err) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "DB Error" });
      }

      // 🔥 tentukan status gate
      let gateStatus = status === "BERHASIL" ? "BUKA" : "TUTUP";

      // update status gate
      db.query(
        "INSERT INTO gate_status (status) VALUES (?)",
        [gateStatus]
      );

      // ================= REALTIME =================
      io.emit("gate_update", {
        user_id: user_id || "Unknown",
        status: gateStatus,
        metode: metode,
        waktu: new Date()
      });

      res.json({ message: "Log tersimpan & realtime terkirim" });
    }
  );
};



// ================= GET STATUS =================
exports.getStatus = (req, res) => {
  db.query(
    "SELECT status, updated_at FROM gate_status ORDER BY id DESC LIMIT 1",
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result[0]);
    }
  );
};



// ================= GET LOG =================
exports.getLogs = (req, res) => {
  db.query(`
    SELECT u.nama, l.status, l.metode, l.waktu
    FROM log_akses l
    LEFT JOIN users u ON l.user_id = u.id
    ORDER BY l.id DESC LIMIT 10
  `, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
};
