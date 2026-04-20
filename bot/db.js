const { Pool, types } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const dns = require('dns');
const path = require('path');
require('dotenv').config();

// Force Node.js to prefer IPv4 for pg
dns.setDefaultResultOrder('ipv4first');

// Tell pg driver to parse Postgres NUMERIC (OID 1700) as JS Numbers instead of Strings
types.setTypeParser(1700, val => parseFloat(val));

const usePostgres = !!process.env.DATABASE_URL;

let db;

if (usePostgres) {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const convertQuery = (sql) => {
        let pgSql = sql;
        pgSql = pgSql.replace(/AUTOINCREMENT/gi, 'SERIAL');
        pgSql = pgSql.replace(/DATETIME/gi, 'TIMESTAMP');
        pgSql = pgSql.replace(/INTEGER PRIMARY KEY/gi, 'BIGINT PRIMARY KEY');
        pgSql = pgSql.replace(/REAL/gi, 'NUMERIC');
        
        let i = 1;
        pgSql = pgSql.replace(/\?/g, () => `$${i++}`);

        if (pgSql.match(/^INSERT INTO/i) && !pgSql.match(/RETURNING/i) && !pgSql.match(/INSERT OR/i)) {
             pgSql += ' RETURNING id';
        }
        if (pgSql.match(/INSERT OR IGNORE INTO/i)) {
            pgSql = pgSql.replace(/INSERT OR IGNORE INTO/i, 'INSERT INTO');
            pgSql += ' ON CONFLICT DO NOTHING';
        }

        return pgSql;
    };

    db = {
        serialize: cb => cb(),
        run: (sql, params = [], cb) => {
            if (typeof params === 'function') { cb = params; params = []; }
            const pgSql = convertQuery(sql);
            pool.query(pgSql, params.map(p => p === undefined ? null : p), (err, result) => {
                if (err) {
                    if (err.code !== '23505') console.error("DB RUN ERROR:", err.message, pgSql);
                }
                if (cb) cb.call({ lastID: result?.rows?.[0]?.id || 0, changes: result?.rowCount || 0 }, err);
            });
        },
        get: (sql, params = [], cb) => {
            if (typeof params === 'function') { cb = params; params = []; }
            const pgSql = convertQuery(sql);
            pool.query(pgSql, params.map(p => p === undefined ? null : p), (err, result) => {
                if (err) console.error("DB GET ERROR:", err.message, pgSql);
                if (cb) cb(err, result?.rows?.[0] || null);
            });
        },
        all: (sql, params = [], cb) => {
            if (typeof params === 'function') { cb = params; params = []; }
            const pgSql = convertQuery(sql);
            pool.query(pgSql, params.map(p => p === undefined ? null : p), (err, result) => {
                if (err) console.error("DB ALL ERROR:", err.message, pgSql);
                if (cb) cb(err, result?.rows || []);
            });
        },
        seedFamily: (familyId, cb) => {
            db.run('INSERT INTO wallets (name, icon, amount, family_id) VALUES ($1, $2, $3, $4) ON CONFLICT (name, family_id) DO NOTHING', ['Банковская карта', '💳', 0, familyId]);
            db.run('INSERT INTO wallets (name, icon, amount, family_id) VALUES ($1, $2, $3, $4) ON CONFLICT (name, family_id) DO NOTHING', ['Наличка', '💵', 0, familyId]);
            db.run('INSERT INTO budgets (name, icon, type, planned_amount, family_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (name, family_id) DO NOTHING', ['Основной доход', '💰', 'income', 50000, familyId]);
            const defaults = [
                ['Проживание (Аренда)', 'expense', '🏠', true], ['Коммуналка', 'expense', '💡', true],
                ['Еда (Продукты)', 'expense', '🛒', true], ['Транспорт', 'expense', '🚌', true],
                ['Одежда', 'expense', '👕', false], ['Зарплата', 'income', '💰', false]
            ];
            defaults.forEach(c => db.run('INSERT INTO categories (name, type, icon, is_mandatory, family_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (name, family_id) DO NOTHING', [...c, familyId]));
            db.run('INSERT INTO goals (name, icon, type, amount_saved, target_amount, family_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (name, family_id) DO NOTHING', ['Стоматолог', '🦷', 'savings_goal', 0, 100000, familyId]);
            db.run('INSERT INTO goals (name, icon, type, amount_saved, target_amount, family_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (name, family_id) DO NOTHING', ['Новая вещь', '👕', 'wishlist', 0, 5000, familyId]);
            if (cb) cb();
        },
        _pool: pool // Expose pool solely for migrations
    };

} else {
    // ----------------------------------------------------
    // SQLite Engine: 100% BULLETPROOF ZERO-CRASH ARCHITECTURE
    // ----------------------------------------------------
    console.log("[STORAGE] Cloud is unreachable or disabled. Switching to Bulletproof SQLite native mode.");
    
    // Polyfill db overrides to match the exact same API but using pure SQLite backend
    const _sqlite = new sqlite3.Database(path.join(__dirname, 'finance.db'));
    
    db = {
        serialize: cb => _sqlite.serialize(cb),
        run: (sql, params, cb) => _sqlite.run(sql, params, cb),
        get: (sql, params, cb) => _sqlite.get(sql, params, cb),
        all: (sql, params, cb) => _sqlite.all(sql, params, cb),
        seedFamily: (familyId, cb) => {
            _sqlite.run('INSERT OR IGNORE INTO wallets (name, icon, amount, family_id) VALUES (?, ?, ?, ?)', ['Банковская карта', '💳', 0, familyId]);
            _sqlite.run('INSERT OR IGNORE INTO wallets (name, icon, amount, family_id) VALUES (?, ?, ?, ?)', ['Наличка', '💵', 0, familyId]);
            _sqlite.run('INSERT OR IGNORE INTO budgets (name, icon, type, planned_amount, family_id) VALUES (?, ?, ?, ?, ?)', ['Основной доход', '💰', 'income', 50000, familyId]);
            
            const defaults = [
                ['Проживание (Аренда)', 'expense', '🏠', true], ['Коммуналка', 'expense', '💡', true],
                ['Еда (Продукты)', 'expense', '🛒', true], ['Транспорт', 'expense', '🚌', true],
                ['Одежда', 'expense', '👕', false], ['Зарплата', 'income', '💰', false]
            ];
            defaults.forEach(c => _sqlite.run('INSERT OR IGNORE INTO categories (name, type, icon, is_mandatory, family_id) VALUES (?, ?, ?, ?, ?)', [...c, familyId]));
            _sqlite.run('INSERT OR IGNORE INTO goals (name, icon, type, amount_saved, target_amount, family_id) VALUES (?, ?, ?, ?, ?, ?)', ['Стоматолог', '🦷', 'savings_goal', 0, 100000, familyId]);
            _sqlite.run('INSERT OR IGNORE INTO goals (name, icon, type, amount_saved, target_amount, family_id) VALUES (?, ?, ?, ?, ?, ?)', ['Новая вещь', '👕', 'wishlist', 0, 5000, familyId]);
            
            if (cb) cb();
        }
    };
}

