const { Pool } = require('pg');
require('dotenv').config();

// Create PostgreSQL connection pool
// This gracefully handles both local execution and Render execution
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Supabase
});

// Helper to convert SQLite syntax to PostgreSQL syntax
const convertQuery = (sql) => {
    let pgSql = sql;
    
    // SQLite types to Postgres types
    pgSql = pgSql.replace(/AUTOINCREMENT/gi, 'SERIAL');
    pgSql = pgSql.replace(/DATETIME/gi, 'TIMESTAMP');
    pgSql = pgSql.replace(/INTEGER PRIMARY KEY/gi, 'BIGINT PRIMARY KEY');
    pgSql = pgSql.replace(/REAL/gi, 'NUMERIC');
    
    // Convert named parameters '?' to '$1', '$2'
    let i = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${i++}`);

    // If it's an INSERT but doesn't have RETURNING, add RETURNING id to emulate SQLite lastID
    if (pgSql.match(/^INSERT INTO/i) && !pgSql.match(/RETURNING/i) && !pgSql.match(/INSERT OR/i)) {
         pgSql += ' RETURNING id';
    }

    // Convert INSERT OR IGNORE to ON CONFLICT DO NOTHING
    if (pgSql.match(/INSERT OR IGNORE INTO/i)) {
        pgSql = pgSql.replace(/INSERT OR IGNORE INTO/i, 'INSERT INTO');
        pgSql += ' ON CONFLICT DO NOTHING';
    }

    return pgSql;
};

const db = {
    serialize: (cb) => {
        // Postgres executes sequentially when using promises, or we just call the cb
        cb();
    },
    run: (sql, params = [], cb) => {
        if (typeof params === 'function') {
            cb = params;
            params = [];
        }
        
        let pgSql = convertQuery(sql);
        pool.query(pgSql, params, (err, result) => {
            if (cb) {
                // Return context equivalent to SQLite
                const context = { 
                    lastID: (result && result.rows && result.rows.length) ? result.rows[0].id : 0, 
                    changes: result ? result.rowCount : 0 
                };
                cb.call(context, err);
            }
        });
    },
    get: (sql, params = [], cb) => {
        if (typeof params === 'function') {
            cb = params;
            params = [];
        }
        pool.query(convertQuery(sql), params, (err, result) => {
            if (cb) cb(err, (result && result.rows) ? result.rows[0] : null);
        });
    },
    all: (sql, params = [], cb) => {
        if (typeof params === 'function') {
            cb = params;
            params = [];
        }
        pool.query(convertQuery(sql), params, (err, result) => {
            if (cb) cb(err, (result && result.rows) ? result.rows : []);
        });
    },
    prepare: (sql) => {
        // Mocking SQLite Statement
        return {
            run: function() {
                const args = Array.from(arguments);
                let cb = null;
                if (args.length > 0 && typeof args[args.length - 1] === 'function') {
                    cb = args.pop();
                }
                db.run(sql, args, cb);
            },
            finalize: () => {}
        };
    }
};

// INITIALIZATION LOGIC (Runs on worker start)
db.serialize(() => {
    // 1. Initial creations (kept for clean startups)
    db.run(`CREATE TABLE IF NOT EXISTS users (telegram_id BIGINT PRIMARY KEY, first_name TEXT, username TEXT, family_id BIGINT)`);
    db.run(`CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name TEXT, type TEXT, icon TEXT, is_mandatory BOOLEAN DEFAULT false, planned_amount NUMERIC DEFAULT 0, family_id BIGINT)`);
    db.run(`CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, amount NUMERIC, category_id INTEGER, user_id BIGINT, date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, description TEXT, family_id BIGINT)`);
    db.run(`CREATE TABLE IF NOT EXISTS wallets (id SERIAL PRIMARY KEY, name TEXT, icon TEXT, amount NUMERIC DEFAULT 0, family_id BIGINT)`);
    db.run(`CREATE TABLE IF NOT EXISTS savings (id SERIAL PRIMARY KEY, user_id BIGINT, name TEXT, currency TEXT, amount NUMERIC, family_id BIGINT)`);
    db.run(`CREATE TABLE IF NOT EXISTS investments (id SERIAL PRIMARY KEY, name TEXT, icon TEXT, amount NUMERIC, family_id BIGINT)`);
    db.run(`CREATE TABLE IF NOT EXISTS debts (id SERIAL PRIMARY KEY, name TEXT, amount NUMERIC, family_id BIGINT)`);
    db.run(`CREATE TABLE IF NOT EXISTS recurring_payments (id SERIAL PRIMARY KEY, name TEXT, amount NUMERIC, category_id INTEGER, user_id BIGINT, day_of_month INTEGER, type TEXT, family_id BIGINT)`);
    db.run(`CREATE TABLE IF NOT EXISTS budgets (id SERIAL PRIMARY KEY, name TEXT, icon TEXT, type TEXT, planned_amount NUMERIC DEFAULT 0, family_id BIGINT)`);
    db.run(`CREATE TABLE IF NOT EXISTS goals (id SERIAL PRIMARY KEY, name TEXT, icon TEXT, type TEXT, amount_saved NUMERIC DEFAULT 0, target_amount NUMERIC DEFAULT 0, family_id BIGINT)`);
    db.run(`CREATE TABLE IF NOT EXISTS allocation_rules (id SERIAL PRIMARY KEY, target_goal_id INTEGER, percentage NUMERIC DEFAULT 0)`);

    // 2. Perform Migrations for existing tables
    const tablesToMigrate = ['users', 'categories', 'transactions', 'wallets', 'savings', 'investments', 'debts', 'recurring_payments', 'budgets', 'goals'];
    tablesToMigrate.forEach(table => {
        db.run(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS family_id BIGINT`);
    });

    // 3. Drop existing unique constraints that conflict with multi-tenancy
    // PostgreSQL wrapper for safely dropping and recreating unique constraint spanning family_id
    pool.query(`
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_name_key') THEN
                ALTER TABLE categories DROP CONSTRAINT categories_name_key;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_name_family_unique') THEN
                ALTER TABLE categories ADD CONSTRAINT categories_name_family_unique UNIQUE (name, family_id);
            END IF;
        END $$;
    `).catch(err => console.error("Migration error:", err));

    // Seeds are now handled during user registration in index.js to support per-family seeding
});

