const axios = require("axios");
const FormData = require("form-data");
require("dotenv").config();

const sendWhatsApp = async (message, targets = null) => {
  try {
    const targetList = targets || [process.env.OWNER_NUMBER];
    const results = [];

    for (const target of targetList) {
      const form = new FormData();
      form.append("target", target);
      form.append("message", message);
      form.append("countryCode", "62");

      const response = await axios.post(
        "https://api.fonnte.com/send",
        form,
        {
          headers: {
            Authorization: (process.env.FONNTE_TOKEN || "").trim(),
            ...form.getHeaders(),
            Accept: "application/json"
          }
        }
      );

      console.log("✅ WhatsApp Sent to", target, ":", response.data);
      results.push({ target, success: true, data: response.data });
    }

    return results;
  } catch (error) {
    console.log(
      "❌ WhatsApp Error:",
      error.response?.data || error.message
    );
    return [{ success: false, error: error.response?.data || error.message }];
  }
};

module.exports = sendWhatsApp;
