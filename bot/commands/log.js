const db = require('../services/database');

module.exports = (bot) => {
  bot.onText(/\/log/, (msg) => {

    db.query(`
      SELECT u.nama, l.status, l.metode, l.waktu
      FROM log_akses l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.id DESC
      LIMIT 5
    `, (err, results) => {

      if (err) {
        console.log(err);
        return bot.sendMessage(msg.chat.id, "❌ Error ambil data");
      }

      if (results.length === 0) {
        return bot.sendMessage(msg.chat.id, "📭 Belum ada data");
      }

      let text = "📋 *Log Akses Terakhir:*\n\n";

      results.forEach((row) => {
        text += `👤 ${row.nama || "Unknown"}\n`;
        text += `📌 Status: ${row.status}\n`;
        text += `📡 Metode: ${row.metode}\n`;
        text += `🕒 ${row.waktu}\n\n`;
      });

      bot.sendMessage(msg.chat.id, text, {
        parse_mode: "Markdown"
      });

    });
  });
};
