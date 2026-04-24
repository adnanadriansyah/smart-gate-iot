module.exports = (bot) => {
  bot.onText(/\/open/, (msg) => {
    bot.sendMessage(msg.chat.id, "🔓 Gate Dibuka");
  });
};
