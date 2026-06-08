const { io } = require("socket.io-client");

const socket = io("http://localhost:3000", {
  transports: ["websocket", "polling"]
});

socket.on("connect", () => {
  console.log("✅ Connected:", socket.id);
});

socket.on("gate:history", (data) => {
  console.log("📜 Received history (", data.length, "entries )");
  if (data.length > 0) {
    console.log("   Latest:", data[0]);
  }
});

socket.on("gate:log", (entry) => {
  console.log("📡 Received gate:log:", entry);
});

socket.on("disconnect", (reason) => {
  console.log("❌ Disconnected:", reason);
});

socket.on("connect_error", (err) => {
  console.error("🔴 Connect error:", err.message);
});

// Keep process alive
process.stdin.on('data', () => {
  socket.disconnect();
  process.exit(0);
});

console.log("Listening for events. Press Enter to exit...");
