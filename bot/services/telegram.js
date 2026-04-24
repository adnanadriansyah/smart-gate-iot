module.exports = {
  send: (bot, chatId, text) => {
    bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  }
};
