module.exports = {
  formatStatus: (status) => {
    return `🚪 Status Gate: *${status}*`;
  },

  formatLog: (logs) => {
    let text = "📋 *Log Akses:*\n";
    logs.forEach(l => {
      text += `${l.status} ${l.nama} - ${l.waktu}\n`;
    });
    return text;
  }
};
