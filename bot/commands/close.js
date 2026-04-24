module.exports = (bot) => {
  bot.onText(/\/log/, (msg) => {
    bot.sendMessage(msg.chat.id, "📋 Ambil log...");
  });
};
