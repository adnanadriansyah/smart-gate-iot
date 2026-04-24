require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');

const bot = new TelegramBot(config.token, { polling: true });

console.log("🤖 Bot berjalan...");

// Load semua command
require('./commands/start')(bot);
require('./commands/status')(bot);
require('./commands/open')(bot);
require('./commands/close')(bot);
require('./commands/log')(bot);

// Debug chat ID
bot.on('message', (msg) => {
  console.log("CHAT ID:", msg.chat.id);
});
