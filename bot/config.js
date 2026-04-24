require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

module.exports = {
  token: process.env.BOT_TOKEN
};
