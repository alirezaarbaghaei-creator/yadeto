<?php
/**
 * Kateb JSON API — single-entry PHP backend
 *
 * Upload this entire `php-api/` folder to your hosting (e.g. inside public_html/api/).
 * The frontend talks to this file via POST with a JSON body: { "action": "...", ...params }
 *
 * On first run it automatically creates all required MySQL tables.
 */

error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', '0');
set_time_limit(120);
ini_set('max_execution_time', '120');

// ─── CORS ─────────────────────────────────────────────────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Client-Info, Apikey');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ─── Config ───────────────────────────────────────────────────
$config = require __DIR__ . '/config.php';

// ─── Database ─────────────────────────────────────────────────
function db(): PDO {
    global $config;
    static $pdo = null;
    if ($pdo !== null) return $pdo;
    $dsn = "mysql:host={$config['db_host']};dbname={$config['db_name']};charset={$config['db_charset']}";
    try {
        $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        json_error('خطا در اتصال به دیتابیس', 500);
    }
    return $pdo;
}

// ─── Helpers ──────────────────────────────────────────────────
function json_out($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $msg, int $status = 400): void {
    json_out(['error' => $msg], $status);
}

function body(): array {
    static $b = null;
    if ($b === null) {
        $raw = file_get_contents('php://input');
        $b = json_decode($raw, true) ?? [];
    }
    return $b;
}

function action(): string {
    // The frontend sends action inside the JSON body for most calls.
    $a = body()['action'] ?? '';
    if ($a) return $a;
    // For ai_proxy the action comes as a query param.
    return $_GET['action'] ?? '';
}

function gen_uuid(): string {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function gen_token(): string {
    return bin2hex(random_bytes(32));
}

function gen_otp(): string {
    return str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

function hash_password(string $pw): string {
    return hash('sha256', $pw);
}

function get_auth_token(): ?string {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $h, $m)) return trim($m[1]);
    return null;
}

function now_iso(): string {
    return date('Y-m-d H:i:s');
}

// ─── Table Auto-Creation ──────────────────────────────────────
function init_tables(): void {
    $pdo = db();
    $ddl = [
        "CREATE TABLE IF NOT EXISTS kateb_users (
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS kateb_otp_codes (
            id CHAR(36) PRIMARY KEY,
            phone VARCHAR(20) NOT NULL,
            code VARCHAR(6) NOT NULL,
            expires_at DATETIME NOT NULL,
            used TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_otp_phone (phone)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS kateb_sessions (
            token VARCHAR(64) PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            phone VARCHAR(20) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            INDEX idx_sessions_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS kateb_settings (
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
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT single_row CHECK (id = 1)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS calendar_tasks (
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
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_cal_tasks_user (user_id),
            INDEX idx_cal_tasks_due (due_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS calendar_events (
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
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_cal_events_user (user_id),
            INDEX idx_cal_events_date (event_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS calendar_preferences (
            user_id CHAR(36) PRIMARY KEY,
            dark_mode TINYINT(1) DEFAULT 0,
            persian_numbers TINYINT(1) DEFAULT 1,
            work_start VARCHAR(5) DEFAULT '08:00',
            work_end VARCHAR(5) DEFAULT '20:00',
            work_days TEXT DEFAULT '[0,1,2,3,4]',
            default_reminder INT DEFAULT 15,
            notifications_enabled TINYINT(1) DEFAULT 1,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS coin_orders (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS plan_orders (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    ];

    foreach ($ddl as $sql) {
        $pdo->exec($sql);
    }

    // Add plan/usage columns to existing kateb_users table if missing
    $cols = $pdo->query("SHOW COLUMNS FROM kateb_users")->fetchAll(PDO::FETCH_COLUMN);
    $addCols = [
        'plan_type' => "ADD COLUMN plan_type VARCHAR(20) DEFAULT 'free'",
        'ai_assistant_usage_this_month' => 'ADD COLUMN ai_assistant_usage_this_month INT DEFAULT 0',
        'template_usage_this_month' => 'ADD COLUMN template_usage_this_month INT DEFAULT 0',
        'usage_cycle_start' => 'ADD COLUMN usage_cycle_start DATETIME NULL',
        'plan_expires_at' => 'ADD COLUMN plan_expires_at DATETIME NULL',
    ];
    foreach ($addCols as $col => $sql) {
        if (!in_array($col, $cols)) {
            $pdo->exec("ALTER TABLE kateb_users $sql");
        }
    }

    // Add duration_months to existing plan_orders table if missing
    $planCols = $pdo->query("SHOW COLUMNS FROM plan_orders")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('duration_months', $planCols)) {
        $pdo->exec("ALTER TABLE plan_orders ADD COLUMN duration_months INT NOT NULL DEFAULT 1");
    }
    // Add Bazaar payment columns to existing plan_orders table if missing
    $bazaarOrderCols = [
        'payment_provider' => "ADD COLUMN payment_provider VARCHAR(20) DEFAULT 'zarinpal'",
        'product_id' => "ADD COLUMN product_id VARCHAR(100) DEFAULT ''",
        'purchase_token' => "ADD COLUMN purchase_token TEXT DEFAULT ''",
        'bazaar_purchase_id' => "ADD COLUMN bazaar_purchase_id TEXT NULL",
    ];
    foreach ($bazaarOrderCols as $col => $sql) {
        if (!in_array($col, $planCols)) {
            $pdo->exec("ALTER TABLE plan_orders $sql");
        }
    }
    // Add purchase_token index if missing
    $planIndexes = $pdo->query("SHOW INDEX FROM plan_orders")->fetchAll(PDO::FETCH_ASSOC);
    $hasTokenIdx = false;
    foreach ($planIndexes as $idx) {
        if ($idx['Key_name'] === 'idx_plan_orders_purchase_token') { $hasTokenIdx = true; break; }
    }
    if (!$hasTokenIdx) {
        try { $pdo->exec("ALTER TABLE plan_orders ADD INDEX idx_plan_orders_purchase_token (purchase_token(100))"); } catch (Exception $e) {}
    }

    // Add Bazaar credential columns to kateb_settings if missing
    $settingsCols = $pdo->query("SHOW COLUMNS FROM kateb_settings")->fetchAll(PDO::FETCH_COLUMN);
    $bazaarSettingsCols = [
        'bazaar_client_id' => "ADD COLUMN bazaar_client_id TEXT DEFAULT ''",
        'bazaar_client_secret' => "ADD COLUMN bazaar_client_secret TEXT DEFAULT ''",
        'bazaar_refresh_token' => "ADD COLUMN bazaar_refresh_token TEXT DEFAULT ''",
        'bazaar_access_token' => "ADD COLUMN bazaar_access_token TEXT DEFAULT ''",
        'bazaar_access_token_expires' => "ADD COLUMN bazaar_access_token_expires DATETIME NULL",
    ];
    foreach ($bazaarSettingsCols as $col => $sql) {
        if (!in_array($col, $settingsCols)) {
            $pdo->exec("ALTER TABLE kateb_settings $sql");
        }
    }

    // Insert default settings row ONLY on first run (when empty)
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM kateb_settings WHERE id = 1");
    $stmt->execute();
    if ((int)$stmt->fetchColumn() === 0) {
        $pdo->prepare("INSERT INTO kateb_settings (id, sms_api_key, sms_pattern_code, sms_line_number, ai_api_url, ai_api_key, ai_models, zarinpal_merchant_id, zarinpal_sandbox)
            VALUES (1, '', '', '', 'https://ai.parspack.com/v1', '', 'qwen/qwen3-32b', '00000000-0000-0000-0000-000000000000', 1)")
            ->execute();
    }

    // Insert default admin user (phone: 09120000000, password: admin123)
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM kateb_users WHERE phone = '09120000000'");
    $stmt->execute();
    if ((int)$stmt->fetchColumn() === 0) {
        $adminId = 'a0000000-0000-0000-0000-000000000001';
        $pdo->prepare("INSERT INTO kateb_users (id, phone, full_name, is_admin, password_hash, coins)
            VALUES (?, '09120000000', 'مدیر سیستم', 1, ?, 100)")
            ->execute([$adminId, hash_password('admin123')]);
    } else {
        // Ensure existing admin stays admin
        $pdo->prepare("UPDATE kateb_users SET is_admin = 1 WHERE phone = '09120000000'")->execute();
    }
}

// ─── Settings (cached) ────────────────────────────────────────
function get_settings(): array {
    static $cached = null;
    if ($cached !== null) return $cached;
    $stmt = db()->prepare("SELECT * FROM kateb_settings WHERE id = 1");
    $stmt->execute();
    $row = $stmt->fetch();
    $cached = $row ?: [
        'sms_api_key' => '', 'sms_pattern_code' => '', 'sms_line_number' => '',
        'ai_api_url' => '', 'ai_api_key' => '', 'ai_models' => '',
        'zarinpal_merchant_id' => '', 'zarinpal_sandbox' => 1,
        'bazaar_client_id' => '', 'bazaar_client_secret' => '', 'bazaar_refresh_token' => '',
        'bazaar_access_token' => '', 'bazaar_access_token_expires' => null,
    ];
    return $cached;
}

// ─── Session / Auth ───────────────────────────────────────────
function get_session_user(): ?array {
    $token = get_auth_token();
    if (!$token) return null;
    $stmt = db()->prepare("SELECT user_id, expires_at FROM kateb_sessions WHERE token = ? LIMIT 1");
    $stmt->execute([$token]);
    $sess = $stmt->fetch();
    if (!$sess) return null;
    if (strtotime($sess['expires_at']) < time()) return null;
    $stmt = db()->prepare("SELECT id, phone, full_name, is_admin, coins, plan_type, ai_assistant_usage_this_month, template_usage_this_month, usage_cycle_start, plan_expires_at FROM kateb_users WHERE id = ? LIMIT 1");
    $stmt->execute([$sess['user_id']]);
    $user = $stmt->fetch();
    if (!$user) return null;
    return [
        'id' => $user['id'],
        'phone' => $user['phone'],
        'full_name' => $user['full_name'] ?? '',
        'is_admin' => (bool)($user['is_admin'] ?? 0),
        'coins' => (int)($user['coins'] ?? 0),
        'plan_type' => $user['plan_type'] ?? 'free',
        'ai_assistant_usage_this_month' => (int)($user['ai_assistant_usage_this_month'] ?? 0),
        'template_usage_this_month' => (int)($user['template_usage_this_month'] ?? 0),
        'usage_cycle_start' => $user['usage_cycle_start'] ?? null,
        'plan_expires_at' => $user['plan_expires_at'] ?? null,
    ];
}

function reset_usage_if_needed(array &$user): void {
    $cycleStart = $user['usage_cycle_start'] ?? null;
    $needsReset = false;
    if (!$cycleStart) {
        $needsReset = true;
    } else {
        $startDay = date('Y-m-d', strtotime($cycleStart));
        $todayDay = date('Y-m-d');
        if ($startDay !== $todayDay) $needsReset = true;
    }
    if ($needsReset) {
        db()->prepare("UPDATE kateb_users SET ai_assistant_usage_this_month = 0, template_usage_this_month = 0, usage_cycle_start = ? WHERE id = ?")
            ->execute([now_iso(), $user['id']]);
        $user['ai_assistant_usage_this_month'] = 0;
        $user['template_usage_this_month'] = 0;
    }
}

function create_session(string $userId, string $phone): string {
    $token = gen_token();
    $expires = date('Y-m-d H:i:s', time() + 180 * 86400);
    db()->prepare("INSERT INTO kateb_sessions (token, user_id, phone, expires_at) VALUES (?, ?, ?, ?)")
        ->execute([$token, $userId, $phone, $expires]);
    return $token;
}

// ─── SMS ──────────────────────────────────────────────────────
function send_sms(string $phone, string $code): bool {
    $s = get_settings();
    if (!$s['sms_api_key'] || !$s['sms_pattern_code']) return false;
    $payload = json_encode([
        'code' => $s['sms_pattern_code'],
        'attributes' => ['code' => $code],
        'recipient' => $phone,
        'line_number' => $s['sms_line_number'],
        'number_format' => 'english',
    ]);
    $ch = curl_init('https://api.iranpayamak.com/ws/v1/sms/pattern');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Api-Key: ' . $s['sms_api_key'],
        ],
    ]);
    curl_exec($ch);
    $ok = curl_getinfo($ch, CURLINFO_HTTP_CODE) < 400;
    curl_close($ch);
    return $ok;
}

// ─── JSON field helpers ───────────────────────────────────────
function j_encode($v): string {
    return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function j_decode(string $v, $default = null) {
    $d = json_decode($v, true);
    return $d !== null ? $d : ($default ?? []);
}

// ─── Web search helper (for the assistant tool loop) ─────────
// Uses DuckDuckGo HTML lite endpoint — no API key required, returns compact
// text snippets suitable for feeding back into the LLM context.
function web_search(string $query): string {
    $query = trim($query);
    if ($query === '') return 'عبارت جستجو خالی بود.';
    $url = 'https://html.duckduckgo.com/html/?q=' . urlencode($query);
    $results = '';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_ENCODING => 'gzip, deflate',
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ]);
        $html = curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);
        if ($html === false) return 'خطا در جستجو: ' . $err;
    } else {
        $ctx = stream_context_create(['http' => ['timeout' => 15, 'header' => "User-Agent: Mozilla/5.0\r\n"]]);
        $html = @file_get_contents($url, false, $ctx);
        if ($html === false) return 'جستجو در دسترس نیست.';
    }

    // Parse result titles + snippets from the HTML lite endpoint
    if (preg_match_all('/<a[^>]*class="result__a"[^>]*>(.*?)<\/a>.*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/s', $html, $m, PREG_SET_ORDER)) {
        $items = [];
        foreach (array_slice($m, 0, 5) as $i => $row) {
            $title = trim(strip_tags(html_entity_decode($row[1], ENT_QUOTES, 'UTF-8')));
            $snippet = trim(strip_tags(html_entity_decode($row[2], ENT_QUOTES, 'UTF-8')));
            if ($title === '' && $snippet === '') continue;
            $items[] = ($i + 1) . '. ' . $title . ($snippet !== '' ? ' — ' . $snippet : '');
        }
        $results = implode("\n", $items);
    }
    if (trim($results) === '') return 'نتیجه‌ای برای این جستجو پیدا نشد. پاسخ را بر اساس دانش خودت بده و بگو که به‌روزرسانی آنلاین ممکن نبود.';
    return "نتایج وب برای «{$query}»:\n" . $results;
}

// ─── HTTP fetch helper ────────────────────────────────────────
function http_post_json(string $url, array $body, array $headers = []): array {
    $payload = json_encode($body, JSON_UNESCAPED_UNICODE);
    $allHeaders = array_merge(['Content-Type: application/json', 'Accept: application/json'], $headers);

    // Method 1: cURL with forced HTTP/1.1
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 55,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_ENCODING => 'gzip, deflate',
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_HTTPHEADER => $allHeaders,
        ]);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($resp !== false) {
            return ['body' => json_decode($resp, true), 'code' => (int)$code, 'raw' => $resp, 'error' => ''];
        }
        // cURL failed — try fallback below
    }

    // Method 2: file_get_contents with stream context (no HTTP/2 involved)
    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", $allHeaders),
            'content' => $payload,
            'timeout' => 55,
            'ignore_errors' => true,
        ],
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
        ],
    ]);
    $resp = @file_get_contents($url, false, $ctx);
    if ($resp !== false) {
        $code = 200;
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
            $code = (int)$m[1];
        }
        return ['body' => json_decode($resp, true), 'code' => $code, 'raw' => $resp, 'error' => ''];
    }

    return ['body' => null, 'code' => 0, 'raw' => '', 'error' => 'هم cURL و هم file_get_contents ناموفق بودند'];
}

