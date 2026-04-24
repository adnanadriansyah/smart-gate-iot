CREATE DATABASE smartgate;
USE smartgate;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fingerprint_id INT UNIQUE,
  nama VARCHAR(50),
  role VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE log_akses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  waktu TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('BERHASIL','GAGAL'),
  metode VARCHAR(20), -- fingerprint / telegram
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE gate_status (
  id INT AUTO_INCREMENT PRIMARY KEY,
  status ENUM('BUKA','TUTUP'),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE telegram_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chat_id VARCHAR(20),
  command VARCHAR(50),
  waktu TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (fingerprint_id, nama, role)
VALUES 
(1, 'Adnan', 'Admin'),
(2, 'User1', 'User');

INSERT INTO gate_status (status)
VALUES ('TUTUP');
