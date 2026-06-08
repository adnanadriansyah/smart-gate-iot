// Hapus require dotenv di sini (sudah dipanggil di bot.js)
module.exports = {
  token: process.env.TELEGRAM_TOKEN,   // ← ganti BOT_TOKEN → TELEGRAM_TOKEN
  chatId: process.env.TELEGRAM_CHAT_ID
};