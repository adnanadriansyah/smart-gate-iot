module.exports = (bot) => {
  bot.onText(/\/status/, (msg) => {
    bot.sendMessage(msg.chat.id, "🚪 Gate: Tertutup");
  });
};
