const express = require('express');
const app = express();

const http = require('http'); // ✅ WAJIB
const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server);

const path = require('path'); // ✅ cukup sekali

app.use(express.json());

// simpan io biar bisa dipakai di controller
app.set('io', io);

// static dashboard
app.use(express.static(path.join(__dirname, '../web-dashboard')));

// routes
const gateRoutes = require('./routes/gate');
app.use('/api/gate', gateRoutes);

// koneksi socket
io.on('connection', (socket) => {
  console.log("Client connected:", socket.id);
});

// jalankan server
server.listen(3000, () => {
  console.log("Server jalan di http://localhost:3000");
});
