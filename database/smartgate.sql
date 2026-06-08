-- ============================================================
-- SMART GATE — Migration Script (MySQL Compatible)
-- Tanpa IF NOT EXISTS — kompatibel semua versi MySQL
-- Jalankan satu blok per satu, atau SOURCE file ini
-- ============================================================

USE smartgate;

-- ============================================================
-- 1. ALTER TABLE users — jalankan satu per satu
-- ============================================================

-- Perbesar kolom nama
ALTER TABLE users MODIFY COLUMN nama VARCHAR(100) NULL;

-- Ubah role jadi ENUM
ALTER TABLE users MODIFY COLUMN role ENUM('Admin','User','Tamu') NOT NULL DEFAULT 'User';

-- Tambah phone
ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL COMMENT 'Nomor WhatsApp (opsional)' AFTER role;

-- Tambah telegram_id
ALTER TABLE users ADD COLUMN telegram_id VARCHAR(30) NULL COMMENT 'Telegram chat_id (opsional)' AFTER phone;

-- Tambah is_active
ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=aktif, 0=nonaktif' AFTER telegram_id;

-- Tambah updated_at
ALTER TABLE users ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- Tambah index fingerprint_id (skip jika sudah ada)
ALTER TABLE users ADD INDEX idx_fingerprint_id (fingerprint_id);

-- Tambah index is_active
ALTER TABLE users ADD INDEX idx_is_active (is_active);

-- Cek hasil
DESCRIBE users;


-- ============================================================
-- 2. ALTER TABLE gate_status — jalankan satu per satu
-- ============================================================

ALTER TABLE gate_status ADD COLUMN servo_angle         TINYINT     NOT NULL DEFAULT 0   COMMENT '0=tutup, 90=buka'            AFTER status;
ALTER TABLE gate_status ADD COLUMN relay_state         TINYINT(1)  NOT NULL DEFAULT 0   COMMENT '0=OFF, 1=ON'                 AFTER servo_angle;
ALTER TABLE gate_status ADD COLUMN led_merah           TINYINT(1)  NOT NULL DEFAULT 1   COMMENT '1=nyala standby/tolak'       AFTER relay_state;
ALTER TABLE gate_status ADD COLUMN led_biru            TINYINT(1)  NOT NULL DEFAULT 0   COMMENT '1=nyala akses OK'            AFTER led_merah;
ALTER TABLE gate_status ADD COLUMN triggered_by        ENUM('Fingerprint','Telegram','Manual','Auto-Close') NULL              AFTER led_biru;
ALTER TABLE gate_status ADD COLUMN last_user_id        INT         NULL                 COMMENT 'user_id terakhir buka gate'  AFTER triggered_by;
ALTER TABLE gate_status ADD COLUMN last_fingerprint_id INT         NULL                 COMMENT 'fingerprint_id terakhir scan' AFTER last_user_id;

