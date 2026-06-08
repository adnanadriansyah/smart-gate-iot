const axios = require('axios');

const sendTelegram = async (message, chatId = null) => {
  try {
    const token  = process.env.TELEGRAM_TOKEN;
    const target = chatId || process.env.TELEGRAM_CHAT_ID;

    if (!token || !target) {
      console.warn('⚠️  Telegram: TOKEN atau CHAT_ID tidak ada di .env');
      return { success: false, error: 'Missing config' };
    }

    const response = await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        chat_id:    target,
        text:       message,
        parse_mode: 'HTML',
      }
    );

    console.log('✅ Telegram Sent:', response.data?.result?.message_id);
    return { success: true, data: response.data };

  } catch (error) {
    console.error('❌ Telegram Error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
};

module.exports = sendTelegram;