// Export a helper function to seed a fresh family
db.seedFamily = function(familyId, cb) {
    db.run('INSERT INTO wallets (name, icon, amount, family_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', ['Банковская карта', '💳', 0, familyId]);
    db.run('INSERT INTO wallets (name, icon, amount, family_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', ['Наличка', '💵', 0, familyId]);
    
    db.run('INSERT INTO budgets (name, icon, type, planned_amount, family_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING', ['Основной доход', '💰', 'income', 50000, familyId]);
    
    const defaults = [
        ['Проживание (Аренда)', 'expense', '🏠', true], ['Коммуналка', 'expense', '💡', true],
        ['Еда (Продукты)', 'expense', '🛒', true], ['Транспорт', 'expense', '🚌', true],
        ['Одежда', 'expense', '👕', false], ['Зарплата', 'income', '💰', false]
    ];
    defaults.forEach(c => {
        db.run('INSERT INTO categories (name, type, icon, is_mandatory, family_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING', [...c, familyId]);
    });
    
    db.run('INSERT INTO goals (name, icon, type, amount_saved, target_amount, family_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING', ['Стоматолог', '🦷', 'savings_goal', 0, 100000, familyId]);
    db.run('INSERT INTO goals (name, icon, type, amount_saved, target_amount, family_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING', ['Новая вещь', '👕', 'wishlist', 0, 5000, familyId]);
    
    if (cb) cb();
};

module.exports = db;
