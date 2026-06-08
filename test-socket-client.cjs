const { io } = require("./node_modules/socket.io-client");

const socket = io("http://localhost:3000", {
  transports: ["websocket", "polling"]
});

socket.on("connect", () => {
  console.log("✅ Connected:", socket.id);
});

socket.on("gate:history", (data) => {
  console.log("📜 History received (", data.length, "entries )");
});

socket.on("gate:log", (entry) => {
  console.log("📡 Log event:", JSON.stringify(entry));
});

socket.on("disconnect", (reason) => {
  console.log("❌ Disconnected:", reason);
});

socket.on("connect_error", (err) => {
  console.error("🔴 Connect error:", err.message);
});

// Auto exit after 30 seconds
setTimeout(() => {
  console.log("⏱ Test timeout, exiting");
  socket.disconnect();
  process.exit(0);
}, 30000);