// ─── Main ─────────────────────────────────────────────────────
try {
    init_tables();
    $act = action();
    $b = body();

    // ─── AI Proxy (action via query param) ────────────────────
    if ($act === 'ai_proxy') {
        $user = get_session_user();
        if (!$user) json_error('احراز هویت نشده', 401);
        $s = get_settings();
        $aiUrl = rtrim($s['ai_api_url'] ?: 'https://ai.parspack.com/v1', '/');
        $aiKey = $s['ai_api_key'] ?: '';
        $defaultModel = trim(explode(',', $s['ai_models'] ?? '')[0] ?? 'qwen/qwen3-32b');
        $model = $b['model'] ?? $defaultModel;
        $messages = $b['messages'] ?? [];
        $temperature = $b['temperature'] ?? 0.7;
        $maxTokens = $b['max_tokens'] ?? 2000;
        $allowTools = !empty($b['allow_tools']);

        // Tool loop: the model may request a web_search tool call (up to N rounds).
        // This lets the assistant answer real-world questions ("بازی بعدی پرسپولیس")
        // by searching the web, then continue planning with the result.
        $tools = $allowTools ? [
            [
                'type' => 'function',
                'function' => [
                    'name' => 'web_search',
                    'description' => 'جستجو در وب برای اطلاعات به‌روز (نتایج مسابقات، مناسبت‌ها، قیمت‌ها و...). پارامتر query را به فارسی یا انگلیسی بفرست.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'query' => ['type' => 'string', 'description' => 'عبارت جستجو'],
                        ],
                        'required' => ['query'],
                    ],
                ],
            ],
        ] : null;

        $endpoint = $aiUrl . '/chat/completions';
        $rounds = 0;
        $MAX_TOOL_ROUNDS = 3;
        while (true) {
            $payload = [
                'model' => $model,
                'messages' => $messages,
                'temperature' => $temperature,
                'max_tokens' => (int)$maxTokens,
            ];
            if ($tools !== null) {
                $payload['tools'] = $tools;
            }

            $result = http_post_json($endpoint, $payload, [
                "Authorization: Bearer {$aiKey}",
            ]);
            if ($result['error']) {
                json_error('خطا در ارتباط با سرور هوش مصنوعی: ' . $result['error'], 502);
            }
            if ($result['code'] >= 400) {
                // Some providers reject the tools field — retry once without it.
                if ($tools !== null && $result['code'] === 400) {
                    $tools = null;
                    $allowTools = false;
                    continue;
                }
                $detail = substr($result['raw'] ?? '', 0, 500);
                json_error("AI API error {$result['code']}: {$detail}", 502);
            }
            if ($result['body'] === null) {
                json_error('پاسخ هوش مصنوعی خالی است', 502);
            }

            $body = $result['body'];
            if (isset($body['choices'][0]['message'])) {
                $msg = $body['choices'][0]['message'];
                if (empty($msg['content']) && !empty($msg['reasoning'])) {
                    $body['choices'][0]['message']['content'] = $msg['reasoning'];
                }
            }

            // Check for tool_calls in the response
            $toolCalls = $body['choices'][0]['message']['tool_calls'] ?? null;
            if ($allowTools && $toolCalls && $rounds < $MAX_TOOL_ROUNDS) {
                $rounds++;
                // Append the assistant message (with tool_calls) to the conversation
                $messages[] = $body['choices'][0]['message'];
                foreach ($toolCalls as $tc) {
                    $fnName = $tc['function']['name'] ?? '';
                    $fnArgsRaw = $tc['function']['arguments'] ?? '{}';
                    $fnArgs = json_decode($fnArgsRaw, true) ?: [];
                    if ($fnName === 'web_search') {
                        $query = trim((string)($fnArgs['query'] ?? ''));
                        $searchResult = web_search($query);
                        $messages[] = [
                            'role' => 'tool',
                            'tool_call_id' => $tc['id'] ?? ('call_' . $rounds),
                            'content' => $searchResult,
                        ];
                    } else {
                        $messages[] = [
                            'role' => 'tool',
                            'tool_call_id' => $tc['id'] ?? ('call_' . $rounds),
                            'content' => 'ابزار ناشناخته: ' . $fnName,
                        ];
                    }
                }
                continue; // feed results back to the model for the next round
            }

            json_out($body);
        }
    }

    // ─── AI Test (admin only) ────────────────────────────────
    if ($act === 'ai_test') {
        $user = get_session_user();
        if (!$user || !$user['is_admin']) json_error('دسترسی غیرمجاز', 403);
        $s = get_settings();
        $aiUrl = rtrim($s['ai_api_url'] ?: 'https://ai.parspack.com/v1', '/');
        $aiKey = $s['ai_api_key'] ?: '';
        $defaultModel = trim(explode(',', $s['ai_models'] ?? '')[0] ?? 'qwen/qwen3-32b');

        $testPrompt = 'سلام! لطفاً یک جمله کوتاه و مفید بگو.';
        $endpoint = $aiUrl . '/chat/completions';
        $payload = [
            'model' => $defaultModel,
            'messages' => [['role' => 'user', 'content' => $testPrompt]],
            'temperature' => 0.7,
            'max_tokens' => 200,
        ];

        $result = http_post_json($endpoint, $payload, [
            "Authorization: Bearer {$aiKey}",
        ]);

        if ($result['error']) {
            json_out(['success' => false, 'message' => 'خطا در اتصال: ' . $result['error']]);
        }
        if ($result['code'] >= 400) {
            $detail = substr($result['raw'] ?? '', 0, 300);
            json_out(['success' => false, 'message' => "خطای API ({$result['code']}): {$detail}"]);
        }
        if ($result['body'] === null) {
            json_out(['success' => false, 'message' => 'پاسخ خالی دریافت شد']);
        }

        // Extract response text, handling reasoning models
        $text = '';
        $msg = $result['body']['choices'][0]['message'] ?? null;
        if ($msg) {
            $text = $msg['content'] ?? '';
            if (!$text && !empty($msg['reasoning'])) $text = $msg['reasoning'];
        }

        if ($text) {
            json_out(['success' => true, 'message' => 'اتصال موفق!', 'response' => $text]);
        } else {
            json_out(['success' => false, 'message' => 'پاسخی از هوش مصنوعی دریافت نشد']);
        }
    }

    // ─── Payment Callback (public, no auth — called by Zarinpal redirect) ──
    if ($act === 'payment_callback') {
        $authority = (string)($b['authority'] ?? '');
        $statusParam = (string)($b['status'] ?? '');
        if (!$authority) json_error('Authority یافت نشد', 400);
        if ($statusParam !== 'OK') json_out(['success' => false, 'status' => 'failed', 'message' => 'پرداخت ناموفق']);

        // Check coin_orders first
        $stmt = db()->prepare("SELECT * FROM coin_orders WHERE authority = ? LIMIT 1");
        $stmt->execute([$authority]);
        $order = $stmt->fetch();
        if ($order) {
            if ($order['status'] === 'paid') json_out(['success' => true, 'status' => 'paid', 'order_id' => $order['id'], 'already_paid' => true, 'coins' => (int)$order['coins']]);
            $s = get_settings();
            $merchantId = $s['zarinpal_merchant_id'] ?: '00000000-0000-0000-0000-000000000000';
            $sandbox = (bool)($s['zarinpal_sandbox'] ?? true);
            $verifyUrl = $sandbox ? 'https://sandbox.zarinpal.com/pg/v4/payment/verify.json' : 'https://payment.zarinpal.com/pg/v4/payment/verify.json';
            $result = http_post_json($verifyUrl, ['merchant_id' => $merchantId, 'amount' => (int)$order['amount_toman'], 'authority' => $authority]);
            $refId = $result['body']['data']['ref_id'] ?? null;
            $code = $result['body']['data']['code'] ?? null;
            if ($code == 100 || $code == 101 || $refId) {
                db()->prepare("UPDATE coin_orders SET status='paid', ref_id=?, paid_at=? WHERE id=?")->execute([(string)$refId, now_iso(), $order['id']]);
                $stmt = db()->prepare("SELECT coins FROM kateb_users WHERE id = ? LIMIT 1");
                $stmt->execute([$order['user_id']]);
                $newCoins = (int)$stmt->fetchColumn() + (int)$order['coins'];
                db()->prepare("UPDATE kateb_users SET coins = ? WHERE id = ?")->execute([$newCoins, $order['user_id']]);
                json_out(['success' => true, 'status' => 'paid', 'order_id' => $order['id'], 'coins' => $newCoins, 'added' => (int)$order['coins'], 'ref_id' => $refId]);
            }
            db()->prepare("UPDATE coin_orders SET status='failed' WHERE id=?")->execute([$order['id']]);
            json_out(['success' => false, 'status' => 'failed', 'order_id' => $order['id'], 'message' => 'تأیید پرداخت ناموفق']);
        }

        // Check plan_orders
        $stmt = db()->prepare("SELECT * FROM plan_orders WHERE authority = ? LIMIT 1");
        $stmt->execute([$authority]);
        $planOrder = $stmt->fetch();
        if ($planOrder) {
            if ($planOrder['status'] === 'paid') json_out(['success' => true, 'status' => 'paid', 'order_id' => $planOrder['id'], 'already_paid' => true]);
            $s = get_settings();
            $merchantId = $s['zarinpal_merchant_id'] ?: '00000000-0000-0000-0000-000000000000';
            $sandbox = (bool)($s['zarinpal_sandbox'] ?? true);
            $verifyUrl = $sandbox ? 'https://sandbox.zarinpal.com/pg/v4/payment/verify.json' : 'https://payment.zarinpal.com/pg/v4/payment/verify.json';
            $result = http_post_json($verifyUrl, ['merchant_id' => $merchantId, 'amount' => (int)$planOrder['amount_toman'], 'authority' => $authority]);
            $refId = $result['body']['data']['ref_id'] ?? null;
            $code = $result['body']['data']['code'] ?? null;
            if ($code == 100 || $code == 101 || $refId) {
                $durationMonths = (int)($planOrder['duration_months'] ?? 1);
                db()->prepare("UPDATE plan_orders SET status='paid', ref_id=?, paid_at=? WHERE id=?")->execute([(string)$refId, now_iso(), $planOrder['id']]);
                $expiryDate = date('Y-m-d H:i:s', strtotime("+{$durationMonths} months"));
                db()->prepare("UPDATE kateb_users SET plan_type=?, ai_assistant_usage_this_month=0, template_usage_this_month=0, usage_cycle_start=?, plan_expires_at=? WHERE id=?")
                    ->execute([$planOrder['plan_id'], now_iso(), $expiryDate, $planOrder['user_id']]);
                json_out(['success' => true, 'status' => 'paid', 'order_id' => $planOrder['id'], 'ref_id' => $refId, 'plan_id' => $planOrder['plan_id']]);
            }
            db()->prepare("UPDATE plan_orders SET status='failed' WHERE id=?")->execute([$planOrder['id']]);
            json_out(['success' => false, 'status' => 'failed', 'order_id' => $planOrder['id'], 'message' => 'تأیید پرداخت ناموفق']);
        }

        json_out(['success' => false, 'status' => 'failed', 'message' => 'سفارش یافت نشد']);
    }

    // ─── Payment Status (public, no auth — called from payment result page) ──
    if ($act === 'payment_status') {
        $orderId = (string)($b['order_id'] ?? '');
        if (!$orderId) json_error('شناسه سفارش یافت نشد', 400);
        // Check coin_orders
        $stmt = db()->prepare("SELECT * FROM coin_orders WHERE id = ? LIMIT 1");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch();
        if ($order) {
            json_out(['success' => $order['status'] === 'paid', 'status' => $order['status'], 'order_id' => $order['id'], 'coins' => (int)$order['coins'], 'ref_id' => $order['ref_id'] ?? '']);
        }
        // Check plan_orders
        $stmt = db()->prepare("SELECT * FROM plan_orders WHERE id = ? LIMIT 1");
        $stmt->execute([$orderId]);
        $planOrder = $stmt->fetch();
        if ($planOrder) {
            json_out(['success' => $planOrder['status'] === 'paid', 'status' => $planOrder['status'], 'order_id' => $planOrder['id'], 'plan_id' => $planOrder['plan_id'], 'ref_id' => $planOrder['ref_id'] ?? '']);
        }
        json_error('سفارش یافت نشد', 404);
    }

    // ─── Ping (health check) ─────────────────────────────────
    if ($act === 'ping') {
        json_out(['success' => true, 'message' => 'pong']);
    }

    // ─── OTP: Send ────────────────────────────────────────────
    if ($act === 'otp_send') {
        $phone = (string)($b['phone'] ?? '');
        if (!preg_match('/^09\d{9}$/', $phone)) json_error('شماره موبایل نامعتبر', 400);
        $stmt = db()->prepare("SELECT COUNT(*) FROM kateb_otp_codes WHERE phone = ? AND created_at > ?");
        $stmt->execute([$phone, date('Y-m-d H:i:s', time() - 600)]);
        if ((int)$stmt->fetchColumn() >= 5) json_error('تعداد درخواست زیاد است. کمی صبر کنید.', 429);
        $stmt = db()->prepare("SELECT id, phone, full_name, is_admin, coins, plan_type, ai_assistant_usage_this_month, template_usage_this_month FROM kateb_users WHERE phone = ? LIMIT 1");
        $stmt->execute([$phone]);
        $isExisting = (bool)$stmt->fetch();
        $code = gen_otp();
        $expires = date('Y-m-d H:i:s', time() + 120);
        db()->prepare("INSERT INTO kateb_otp_codes (id, phone, code, expires_at, used) VALUES (?, ?, ?, ?, 0)")
            ->execute([gen_uuid(), $phone, $code, $expires]);
        $smsSent = send_sms($phone, $code);
        json_out(['success' => true, 'message' => 'کد تایید ارسال شد', 'sms_sent' => $smsSent, 'is_existing_user' => $isExisting, 'code' => $smsSent ? null : $code]);
    }

    // ─── OTP: Verify ──────────────────────────────────────────
    if ($act === 'otp_verify') {
        $phone = (string)($b['phone'] ?? '');
        $code = (string)($b['code'] ?? '');
        $fullName = (string)($b['full_name'] ?? '');
        $password = (string)($b['password'] ?? '');
        if (!preg_match('/^09\d{9}$/', $phone)) json_error('شماره موبایل نامعتبر', 400);
        $stmt = db()->prepare("SELECT id, used, expires_at FROM kateb_otp_codes WHERE phone = ? AND code = ? AND used = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([$phone, $code, now_iso()]);
        $otp = $stmt->fetch();
        if (!$otp) json_error('کد تایید اشتباه یا منقضی شده', 400);
        db()->prepare("UPDATE kateb_otp_codes SET used = 1 WHERE id = ?")->execute([$otp['id']]);

        $stmt = db()->prepare("SELECT id, phone, full_name, is_admin, coins, plan_type, ai_assistant_usage_this_month, template_usage_this_month FROM kateb_users WHERE phone = ? LIMIT 1");
        $stmt->execute([$phone]);
        $user = $stmt->fetch();
        $isNewUser = false;
        if (!$user) {
            if (!trim($fullName)) json_error('نام و نام خانوادگی الزامی است', 400);
            if (strlen($password) < 4) json_error('رمز عبور باید حداقل ۴ کاراکتر باشد', 400);
            $isNewUser = true;
            $newId = gen_uuid();
            $hash = hash_password($password);
            db()->prepare("INSERT INTO kateb_users (id, phone, full_name, password_hash, coins, plan_type, ai_assistant_usage_this_month, template_usage_this_month, usage_cycle_start) VALUES (?, ?, ?, ?, 10, 'free', 0, 0, ?)")
                ->execute([$newId, $phone, $fullName, $hash, now_iso()]);
            $user = ['id' => $newId, 'phone' => $phone, 'full_name' => $fullName, 'is_admin' => 0, 'coins' => 10, 'plan_type' => 'free', 'ai_assistant_usage_this_month' => 0, 'template_usage_this_month' => 0];
        } else {
            if ($fullName && !$user['full_name']) {
                db()->prepare("UPDATE kateb_users SET full_name = ? WHERE id = ?")->execute([$fullName, $user['id']]);
                $user['full_name'] = $fullName;
            }
        }
        $token = create_session($user['id'], $phone);
        json_out([
            'success' => true,
            'session' => [
                'access_token' => $token,
                'user' => [
                    'id' => $user['id'], 'phone' => $user['phone'],
                    'full_name' => $user['full_name'] ?? '',
                    'is_admin' => (bool)($user['is_admin'] ?? 0),
                    'coins' => (int)($user['coins'] ?? 10),
                    'plan_type' => $user['plan_type'] ?? 'free',
                    'ai_assistant_usage_this_month' => (int)($user['ai_assistant_usage_this_month'] ?? 0),
                    'template_usage_this_month' => (int)($user['template_usage_this_month'] ?? 0),
                ],
            ],
            'is_new_user' => $isNewUser,
        ]);
    }

    // ─── Password Login ───────────────────────────────────────
    if ($act === 'password_login') {
        $phone = (string)($b['phone'] ?? '');
        $password = (string)($b['password'] ?? '');
        if (!preg_match('/^09\d{9}$/', $phone)) json_error('شماره موبایل نامعتبر', 400);
        if (!$password) json_error('رمز عبور را وارد کنید', 400);
        $stmt = db()->prepare("SELECT id, phone, full_name, password_hash, is_admin, coins, plan_type, ai_assistant_usage_this_month, template_usage_this_month FROM kateb_users WHERE phone = ? LIMIT 1");
        $stmt->execute([$phone]);
        $user = $stmt->fetch();
        if (!$user || !$user['password_hash']) json_error('شماره موبایل یا رمز عبور اشتباه است', 401);
        $hashed = hash_password($password);
        if ($hashed !== $user['password_hash'] && $password !== $user['password_hash']) {
            json_error('شماره موبایل یا رمز عبور اشتباه است', 401);
        }
        $token = create_session($user['id'], $user['phone']);
        json_out([
            'success' => true,
            'session' => [
                'access_token' => $token,
                'user' => [
                    'id' => $user['id'], 'phone' => $user['phone'],
                    'full_name' => $user['full_name'] ?? '',
                    'is_admin' => (bool)($user['is_admin'] ?? 0),
                    'coins' => (int)($user['coins'] ?? 10),
                    'plan_type' => $user['plan_type'] ?? 'free',
                    'ai_assistant_usage_this_month' => (int)($user['ai_assistant_usage_this_month'] ?? 0),
                    'template_usage_this_month' => (int)($user['template_usage_this_month'] ?? 0),
                ],
            ],
        ]);
    }

    // ─── Auth: me ─────────────────────────────────────────────
    if ($act === 'me') {
        $user = get_session_user();
        if (!$user) json_error('احراز هویت نشده', 401);
        reset_usage_if_needed($user);
        json_out(['user' => $user]);
    }

    // ─── Auth: signout ────────────────────────────────────────
    if ($act === 'signout') {
        $token = get_auth_token();
        if ($token) db()->prepare("DELETE FROM kateb_sessions WHERE token = ?")->execute([$token]);
        json_out(['success' => true]);
    }

    // ─── Auth: set password ───────────────────────────────────
    if ($act === 'set_password') {
        $user = get_session_user();
        if (!$user) json_error('احراز هویت نشده', 401);
        $password = (string)($b['password'] ?? '');
        if (strlen($password) < 4) json_error('رمز عبور باید حداقل ۴ کاراکتر باشد', 400);
        db()->prepare("UPDATE kateb_users SET password_hash = ? WHERE id = ?")
            ->execute([hash_password($password), $user['id']]);
        json_out(['success' => true]);
    }

    // ─── Auth: update account ─────────────────────────────────
    if ($act === 'update_account') {
        $user = get_session_user();
        if (!$user) json_error('احراز هویت نشده', 401);
        $fullName = trim((string)($b['full_name'] ?? ''));
        if (!$fullName) json_error('نام نمی‌تواند خالی باشد', 400);
        db()->prepare("UPDATE kateb_users SET full_name = ? WHERE id = ?")->execute([$fullName, $user['id']]);
        json_out(['success' => true, 'user' => array_merge($user, ['full_name' => $fullName])]);
    }

    // ─── Require auth for everything below ────────────────────
    $user = get_session_user();
    if (!$user) json_error('احراز هویت نشده', 401);
    $uid = $user['id'];

    // ─── Usage: increment AI assistant ───────────────────────
    if ($act === 'increment_ai_usage') {
        $newCount = (int)$user['ai_assistant_usage_this_month'] + 1;
        db()->prepare("UPDATE kateb_users SET ai_assistant_usage_this_month = ? WHERE id = ?")->execute([$newCount, $uid]);
        json_out(['success' => true, 'ai_assistant_usage_this_month' => $newCount]);
    }

    // ─── Usage: increment template ──────────────────────────
    if ($act === 'increment_template_usage') {
        $newCount = (int)$user['template_usage_this_month'] + 1;
        db()->prepare("UPDATE kateb_users SET template_usage_this_month = ? WHERE id = ?")->execute([$newCount, $uid]);
        json_out(['success' => true, 'template_usage_this_month' => $newCount]);
    }

    // ─── Usage: get current ───────────────────────────────────
    if ($act === 'usage_get') {
        json_out([
            'plan_type' => $user['plan_type'] ?? 'free',
            'ai_assistant_usage_this_month' => (int)($user['ai_assistant_usage_this_month'] ?? 0),
            'template_usage_this_month' => (int)($user['template_usage_this_month'] ?? 0),
            'expires_at' => $user['plan_expires_at'] ?? null,
            'cycle_start' => $user['usage_cycle_start'] ?? null,
        ]);
    }

    // ─── Profiles ─────────────────────────────────────────────
    // ─── Calendar sync (tasks) ────────────────────────────────
    if ($act === 'calendar_tasks_list') {
        $stmt = db()->prepare("SELECT * FROM calendar_tasks WHERE user_id = ? ORDER BY due_date ASC");
        $stmt->execute([$uid]);
        json_out(['data' => $stmt->fetchAll()]);
    }
    if ($act === 'calendar_task_save') {
        $t = $b['task'] ?? [];
        $id = (string)($t['id'] ?? '');
        if (!$id) json_error('شناسه نامعتبر', 400);
        $recurrence = $t['recurrence'] ?? 'none';
        if (!in_array($recurrence, ['none','daily','weekly','monthly','yearly'], true)) $recurrence = 'none';
        $status = $t['status'] ?? 'pending';
        if (!in_array($status, ['pending','completed','skipped','cancelled'], true)) $status = 'pending';
        $priority = $t['priority'] ?? 'medium';
        if (!in_array($priority, ['low','medium','high'], true)) $priority = 'medium';
        $category = $t['category'] ?? 'other';
        $stmt = db()->prepare("INSERT INTO calendar_tasks (id, user_id, title, description, due_date, due_time, duration, priority, category, status, recurrence, day_of_month, month_of_year, reminder, completed_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()), NOW())
            ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), due_date = VALUES(due_date),
              due_time = VALUES(due_time), duration = VALUES(duration), priority = VALUES(priority), category = VALUES(category),
              status = VALUES(status), recurrence = VALUES(recurrence), day_of_month = VALUES(day_of_month),
              month_of_year = VALUES(month_of_year), reminder = VALUES(reminder), completed_at = VALUES(completed_at), updated_at = NOW()");
        $stmt->execute([
            $id, $uid,
            mb_substr((string)($t['title'] ?? ''), 0, 255),
            $t['description'] ?? null,
            $t['due_date'] ?? date('Y-m-d'),
            $t['due_time'] ?? null,
            (int)($t['duration'] ?? 60),
            $priority, $category, $status, $recurrence,
            $t['day_of_month'] ?? null,
            $t['month_of_year'] ?? null,
            $t['reminder'] ?? null,
            $t['completed_at'] ?? null,
            $t['created_at'] ?? null,
        ]);
        json_out(['success' => true]);
    }
    if ($act === 'calendar_task_delete') {
        db()->prepare("DELETE FROM calendar_tasks WHERE id = ? AND user_id = ?")->execute([$b['id'] ?? '', $uid]);
        json_out(['success' => true]);
    }

    // ─── Calendar sync (events) ───────────────────────────────
    if ($act === 'calendar_events_list') {
        $stmt = db()->prepare("SELECT * FROM calendar_events WHERE user_id = ? ORDER BY event_date ASC, start_time ASC");
        $stmt->execute([$uid]);
        json_out(['data' => $stmt->fetchAll()]);
    }
    if ($act === 'calendar_event_save') {
        $e = $b['event'] ?? [];
        $id = (string)($e['id'] ?? '');
        if (!$id) json_error('شناسه نامعتبر', 400);
        $recurrence = $e['recurrence'] ?? 'none';
        if (!in_array($recurrence, ['none','daily','weekly','monthly','yearly'], true)) $recurrence = 'none';
        $category = $e['category'] ?? 'work';
        $color = (string)($e['color'] ?? '#4f46e5');
        if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) $color = '#4f46e5';
        $stmt = db()->prepare("INSERT INTO calendar_events (id, user_id, title, description, event_date, start_time, end_time, location, category, color, reminder, recurrence, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()), NOW())
            ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), event_date = VALUES(event_date),
              start_time = VALUES(start_time), end_time = VALUES(end_time), location = VALUES(location),
              category = VALUES(category), color = VALUES(color), reminder = VALUES(reminder),
              recurrence = VALUES(recurrence), updated_at = NOW()");
        $stmt->execute([
            $id, $uid,
            mb_substr((string)($e['title'] ?? ''), 0, 255),
            $e['description'] ?? null,
            $e['event_date'] ?? date('Y-m-d'),
            $e['start_time'] ?? '10:00',
            $e['end_time'] ?? null,
            $e['location'] ?? null,
            $category, $color,
            $e['reminder'] ?? null,
            $recurrence,
            $e['created_at'] ?? null,
        ]);
        json_out(['success' => true]);
    }
    if ($act === 'calendar_event_delete') {
        db()->prepare("DELETE FROM calendar_events WHERE id = ? AND user_id = ?")->execute([$b['id'] ?? '', $uid]);
        json_out(['success' => true]);
    }

    // ─── Calendar preferences ─────────────────────────────────
    if ($act === 'calendar_prefs_get') {
        $stmt = db()->prepare("SELECT * FROM calendar_preferences WHERE user_id = ?");
        $stmt->execute([$uid]);
        $row = $stmt->fetch();
        if (!$row) { json_out(['data' => null]); return; }
        $row['work_days'] = j_decode($row['work_days'], [0,1,2,3,4]);
        json_out(['data' => $row]);
    }
    if ($act === 'calendar_prefs_set') {
        $pr = $b['prefs'] ?? [];
        $workDays = j_encode(is_array($pr['work_days'] ?? null) ? $pr['work_days'] : [0,1,2,3,4]);
        db()->prepare("INSERT INTO calendar_preferences (user_id, dark_mode, persian_numbers, work_start, work_end, work_days, default_reminder, notifications_enabled, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE dark_mode = VALUES(dark_mode), persian_numbers = VALUES(persian_numbers),
              work_start = VALUES(work_start), work_end = VALUES(work_end), work_days = VALUES(work_days),
              default_reminder = VALUES(default_reminder), notifications_enabled = VALUES(notifications_enabled), updated_at = NOW()")
            ->execute([
                $uid,
                !empty($pr['dark_mode']) ? 1 : 0,
                !isset($pr['persian_numbers']) || $pr['persian_numbers'] ? 1 : 0,
                (string)($pr['work_start'] ?? '08:00'),
                (string)($pr['work_end'] ?? '20:00'),
                $workDays,
                (int)($pr['default_reminder'] ?? 15),
                !isset($pr['notifications_enabled']) || $pr['notifications_enabled'] ? 1 : 0,
            ]);
        json_out(['success' => true]);
    }

    if ($act === 'coins_balance') {
        $stmt = db()->prepare("SELECT coins FROM kateb_users WHERE id = ? LIMIT 1");
        $stmt->execute([$uid]);
        json_out(['coins' => (int)($stmt->fetchColumn() ?? 0)]);
    }
    if ($act === 'coins_deduct') {
        $amount = max(1, (int)($b['amount'] ?? 0));
        $reason = (string)($b['reason'] ?? '');
        $stmt = db()->prepare("SELECT coins FROM kateb_users WHERE id = ? LIMIT 1");
        $stmt->execute([$uid]);
        $current = (int)$stmt->fetchColumn();
        if ($current < $amount) json_error('سکه کافی ندارید', 402);
        $newCoins = $current - $amount;
        db()->prepare("UPDATE kateb_users SET coins = ? WHERE id = ?")->execute([$newCoins, $uid]);
        json_out(['success' => true, 'coins' => $newCoins, 'reason' => $reason]);
    }

    // ─── Discovery Usage ──────────────────────────────────────
    if ($act === 'coin_packages') {
        json_out(['data' => [
            ['id' => 'small', 'coins' => 10, 'price' => 50000, 'label' => '۱۰ سکه — ۵۰٬۰۰۰ تومان'],
            ['id' => 'medium', 'coins' => 20, 'price' => 100000, 'label' => '۲۰ سکه — ۱۰۰٬۰۰۰ تومان', 'popular' => true],
            ['id' => 'large', 'coins' => 40, 'price' => 200000, 'label' => '۴۰ سکه — ۲۰۰٬۰۰۰ تومان'],
            ['id' => 'xlarge', 'coins' => 90, 'price' => 450000, 'label' => '۹۰ سکه — ۴۵۰٬۰۰۰ تومان'],
        ]]);
    }
    if ($act === 'zarinpal_request') {
        $pkgId = (string)($b['package_id'] ?? '');
        $s = get_settings();
        $merchantId = $s['zarinpal_merchant_id'] ?: '00000000-0000-0000-0000-000000000000';
        $sandbox = (bool)($s['zarinpal_sandbox'] ?? true);
        $packages = ['small' => [10, 50000], 'medium' => [20, 100000], 'large' => [40, 200000], 'xlarge' => [90, 450000]];
        if (!isset($packages[$pkgId])) json_error('بسته نامعتبر', 400);
        [$coins, $price] = $packages[$pkgId];
        $callbackUrl = (string)($b['callback_url'] ?? '');
        // Reject localhost / insecure callback URLs — always use production HTTPS
        if ($callbackUrl === '' || preg_match('#^https?://(localhost|127\.0\.0\.1|10\.|192\.168\.)#i', $callbackUrl)) {
            $callbackUrl = 'https://app.kateb.site/payment/callback';
        }
        $baseUrl = $sandbox ? 'https://sandbox.zarinpal.com/pg/v4/payment/request.json' : 'https://payment.zarinpal.com/pg/v4/payment/request.json';
        $gatewayUrl = $sandbox ? 'https://sandbox.zarinpal.com/pg/StartPay/' : 'https://payment.zarinpal.com/pg/StartPay/';
        $result = http_post_json($baseUrl, [
            'merchant_id' => $merchantId, 'amount' => $price, 'currency' => 'IRT',
            'description' => "خرید {$coins} سکه - کاتب", 'callback_url' => $callbackUrl,
        ]);
        $authority = $result['body']['data']['authority'] ?? null;
        if (!$authority) {
            $errMsg = $result['body']['errors'][0]['message'] ?? 'خطا در ارتباط با زرین‌پال';
            json_error($errMsg, 500);
        }
        $orderId = gen_uuid();
        db()->prepare("INSERT INTO coin_orders (id, user_id, amount_toman, coins, status, authority) VALUES (?, ?, ?, ?, 'pending', ?)")
            ->execute([$orderId, $uid, $price, $coins, $authority]);
        json_out(['data' => ['authority' => $authority, 'redirect_url' => $gatewayUrl . $authority, 'order_id' => $orderId]]);
    }
    if ($act === 'zarinpal_verify') {
        $authority = (string)($b['authority'] ?? '');
        $statusParam = (string)($b['status'] ?? '');
        if ($statusParam !== 'OK') json_error('پرداخت ناموفق', 400);
        $stmt = db()->prepare("SELECT * FROM coin_orders WHERE authority = ? AND user_id = ? LIMIT 1");
        $stmt->execute([$authority, $uid]);
        $order = $stmt->fetch();
        if (!$order) json_error('سفارش یافت نشد', 404);
        if ($order['status'] === 'paid') json_out(['success' => true, 'already_paid' => true, 'coins' => (int)$order['coins']]);
        $s = get_settings();
        $merchantId = $s['zarinpal_merchant_id'] ?: '00000000-0000-0000-0000-000000000000';
        $sandbox = (bool)($s['zarinpal_sandbox'] ?? true);
        $verifyUrl = $sandbox ? 'https://sandbox.zarinpal.com/pg/v4/payment/verify.json' : 'https://payment.zarinpal.com/pg/v4/payment/verify.json';
        $result = http_post_json($verifyUrl, ['merchant_id' => $merchantId, 'amount' => (int)$order['amount_toman'], 'authority' => $authority]);
        $refId = $result['body']['data']['ref_id'] ?? null;
        $code = $result['body']['data']['code'] ?? null;
        if ($code == 100 || $code == 101 || $refId) {
            db()->prepare("UPDATE coin_orders SET status='paid', ref_id=?, paid_at=? WHERE id=?")
                ->execute([(string)$refId, now_iso(), $order['id']]);
            $stmt = db()->prepare("SELECT coins FROM kateb_users WHERE id = ? LIMIT 1");
            $stmt->execute([$uid]);
            $newCoins = (int)$stmt->fetchColumn() + (int)$order['coins'];
            db()->prepare("UPDATE kateb_users SET coins = ? WHERE id = ?")->execute([$newCoins, $uid]);
            json_out(['success' => true, 'coins' => $newCoins, 'ref_id' => $refId, 'added' => (int)$order['coins']]);
        }
        db()->prepare("UPDATE coin_orders SET status='failed' WHERE id=?")->execute([$order['id']]);
        json_error('تأیید پرداخت ناموفق', 400);
    }
    if ($act === 'coin_orders_list') {
        $stmt = db()->prepare("SELECT * FROM coin_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20");
        $stmt->execute([$uid]);
        json_out(['data' => $stmt->fetchAll()]);
    }

    // ─── Plan Purchase via Zarinpal ───────────────────────────
    if ($act === 'plan_request') {
        $planId = (string)($b['plan_id'] ?? '');
        $planPrices = ['basic' => 599000, 'pro' => 1599000];
        if (!isset($planPrices[$planId])) json_error('طرح نامعتبر', 400);
        $monthlyPrice = $planPrices[$planId];
        $durationMonths = (int)($b['duration_months'] ?? 1);
        if (!in_array($durationMonths, [1, 3, 6], true)) json_error('مدت زمان نامعتبر', 400);
        $discountRate = $durationMonths === 6 ? 0.20 : ($durationMonths === 3 ? 0.10 : 0);
        $baseTotal = $monthlyPrice * $durationMonths;
        $price = (int)round($baseTotal * (1 - $discountRate));
        $s = get_settings();
        $merchantId = $s['zarinpal_merchant_id'] ?: '00000000-0000-0000-0000-000000000000';
        $sandbox = (bool)($s['zarinpal_sandbox'] ?? true);
        $callbackUrl = (string)($b['callback_url'] ?? '');
        if ($callbackUrl === '' || preg_match('#^https?://(localhost|127\.0\.0\.1|10\.|192\.168\.)#i', $callbackUrl)) {
            $callbackUrl = 'https://app.kateb.site/payment/callback';
        }
        $baseUrl = $sandbox ? 'https://sandbox.zarinpal.com/pg/v4/payment/request.json' : 'https://payment.zarinpal.com/pg/v4/payment/request.json';
        $gatewayUrl = $sandbox ? 'https://sandbox.zarinpal.com/pg/StartPay/' : 'https://payment.zarinpal.com/pg/StartPay/';
        $result = http_post_json($baseUrl, [
            'merchant_id' => $merchantId, 'amount' => $price, 'currency' => 'IRT',
            'description' => "خرید طرح {$planId} ({$durationMonths} ماه) - کاتب", 'callback_url' => $callbackUrl,
        ]);
        $authority = $result['body']['data']['authority'] ?? null;
        if (!$authority) {
            $errMsg = $result['body']['errors'][0]['message'] ?? 'خطا در ارتباط با زرین‌پال';
            json_error($errMsg, 500);
        }
        $orderId = gen_uuid();
        db()->prepare("INSERT INTO plan_orders (id, user_id, plan_id, amount_toman, status, authority, duration_months) VALUES (?, ?, ?, ?, 'pending', ?, ?)")
            ->execute([$orderId, $uid, $planId, $price, $authority, $durationMonths]);
        json_out(['data' => ['authority' => $authority, 'redirect_url' => $gatewayUrl . $authority, 'order_id' => $orderId]]);
    }

    // ─── Plan Transactions List (user-facing) ──────────────────
    if ($act === 'plan_transactions_list') {
        $stmt = db()->prepare("SELECT id, plan_id, amount_toman, status, authority, ref_id, created_at, paid_at, payment_provider, product_id FROM plan_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20");
        $stmt->execute([$uid]);
        json_out(['data' => $stmt->fetchAll()]);
    }

    // ─── Cafe Bazaar Purchase Verification (Android) ───────────
    if ($act === 'bazaar_purchase_verify') {
        $productId = (string)($b['product_id'] ?? '');
        $purchaseToken = (string)($b['purchase_token'] ?? '');
        if ($productId === '' || $purchaseToken === '') json_error('اطلاعات خرید ناقص است', 400);

        // Server-side product ID validation
        $bazaarProducts = [
            'kateb_basic_1m' => ['plan' => 'basic', 'months' => 1],
            'kateb_basic_3m' => ['plan' => 'basic', 'months' => 3],
            'kateb_basic_6m' => ['plan' => 'basic', 'months' => 6],
            'kateb_pro_1m'   => ['plan' => 'pro', 'months' => 1],
            'kateb_pro_3m'   => ['plan' => 'pro', 'months' => 3],
            'kateb_pro_6m'   => ['plan' => 'pro', 'months' => 6],
        ];
        if (!isset($bazaarProducts[$productId])) json_error('محصول نامعتبر است', 400);
        $planInfo = $bazaarProducts[$productId];
        $planId = $planInfo['plan'];
        $durationMonths = $planInfo['months'];

        // Idempotency: check if this purchase_token was already processed
        $stmt = db()->prepare("SELECT id, user_id, status FROM plan_orders WHERE purchase_token = ? LIMIT 1");
        $stmt->execute([$purchaseToken]);
        $existing = $stmt->fetch();
        if ($existing) {
            if ($existing['user_id'] !== $uid) json_error('این خرید به حساب دیگری متصل است', 403);
            if ($existing['status'] === 'paid') {
                json_out(['success' => true, 'already_processed' => true]);
            }
        }

        // Get Bazaar OAuth access token
        $s = get_settings();
        $clientId = $s['bazaar_client_id'] ?? '';
        $clientSecret = $s['bazaar_client_secret'] ?? '';
        $refreshToken = $s['bazaar_refresh_token'] ?? '';
        if (!$clientId || !$clientSecret || !$refreshToken) json_error('تنظیمات کافه‌بازار کامل نیست', 500);

        // Check cached access token validity
        $accessToken = $s['bazaar_access_token'] ?? '';
        $tokenExpires = $s['bazaar_access_token_expires'] ?? null;
        $needNewToken = !$accessToken || !$tokenExpires || strtotime($tokenExpires) < time() + 60;
        if ($needNewToken) {
            $tokenParams = http_build_query([
                'grant_type' => 'refresh_token',
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'refresh_token' => $refreshToken,
            ]);
            // CafeBazaar Developer API v2 token endpoint. Both the official C# client
            // (Geeksltd/CafeBazaar.DeveloperApi) and nikapps/bazaar-api-php use exactly
            // this URL with a form-encoded refresh_token grant.
            $tokenCh = curl_init('https://pardakht.cafebazaar.ir/devapi/v2/auth/token/');
            curl_setopt_array($tokenCh, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $tokenParams,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 30,
                CURLOPT_CONNECTTIMEOUT => 15,
                // TLS peer verification is deliberately OFF here, matching the Zarinpal
                // calls above: this shared host has no usable CA bundle. Turning it on
                // made the token request fail while producing no diagnostic at all.
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => 0,
                CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
                CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
            ]);
            $tokenResp = curl_exec($tokenCh);
            $tokenCode = (int)curl_getinfo($tokenCh, CURLINFO_HTTP_CODE);
            $tokenErr  = curl_error($tokenCh);
            curl_close($tokenCh);

            $tokenData = json_decode($tokenResp ?: '', true);
            $newToken = $tokenData['access_token'] ?? '';
            $expiresIn = $tokenData['expires_in'] ?? 3600;
            if (!$newToken) {
                // Report what actually happened instead of a bare "failed": a cURL
                // error, or the HTTP status plus the raw body (which carries
                // invalid_grant / invalid_client for bad credentials).
                $detail = $tokenErr !== ''
                    ? ('cURL: ' . $tokenErr)
                    : ('HTTP ' . $tokenCode . ' :: ' . mb_substr((string)$tokenResp, 0, 400));
                error_log('Bazaar token request failed: ' . $detail);
                json_error('دریافت توکن کافه‌بازار ناموفق بود — ' . $detail, 500);
            }
            $newExpiry = date('Y-m-d H:i:s', time() + (int)$expiresIn - 60);
            db()->prepare("UPDATE kateb_settings SET bazaar_access_token = ?, bazaar_access_token_expires = ? WHERE id = 1")
                ->execute([$newToken, $newExpiry]);
            $accessToken = $newToken;
        }

        // Verify purchase with Bazaar Developer API
        $packageName = 'com.kateb.app';

        // Both reference clients pass the access token as an `access_token` QUERY
        // PARAMETER, not an Authorization header. The previous revision used a Bearer
        // header, which the endpoint does not accept.
        //
        // The subscription endpoint is the documented one for ITEM_TYPE_SUBS purchases.
        // The in-app endpoint is tried as a fallback because some Bazaar setups
        // register these products as plain in-app items.
        $candidateUrls = [
            'subscription' => "https://pardakht.cafebazaar.ir/devapi/v2/api/applications/" . rawurlencode($packageName) .
                "/subscriptions/" . rawurlencode($productId) .
                "/purchases/" . rawurlencode($purchaseToken) . "/?access_token=" . urlencode($accessToken),
            'inapp' => "https://pardakht.cafebazaar.ir/devapi/v2/api/validate/" . rawurlencode($packageName) .
                "/inapp/" . rawurlencode($productId) .
                "/purchases/" . rawurlencode($purchaseToken) . "/?access_token=" . urlencode($accessToken),
        ];

        $verifyData = null;
        $verifyVia = '';
        $verifyErr = '';
        $attempts = [];
        foreach ($candidateUrls as $via => $verifyUrl) {
            $ch = curl_init($verifyUrl);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 30,
                CURLOPT_CONNECTTIMEOUT => 15,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => 0,
                CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
                CURLOPT_HTTPHEADER => ['Accept: application/json'],
            ]);
            $verifyResp = curl_exec($ch);
            $verifyCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $verifyErr = curl_error($ch);
            curl_close($ch);

            $decoded = json_decode($verifyResp ?: '', true);
            $attempts[] = $via . ' -> HTTP ' . $verifyCode . ' :: ' . mb_substr((string)$verifyResp, 0, 300);

            if ($verifyCode === 200 && is_array($decoded) && empty($decoded['error'])) {
                $verifyData = $decoded;
                $verifyVia = $via;
                break;
            }
        }

        if ($verifyData === null) {
            $detail = $verifyErr !== '' ? ('cURL: ' . $verifyErr) : implode(' | ', $attempts);
            error_log('Bazaar verify failed: ' . $detail);
            json_error('تأیید خرید از کافه‌بازار ناموفق بود — ' . $detail, 502);
        }

        // The two endpoints return different shapes, so validate defensively:
        //  - in-app:       consumptionState, purchaseState (0 = purchased, 1 = cancelled, 2 = refunded)
        //  - subscription: initiationTimestampMsec, validUntilTimestampMsec, autoRenewing
        if (isset($verifyData['purchaseState']) && (int)$verifyData['purchaseState'] !== 0) {
            json_error('وضعیت خرید نامعتبر است', 400);
        }
        if (isset($verifyData['validUntilTimestampMsec'])
            && (int)$verifyData['validUntilTimestampMsec'] > 0
            && (int)($verifyData['validUntilTimestampMsec'] / 1000) < time()) {
            json_error('اشتراک منقضی شده است', 400);
        }

        // The subscription endpoint returns no purchaseId, so fall back to the
        // purchase token - it is a stable, unique reference for support lookups.
        $bazaarPurchaseId = $verifyData['purchaseId'] ?? $purchaseToken;
        $orderId = $existing['id'] ?? gen_uuid();

        // Begin transaction
        $pdo = db();
        $pdo->beginTransaction();
        try {
            if ($existing) {
                $pdo->prepare("UPDATE plan_orders SET status='paid', paid_at=?, ref_id=?, payment_provider='bazaar', product_id=?, purchase_token=?, bazaar_purchase_id=? WHERE id=?")
                    ->execute([now_iso(), $bazaarPurchaseId, $productId, $purchaseToken, $bazaarPurchaseId, $orderId]);
            } else {
                $pdo->prepare("INSERT INTO plan_orders (id, user_id, plan_id, amount_toman, status, paid_at, duration_months, payment_provider, product_id, purchase_token, bazaar_purchase_id, ref_id)
                    VALUES (?, ?, ?, 0, 'paid', ?, ?, 'bazaar', ?, ?, ?, ?)")
                    ->execute([$orderId, $uid, $planId, now_iso(), $durationMonths, $productId, $purchaseToken, $bazaarPurchaseId, $bazaarPurchaseId]);
            }

            // Activate subscription: extend from current expiry if still active, else from now
            $stmt = $pdo->prepare("SELECT plan_type, plan_expires_at FROM kateb_users WHERE id = ? LIMIT 1");
            $stmt->execute([$uid]);
            $userRow = $stmt->fetch();
            $currentExpiry = $userRow['plan_expires_at'] ?? null;
            $baseDate = ($currentExpiry && strtotime($currentExpiry) > time()) ? $currentExpiry : now_iso();
            $newExpiry = date('Y-m-d H:i:s', strtotime("+{$durationMonths} months", strtotime($baseDate)));

            $pdo->prepare("UPDATE kateb_users SET plan_type=?, plan_expires_at=?, ai_assistant_usage_this_month=0, template_usage_this_month=0, usage_cycle_start=? WHERE id=?")
                ->execute([$planId, $newExpiry, now_iso(), $uid]);

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            error_log('Bazaar purchase verification DB error: ' . $e->getMessage());
            json_error('خطا در ثبت اشتراک', 500);
        }

        json_out([
            'success' => true,
            'plan_id' => $planId,
            'duration_months' => $durationMonths,
            'expires_at' => $newExpiry,
            'already_processed' => false,
        ]);
    }

    // ═══ ADMIN ENDPOINTS ═══════════════════════════════════════
    if (!$user['is_admin']) json_error('دسترسی غیرمجاز', 403);

    if ($act === 'admin_users_list') {
        $stmt = db()->query("SELECT id, phone, full_name, is_admin, coins, plan_type, created_at FROM kateb_users ORDER BY created_at DESC");
        json_out(['data' => $stmt->fetchAll()]);
    }
    if ($act === 'admin_user_set_coins') {
        $targetId = (string)($b['id'] ?? '');
        $newVal = max(0, floor((int)($b['coins'] ?? 0)));
        if (!$targetId) json_error('کاربر نامعتبر', 400);
        db()->prepare("UPDATE kateb_users SET coins = ? WHERE id = ?")->execute([$newVal, $targetId]);
        json_out(['success' => true, 'coins' => $newVal]);
    }
    if ($act === 'admin_user_add_coins') {
        $targetId = (string)($b['id'] ?? '');
        $amount = (int)($b['amount'] ?? 0);
        if (!$targetId || !$amount) json_error('مقادیر نامعتبر', 400);
        db()->prepare("UPDATE kateb_users SET coins = GREATEST(0, coins + ?) WHERE id = ?")->execute([$amount, $targetId]);
        $stmt = db()->prepare("SELECT coins FROM kateb_users WHERE id = ? LIMIT 1");
        $stmt->execute([$targetId]);
        json_out(['success' => true, 'coins' => (int)$stmt->fetchColumn()]);
    }
    if ($act === 'admin_user_update') {
        $id = (string)($b['id'] ?? '');
        $fields = []; $vals = [];
        if (array_key_exists('full_name', $b)) { $fields[] = 'full_name = ?'; $vals[] = $b['full_name']; }
        if (array_key_exists('is_admin', $b)) { $fields[] = 'is_admin = ?'; $vals[] = $b['is_admin'] ? 1 : 0; }
        if (!empty($b['password'])) { $fields[] = 'password_hash = ?'; $vals[] = hash_password((string)$b['password']); }
        if ($fields) {
            $vals[] = $id;
            db()->prepare("UPDATE kateb_users SET " . implode(', ', $fields) . " WHERE id = ?")->execute($vals);
        }
        json_out(['success' => true]);
    }
    if ($act === 'admin_user_delete') {
        db()->prepare("DELETE FROM kateb_users WHERE id = ?")->execute([(string)($b['id'] ?? '')]);
        json_out(['success' => true]);
    }
    if ($act === 'admin_user_set_plan') {
        $targetId = (string)($b['id'] ?? '');
        $planId = (string)($b['plan_id'] ?? 'free');
        if (!$targetId) json_error('کاربر نامعتبر', 400);
        $validPlans = ['free', 'basic', 'pro'];
        if (!in_array($planId, $validPlans, true)) json_error('طرح نامعتبر', 400);

        $cycleStart = now_iso();
        $expiryDate = $planId === 'free' ? null : date('Y-m-d H:i:s', strtotime('+30 days'));
        db()->prepare("UPDATE kateb_users SET plan_type = ?, ai_assistant_usage_this_month = 0, template_usage_this_month = 0, usage_cycle_start = ?, plan_expires_at = ? WHERE id = ?")
            ->execute([$planId, $cycleStart, $expiryDate, $targetId]);

        $stmt = db()->prepare("SELECT id, phone, full_name, is_admin, coins, plan_type, ai_assistant_usage_this_month, template_usage_this_month, usage_cycle_start, created_at FROM kateb_users WHERE id = ? LIMIT 1");
        $stmt->execute([$targetId]);
        $updated = $stmt->fetch();
        json_out(['success' => true, 'data' => $updated]);
    }

    if ($act === 'admin_user_create') {
        $phone = (string)($b['phone'] ?? '');
        if (!preg_match('/^09\d{9}$/', $phone)) json_error('شماره نامعتبر', 400);
        $password = (string)($b['password'] ?? '');
        if (strlen($password) < 4) json_error('رمز کوتاه', 400);
        $newId = gen_uuid();
        db()->prepare("INSERT INTO kateb_users (id, phone, full_name, is_admin, password_hash) VALUES (?, ?, ?, ?, ?)")
            ->execute([$newId, $phone, $b['full_name'] ?? '', ($b['is_admin'] ?? false) ? 1 : 0, hash_password($password)]);
        json_out(['data' => ['id' => $newId]]);
    }
    if ($act === 'admin_settings_get') {
        json_out(['data' => get_settings()]);
    }
    if ($act === 'admin_settings_update') {
        $fields = []; $vals = [];
        foreach (['sms_api_key', 'sms_pattern_code', 'sms_line_number', 'ai_api_url', 'ai_api_key', 'ai_models', 'zarinpal_merchant_id', 'bazaar_client_id', 'bazaar_client_secret', 'bazaar_refresh_token'] as $f) {
            if (array_key_exists($f, $b)) { $fields[] = "$f = ?"; $vals[] = $b[$f]; }
        }
        if (array_key_exists('zarinpal_sandbox', $b)) { $fields[] = 'zarinpal_sandbox = ?'; $vals[] = $b['zarinpal_sandbox'] ? 1 : 0; }
        $fields[] = 'updated_at = ?'; $vals[] = now_iso();
        $vals[] = 1;
        db()->prepare("UPDATE kateb_settings SET " . implode(', ', $fields) . " WHERE id = ?")->execute($vals);
        json_out(['success' => true]);
    }
    if ($act === 'admin_stats') {
        $counts = ['users' => 0, 'tasks' => 0, 'events' => 0];
        $counts['users'] = (int)db()->query("SELECT COUNT(*) FROM kateb_users")->fetchColumn();
        try { $counts['tasks'] = (int)db()->query("SELECT COUNT(*) FROM calendar_tasks")->fetchColumn(); } catch (Exception $e) {}
        try { $counts['events'] = (int)db()->query("SELECT COUNT(*) FROM calendar_events")->fetchColumn(); } catch (Exception $e) {}
        json_out(['data' => $counts]);
        return;
    }
    if ($act === 'admin_subs_list') {
        $stmt = db()->query("SELECT u.id, u.phone, u.full_name, u.plan_type, u.ai_assistant_usage_this_month, u.template_usage_this_month, u.usage_cycle_start, u.plan_expires_at FROM kateb_users u ORDER BY u.created_at DESC LIMIT 50");
        $rows = $stmt->fetchAll();
        $planLimits = ['free' => [10, 15], 'basic' => [100, 200], 'pro' => [500, 1000]];
        $enriched = [];
        foreach ($rows as $r) {
            $planId = $r['plan_type'] ?? 'free';
            $limits = $planLimits[$planId] ?? $planLimits['free'];
            $enriched[] = [
                'id' => $r['id'],
                'plan_id' => $planId,
                'status' => $planId === 'free' ? 'cancelled' : 'active',
                'ai_assistant_usage' => (int)($r['ai_assistant_usage_this_month'] ?? 0),
                'template_usage' => (int)($r['template_usage_this_month'] ?? 0),
                'ai_assistant_limit' => $limits[0],
                'template_limit' => $limits[1],
                'started_at' => $r['usage_cycle_start'] ?? null,
                'expires_at' => $r['plan_expires_at'] ?? null,
                'cycle_start' => $r['usage_cycle_start'] ?? null,
                'kateb_users' => ['full_name' => $r['full_name'], 'phone' => $r['phone']],
            ];
        }
        json_out(['data' => $enriched]);
    }
    if ($act === 'admin_transactions_list') {
        $stmt = db()->query("SELECT po.id, po.plan_id, po.amount_toman, po.status, po.authority, po.ref_id, po.created_at, po.paid_at, po.payment_provider, po.product_id, po.bazaar_purchase_id, u.full_name, u.phone FROM plan_orders po JOIN kateb_users u ON po.user_id = u.id ORDER BY po.created_at DESC LIMIT 50");
        $rows = $stmt->fetchAll();
        $enriched = [];
        foreach ($rows as $r) {
            $enriched[] = [
                'id' => $r['id'],
                'plan_id' => $r['plan_id'],
                'amount_toman' => (int)$r['amount_toman'],
                'status' => $r['status'],
                'authority' => $r['authority'],
                'ref_id' => $r['ref_id'],
                'created_at' => $r['created_at'],
                'paid_at' => $r['paid_at'],
                'payment_provider' => $r['payment_provider'] ?? 'zarinpal',
                'product_id' => $r['product_id'] ?? '',
                'bazaar_purchase_id' => $r['bazaar_purchase_id'] ?? null,
                'kateb_users' => ['full_name' => $r['full_name'], 'phone' => $r['phone']],
            ];
        }
        json_out(['data' => $enriched]);
    }

    json_error('Unknown action', 404);

} catch (Throwable $e) {
    json_error($e->getMessage() ?: 'Internal error', 500);
}