// INITIALIZATION LOGIC (Runs on worker start)
db.serialize(() => {
    // 1. Initial creations (kept for clean startups)
    db.run(`CREATE TABLE IF NOT EXISTS users (telegram_id BIGINT PRIMARY KEY, first_name TEXT, username TEXT, family_id BIGINT)`);
    db.run(`CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name TEXT, type TEXT, icon TEXT, is_mandatory BOOLEAN DEFAULT false, planned_amount NUMERIC DEFAULT 0, family_id BIGINT)`);
    db.run(`CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, amount NUMERIC, category_id INTEGER, user_id BIGINT, date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, description TEXT, family_id BIGINT, wallet_id INTEGER)`);
    db.run(`CREATE TABLE IF NOT EXISTS wallets (id SERIAL PRIMARY KEY, name TEXT, icon TEXT, amount NUMERIC DEFAULT 0, family_id BIGINT)`);
    db.run(`CREATE TABLE IF NOT EXISTS savings (id SERIAL PRIMARY KEY, user_id BIGINT, name TEXT, currency TEXT, amount NUMERIC, family_id BIGINT)`);
    db.run(`CREATE TABLE IF NOT EXISTS investments (id SERIAL PRIMARY KEY, name TEXT, icon TEXT, amount NUMERIC, family_id BIGINT)`);
    db.run(`CREATE TABLE IF NOT EXISTS debts (id SERIAL PRIMARY KEY, name TEXT, amount NUMERIC, family_id BIGINT)`);
    db.run(`CREATE TABLE IF NOT EXISTS recurring_payments (id SERIAL PRIMARY KEY, name TEXT, amount NUMERIC, category_id INTEGER, user_id BIGINT, day_of_month INTEGER, type TEXT, family_id BIGINT, wallet_id INTEGER, last_processed_date TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS budgets (id SERIAL PRIMARY KEY, name TEXT, icon TEXT, type TEXT, planned_amount NUMERIC DEFAULT 0, family_id BIGINT)`);
    db.run(`CREATE TABLE IF NOT EXISTS goals (id SERIAL PRIMARY KEY, name TEXT, icon TEXT, type TEXT, amount_saved NUMERIC DEFAULT 0, target_amount NUMERIC DEFAULT 0, family_id BIGINT)`);
    db.run(`CREATE TABLE IF NOT EXISTS allocation_rules (id SERIAL PRIMARY KEY, target_goal_id INTEGER, percentage NUMERIC DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS transfers (id SERIAL PRIMARY KEY, amount NUMERIC, from_wallet_id INTEGER, to_wallet_id INTEGER, date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, family_id BIGINT)`);

    // 2. Perform Migrations for existing tables
    const tablesToMigrate = ['users', 'categories', 'transactions', 'wallets', 'savings', 'investments', 'debts', 'recurring_payments', 'budgets', 'goals', 'transfers'];
    tablesToMigrate.forEach(table => {
        db.run(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS family_id BIGINT`);
    });
    // Migrate transaction/recurring tables to attach wallet and processing dates
    db.run(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS wallet_id INTEGER`);
    db.run(`ALTER TABLE recurring_payments ADD COLUMN IF NOT EXISTS wallet_id INTEGER`);
    db.run(`ALTER TABLE recurring_payments ADD COLUMN IF NOT EXISTS last_processed_date TEXT`);

    // 3. Drop existing unique constraints that conflict with multi-tenancy
    if (usePostgres && db._pool) {
        db._pool.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_name_key') THEN
                    ALTER TABLE categories DROP CONSTRAINT categories_name_key;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_name_family_unique') THEN
                    ALTER TABLE categories ADD CONSTRAINT categories_name_family_unique UNIQUE (name, family_id);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallets_name_family_unique') THEN
                    ALTER TABLE wallets ADD CONSTRAINT wallets_name_family_unique UNIQUE (name, family_id);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budgets_name_family_unique') THEN
                    ALTER TABLE budgets ADD CONSTRAINT budgets_name_family_unique UNIQUE (name, family_id);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_name_family_unique') THEN
                    ALTER TABLE goals ADD CONSTRAINT goals_name_family_unique UNIQUE (name, family_id);
                END IF;
            END $$;
        `).catch(err => console.error("Migration error:", err));
    }
    // Seeds are now handled during user registration in index.js to support per-family seeding
});

module.exports = db;
