-- Cloudflare D1 (SQLite) Schema for my_office_Cloudflare

-- 1. Personnel Table
CREATE TABLE IF NOT EXISTS personnel (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    rank            TEXT DEFAULT '',
    first_name      TEXT DEFAULT '',
    last_name       TEXT DEFAULT '',
    phone           TEXT DEFAULT '',
    bank            TEXT DEFAULT '',
    account_number  TEXT DEFAULT '',
    citizen_id      TEXT DEFAULT '',
    military_id     TEXT DEFAULT '',
    duty            TEXT DEFAULT '',
    position        TEXT DEFAULT '',
    unit            TEXT DEFAULT '',
    birthplace      TEXT DEFAULT '',
    birth_date      TEXT DEFAULT '',
    registered_date TEXT DEFAULT '',
    enlistment_date TEXT DEFAULT '',
    rank_date       TEXT DEFAULT '',
    salary          TEXT DEFAULT '',
    age             TEXT DEFAULT '',
    retire_year     TEXT DEFAULT '',
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_personnel_name ON personnel(first_name, last_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_personnel_citizen ON personnel(citizen_id) WHERE citizen_id != '';

-- 2. Dashboard Admins Table
CREATE TABLE IF NOT EXISTS dashboard_admins (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT DEFAULT '' UNIQUE,
    uid        TEXT DEFAULT '',
    name       TEXT DEFAULT '',
    approved   INTEGER DEFAULT 0, -- 0 for false, 1 for true
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 3. Review Records Table (For auditing/logging changes)
CREATE TABLE IF NOT EXISTS review_records (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    row_index   INTEGER DEFAULT 0,
    name        TEXT DEFAULT '',
    card_number TEXT DEFAULT '',
    status      TEXT DEFAULT 'pending',
    note        TEXT DEFAULT '',
    updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 4. Pass Requests Table (Vehicle requests from sheets)
CREATE TABLE IF NOT EXISTS pass_requests (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp            TEXT,
    rank                 TEXT,
    first_name           TEXT,
    last_name            TEXT,
    relation             TEXT,
    phone                TEXT,
    vehicle_type         TEXT,
    vehicle_model        TEXT,
    vehicle_color        TEXT,
    plate                TEXT,
    image                TEXT, -- Base64 or URL
    status_m             TEXT,
    status_n             TEXT,
    paid_amount          INTEGER DEFAULT 0,
    approved_pass_number TEXT,
    updated_at           TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pass_requests_phone ON pass_requests(phone);
CREATE INDEX IF NOT EXISTS idx_pass_requests_name ON pass_requests(first_name, last_name);

-- 5. Cameras Table (CCTV markers)
CREATE TABLE IF NOT EXISTS cameras (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    name                    TEXT NOT NULL,
    description             TEXT,
    lat                     REAL NOT NULL,
    lng                     REAL NOT NULL,
    type                    TEXT,
    status                  TEXT DEFAULT 'online',
    last_checked_at         TEXT,
    last_checked_image      TEXT,
    last_checked_image_path TEXT,
    updated_at              TEXT DEFAULT CURRENT_TIMESTAMP
);
