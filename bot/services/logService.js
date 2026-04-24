const db = require('./database');

module.exports = {
  insertLog: (user_id, status, metode) => {
    db.query(
      "INSERT INTO log_akses (user_id, status, metode) VALUES (?, ?, ?)",
      [user_id, status, metode],
      (err) => {
        if (err) console.log("❌ Insert log error:", err);
      }
    );
  }
};