-- Foreign key last_user_id → users.id
ALTER TABLE gate_status ADD CONSTRAINT fk_gate_last_user FOREIGN KEY (last_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Cek hasil
DESCRIBE gate_status;


-- ============================================================
-- 3. SEED DATA
-- ============================================================

-- Users
INSERT IGNORE INTO users (fingerprint_id, nama, role, telegram_id) VALUES
  (1, 'Adnan Ardiansyah', 'Admin', '7253834202'),
  (2, 'User1',            'User',  NULL);

-- Gate status row permanen id=1
INSERT INTO gate_status (id, status, servo_angle, relay_state, led_merah, led_biru, triggered_by, last_user_id, last_fingerprint_id)
VALUES (1, 'TUTUP', 0, 0, 1, 0, NULL, NULL, NULL)
ON DUPLICATE KEY UPDATE
  status='TUTUP', servo_angle=0, relay_state=0,
  led_merah=1, led_biru=0, triggered_by=NULL,
  last_user_id=NULL, last_fingerprint_id=NULL;

SELECT 'Seed OK' AS status;


-- ============================================================
-- 4. BUAT TABEL BARU (aman dijalankan berulang)
-- ============================================================

CREATE TABLE IF NOT EXISTS log_akses (
  id             INT          NOT NULL AUTO_INCREMENT,
  fingerprint_id INT          NULL     COMMENT 'ID slot AS608 dari ESP32',
  user_id        INT          NULL     COMMENT 'Hasil lookup users. NULL=tidak terdaftar.',
  waktu          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status         ENUM('BERHASIL','GAGAL') NOT NULL,
  metode         ENUM('Fingerprint','Telegram','Manual') NOT NULL DEFAULT 'Fingerprint',
  servo_angle    TINYINT      NOT NULL DEFAULT 0,
  relay_state    TINYINT(1)   NOT NULL DEFAULT 0,
  buzzer_type    ENUM('BERHASIL','GAGAL','NONE') NOT NULL DEFAULT 'NONE',
  led_merah      TINYINT(1)   NOT NULL DEFAULT 1,
  led_biru       TINYINT(1)   NOT NULL DEFAULT 0,
  lcd_pesan      VARCHAR(32)  NULL,
  telegram_sent  TINYINT(1)   NOT NULL DEFAULT 0,
  telegram_chat  VARCHAR(30)  NULL,
  wifi_rssi      SMALLINT     NULL,
  esp_ip         VARCHAR(20)  NULL,
  PRIMARY KEY (id),
  INDEX idx_waktu          (waktu),
  INDEX idx_status         (status),
  INDEX idx_fingerprint_id (fingerprint_id),
  INDEX idx_user_id        (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS telegram_log (
  id            INT          NOT NULL AUTO_INCREMENT,
  chat_id       VARCHAR(30)  NOT NULL,
  direction     ENUM('IN','OUT') NOT NULL DEFAULT 'OUT',
  command       VARCHAR(100) NULL,
  message       TEXT         NULL,
  trigger_event ENUM('Akses Berhasil','Akses Gagal','Gate Buka','Gate Tutup','Sistem Aktif','Perintah User','Lainnya') NULL,
  log_akses_id  INT          NULL,
  status_kirim  ENUM('SUKSES','GAGAL','PENDING') NOT NULL DEFAULT 'SUKSES',
  waktu         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_chat_id (chat_id),
  INDEX idx_waktu   (waktu),
  FOREIGN KEY (log_akses_id) REFERENCES log_akses(id) ON DELETE SET NULL
) ENGINE=InnoDB;

SELECT 'Tabel baru OK' AS status;


-- ============================================================
-- 5. STORED PROCEDURES
-- ============================================================

DELIMITER $$

DROP PROCEDURE IF EXISTS catat_akses$$
CREATE PROCEDURE catat_akses(
  IN p_fingerprint_id  INT,
  IN p_status          VARCHAR(10),
  IN p_metode          VARCHAR(20),
  IN p_servo_angle     TINYINT,
  IN p_relay_state     TINYINT,
  IN p_buzzer_type     VARCHAR(10),
  IN p_led_merah       TINYINT,
  IN p_led_biru        TINYINT,
  IN p_lcd_pesan       VARCHAR(32),
  IN p_telegram_sent   TINYINT,
  IN p_telegram_chat   VARCHAR(30),
  IN p_wifi_rssi       SMALLINT,
  IN p_esp_ip          VARCHAR(20)
)
BEGIN
  DECLARE v_user_id     INT DEFAULT NULL;
  DECLARE v_log_id      INT;
  DECLARE v_gate_status VARCHAR(5);

  SELECT id INTO v_user_id
  FROM users
  WHERE fingerprint_id = p_fingerprint_id AND is_active = 1
  LIMIT 1;

  INSERT INTO log_akses (
    fingerprint_id, user_id, status, metode,
    servo_angle, relay_state, buzzer_type,
    led_merah, led_biru, lcd_pesan,
    telegram_sent, telegram_chat, wifi_rssi, esp_ip
  ) VALUES (
    p_fingerprint_id, v_user_id, p_status, p_metode,
    p_servo_angle, p_relay_state, p_buzzer_type,
    p_led_merah, p_led_biru, p_lcd_pesan,
    p_telegram_sent, p_telegram_chat, p_wifi_rssi, p_esp_ip
  );
  SET v_log_id = LAST_INSERT_ID();

  SET v_gate_status = IF(p_status = 'BERHASIL', 'BUKA', 'TUTUP');

  UPDATE gate_status SET
    status              = v_gate_status,
    servo_angle         = p_servo_angle,
    relay_state         = p_relay_state,
    led_merah           = p_led_merah,
    led_biru            = p_led_biru,
    triggered_by        = p_metode,
    last_user_id        = v_user_id,
    last_fingerprint_id = p_fingerprint_id
  WHERE id = 1;

  SELECT v_log_id AS log_id, v_user_id AS user_id;
END$$

DROP PROCEDURE IF EXISTS tutup_gate$$
CREATE PROCEDURE tutup_gate()
BEGIN
  UPDATE gate_status SET
    status='TUTUP', servo_angle=0, relay_state=0,
    led_merah=1, led_biru=0, triggered_by='Auto-Close'
  WHERE id=1;
END$$

DELIMITER ;

SELECT 'Procedures OK' AS status;


-- ============================================================
-- 6. VIEWS
-- ============================================================

CREATE OR REPLACE VIEW v_log_akses AS
SELECT
  l.id, l.fingerprint_id, l.user_id,
  COALESCE(u.nama, CONCAT('FP-', LPAD(l.fingerprint_id, 3, '0'))) AS nama,
  u.role, l.status, l.metode,
  l.servo_angle, l.relay_state, l.buzzer_type,
  l.led_merah, l.led_biru, l.lcd_pesan,
  l.telegram_sent, l.wifi_rssi, l.esp_ip, l.waktu
FROM log_akses l
LEFT JOIN users u ON l.user_id = u.id
ORDER BY l.waktu DESC;

CREATE OR REPLACE VIEW v_statistik_harian AS
SELECT
  DATE(waktu) AS tanggal, COUNT(*) AS total_akses,
  SUM(status='BERHASIL') AS berhasil, SUM(status='GAGAL') AS gagal,
  ROUND(SUM(status='BERHASIL')/COUNT(*)*100,1) AS pct_berhasil,
  MIN(waktu) AS akses_pertama, MAX(waktu) AS akses_terakhir
FROM log_akses GROUP BY DATE(waktu) ORDER BY tanggal DESC;

CREATE OR REPLACE VIEW v_aktivitas_per_jam AS
SELECT
  HOUR(waktu) AS jam, COUNT(*) AS total,
  SUM(status='BERHASIL') AS berhasil, SUM(status='GAGAL') AS gagal
FROM log_akses WHERE DATE(waktu) = CURDATE()
GROUP BY HOUR(waktu) ORDER BY jam;

SELECT 'Views OK' AS status;


-- ============================================================
-- CEK AKHIR — semua tabel
-- ============================================================
SHOW TABLES;