require('dotenv').config(); // baca bot/.env langsung

const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');

const bot = new TelegramBot(config.token, { polling: true });

console.log("🤖 Bot berjalan...");

require('./commands/start')(bot);
require('./commands/status')(bot);
require('./commands/open')(bot);
require('./commands/close')(bot);
require('./commands/log')(bot);

bot.on('message', (msg) => {
  console.log("CHAT ID:", msg.chat.id);
});