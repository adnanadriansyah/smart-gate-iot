require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

// ================= MIDDLEWARE =================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= GLOBAL SOCKET =================
app.set('io', io);

// ================= ROUTES =================
const gateRoutes = require('./routes/gate');
app.use('/api/gate', gateRoutes);

// ================= STATIC DASHBOARD =================
// Always serve built files from dist
const dashboardPath = path.join(__dirname, '../web-dashboard/dist');
app.use(express.static(dashboardPath));

// ================= ROOT DASHBOARD =================
app.get('/', (req, res) => {
  res.sendFile(path.join(dashboardPath, 'index.html'));
});

// ================= SOCKET CONNECTION =================
io.on('connection', (socket) => {
  const count = io.sockets.sockets.size;
  console.log(`✅ Client connected: ${socket.id} (total: ${count})`);

  // Send history to newly connected client
  const history = gateRoutes.getHistory();
  socket.emit('gate:history', history);
  console.log(`📤 Sent history (${history.length} entries) to ${socket.id}`);

  socket.on('disconnect', () => {
    const after = io.sockets.sockets.size;
    console.log(`❌ Client disconnected: ${socket.id} (remaining: ${after})`);
  });
});

// ================= ERROR HANDLER =================
app.use((err, req, res, next) => {
  console.log("Server Error:", err.stack);
  res.status(500).json({
    message: "Internal Server Error"
  });
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3000;

const sendWhatsApp = require('./services/whatsapp');
sendWhatsApp("✅ Smart Gate Server Aktif");

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server jalan di:`);
  console.log(`Local   : http://localhost:${PORT}`);
  console.log(`Network : http://0.0.0.0:${PORT}`);
});
