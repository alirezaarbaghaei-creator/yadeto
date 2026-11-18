-- ============================================================
--  Smart Calendar (تقویم هوشمند) — MySQL Database Schema (Complete)
--  Run this once in phpMyAdmin or MySQL CLI to create all tables.
--  After running, the PHP API will auto-seed default settings
--  and a default admin user (phone: 09120000000, password: admin123).
-- ============================================================

-- 1. Users
CREATE TABLE IF NOT EXISTS YADETO_users (
    id CHAR(36) PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    full_name TEXT DEFAULT '',
    password_hash TEXT NULL,
    is_admin TINYINT(1) DEFAULT 0,
    coins INT DEFAULT 10,
    plan_type VARCHAR(20) DEFAULT 'free',
    ai_assistant_usage_this_month INT DEFAULT 0,
    template_usage_this_month INT DEFAULT 0,
    usage_cycle_start DATETIME NULL,
    plan_expires_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. OTP Codes
CREATE TABLE IF NOT EXISTS YADETO_otp_codes (
    id CHAR(36) PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at DATETIME NOT NULL,
    used TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_otp_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Sessions
CREATE TABLE IF NOT EXISTS YADETO_sessions (
    token VARCHAR(64) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    INDEX idx_sessions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Settings (single-row table — all non-DB secrets stored here)
CREATE TABLE IF NOT EXISTS YADETO_settings (
    id INT PRIMARY KEY DEFAULT 1,
    sms_api_key TEXT DEFAULT '',
    sms_pattern_code TEXT DEFAULT '',
    sms_line_number TEXT DEFAULT '',
    ai_api_url TEXT DEFAULT '',
    ai_api_key TEXT DEFAULT '',
    ai_models TEXT DEFAULT '',
    zarinpal_merchant_id TEXT DEFAULT '',
    zarinpal_sandbox TINYINT(1) DEFAULT 1,
    bazaar_client_id TEXT DEFAULT '',
    bazaar_client_secret TEXT DEFAULT '',
    bazaar_refresh_token TEXT DEFAULT '',
    bazaar_access_token TEXT DEFAULT '',
    bazaar_access_token_expires DATETIME NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT single_row CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Calendar Tasks
CREATE TABLE IF NOT EXISTS calendar_tasks (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    title TEXT DEFAULT '',
    description TEXT NULL,
    due_date DATE NOT NULL,
    due_time TIME NULL,
    duration INT DEFAULT 60,
    priority VARCHAR(10) DEFAULT 'medium',
    category VARCHAR(20) DEFAULT 'other',
    status VARCHAR(12) DEFAULT 'pending',
    recurrence VARCHAR(10) DEFAULT 'none',
    day_of_month INT NULL,
    month_of_year INT NULL,
    reminder INT NULL,
    completed_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cal_tasks_user (user_id),
    INDEX idx_cal_tasks_due (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Calendar Events
CREATE TABLE IF NOT EXISTS calendar_events (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    title TEXT DEFAULT '',
    description TEXT NULL,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NULL,
    location TEXT NULL,
    category VARCHAR(20) DEFAULT 'work',
    color VARCHAR(7) DEFAULT '#4f46e5',
    reminder INT NULL,
    recurrence VARCHAR(10) DEFAULT 'none',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cal_events_user (user_id),
    INDEX idx_cal_events_date (event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Calendar Preferences
CREATE TABLE IF NOT EXISTS calendar_preferences (
    user_id CHAR(36) PRIMARY KEY,
    dark_mode TINYINT(1) DEFAULT 0,
    persian_numbers TINYINT(1) DEFAULT 1,
    work_start VARCHAR(5) DEFAULT '08:00',
    work_end VARCHAR(5) DEFAULT '20:00',
    work_days TEXT DEFAULT '[0,1,2,3,4]',
    default_reminder INT DEFAULT 15,
    notifications_enabled TINYINT(1) DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Coin Orders (Zarinpal)
CREATE TABLE IF NOT EXISTS coin_orders (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    amount_toman INT NOT NULL,
    coins INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    authority TEXT DEFAULT '',
    ref_id TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME NULL,
    INDEX idx_orders_user (user_id),
    INDEX idx_orders_authority (authority(50))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Plan Orders (Zarinpal + Cafe Bazaar)
CREATE TABLE IF NOT EXISTS plan_orders (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    plan_id VARCHAR(20) NOT NULL,
    amount_toman INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    authority TEXT DEFAULT '',
    ref_id TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME NULL,
    duration_months INT NOT NULL DEFAULT 1,
    payment_provider VARCHAR(20) DEFAULT 'zarinpal',
    product_id VARCHAR(100) DEFAULT '',
    purchase_token TEXT DEFAULT '',
    bazaar_purchase_id TEXT NULL,
    INDEX idx_plan_orders_user (user_id),
    INDEX idx_plan_orders_authority (authority(50)),
    INDEX idx_plan_orders_purchase_token (purchase_token(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  Default settings row (edit these values after importing)
-- ============================================================
INSERT INTO YADETO_settings (id, sms_api_key, sms_pattern_code, sms_line_number, ai_api_url, ai_api_key, ai_models, zarinpal_merchant_id, zarinpal_sandbox)
VALUES (1, '', '', '', 'https://ai.parspack.com/v1', '', 'qwen/qwen3-32b', '00000000-0000-0000-0000-000000000000', 1)
ON DUPLICATE KEY UPDATE id = id;

-- ============================================================
--  Default admin user (phone: 09120000000, password: admin123)
--  Password hash is SHA-256 of 'admin123'
-- ============================================================
INSERT INTO YADETO_users (id, phone, full_name, is_admin, password_hash, coins)
VALUES ('a0000000-0000-0000-0000-000000000001', '09120000000', 'مدیر سیستم', 1, '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 100)
ON DUPLICATE KEY UPDATE is_admin = 1;
