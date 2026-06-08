# 🚪 Smart Gate IoT
Sistem Smart Gate berbasis ESP32 + Fingerprint + Telegram + WhatsApp + Web Dashboard Realtime.

## 📌 Fitur Utama
- 🔐 Akses Fingerprint Sensor
- 🚪 Kontrol Servo & Relay Pintu
- 📲 Notifikasi Telegram Bot
- 💬 Notifikasi WhatsApp (Fonnte)
- 🌐 Web Dashboard Realtime (Socket.IO)
- 🗄️ Database MySQL untuk log akses
- 📊 Riwayat akses berhasil/gagal

---

## 🛠️ Teknologi
### Hardware:
- ESP32
- Fingerprint Sensor AS608 / R307
- Servo SG90 / MG996R
- Relay Module
- Buzzer
- LED Indicator

### Software:
- Arduino IDE
- Node.js + Express
- MySQL
- Socket.IO
- Telegram Bot API
- Fonnte API
- HTML/CSS/JavaScript Dashboard

---

## 📂 Struktur Folder
```bash
smart-gate-iot/
│
├── server/
│   ├── app.js
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   └── config/
│
├── web-dashboard/
│   ├── index.html
│   ├── script.js
│   └── style.css
│
└── esp32/
    └── smart_gate.ino
