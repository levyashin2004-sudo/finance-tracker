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
    db.run(`CREATE TABLE IF NOT EXISTS users (telegram_id BIGINT PRIMARY KEY, first_name TEXT, username TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name TEXT UNIQUE, type TEXT, icon TEXT, is_mandatory BOOLEAN DEFAULT false, planned_amount NUMERIC DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, amount NUMERIC, category_id INTEGER, user_id BIGINT, date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, description TEXT, FOREIGN KEY (category_id) REFERENCES categories (id), FOREIGN KEY (user_id) REFERENCES users (telegram_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS wallets (id SERIAL PRIMARY KEY, name TEXT, icon TEXT, amount NUMERIC DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS savings (id SERIAL PRIMARY KEY, user_id BIGINT, name TEXT, currency TEXT, amount NUMERIC, FOREIGN KEY (user_id) REFERENCES users (telegram_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS investments (id SERIAL PRIMARY KEY, name TEXT, icon TEXT, amount NUMERIC)`);
    db.run(`CREATE TABLE IF NOT EXISTS debts (id SERIAL PRIMARY KEY, name TEXT, amount NUMERIC)`);
    db.run(`CREATE TABLE IF NOT EXISTS recurring_payments (id SERIAL PRIMARY KEY, name TEXT, amount NUMERIC, category_id INTEGER, user_id BIGINT, day_of_month INTEGER, type TEXT, FOREIGN KEY (category_id) REFERENCES categories (id))`);
    db.run(`CREATE TABLE IF NOT EXISTS budgets (id SERIAL PRIMARY KEY, name TEXT, icon TEXT, type TEXT, planned_amount NUMERIC DEFAULT 0)`);
    
    // NEW TABLES
    db.run(`CREATE TABLE IF NOT EXISTS goals (
        id SERIAL PRIMARY KEY,
        name TEXT,
        icon TEXT,
        type TEXT, 
        amount_saved NUMERIC DEFAULT 0,
        target_amount NUMERIC DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS allocation_rules (
        id SERIAL PRIMARY KEY,
        target_goal_id INTEGER,
        percentage NUMERIC DEFAULT 0,
        FOREIGN KEY (target_goal_id) REFERENCES goals (id)
    )`);

    // SEEDS
    db.get('SELECT COUNT(*) as count FROM wallets', (err, row) => {
        if (row && parseInt(row.count) === 0) {
            db.run('INSERT INTO wallets (name, icon, amount) VALUES ($1, $2, $3)', ['Банковская карта', '💳', 0]);
            db.run('INSERT INTO wallets (name, icon, amount) VALUES ($1, $2, $3)', ['Наличка', '💵', 0]);
        }
    });

    db.get('SELECT COUNT(*) as count FROM budgets', (err, row) => {
        if (row && parseInt(row.count) === 0) {
            db.run('INSERT INTO budgets (name, icon, type, planned_amount) VALUES ($1, $2, $3, $4)', ['Основной доход', '💰', 'income', 50000]);
        }
    });

    db.get('SELECT COUNT(*) as count FROM categories', (err, row) => {
        if (row && parseInt(row.count) === 0) {
            const defaults = [
                ['Проживание (Аренда)', 'expense', '🏠', true], ['Коммуналка', 'expense', '💡', true],
                ['Еда (Продукты)', 'expense', '🛒', true], ['Транспорт', 'expense', '🚌', true],
                ['Одежда', 'expense', '👕', false], ['Зарплата', 'income', '💰', false]
            ];
            const stmt = db.prepare('INSERT INTO categories (name, type, icon, is_mandatory) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING');
            defaults.forEach(c => stmt.run(...c));
            stmt.finalize();
        }
    });

    db.get('SELECT COUNT(*) as count FROM goals', (err, row) => {
        if (row && parseInt(row.count) === 0) {
            db.run('INSERT INTO goals (name, icon, type, amount_saved, target_amount) VALUES ($1, $2, $3, $4, $5)', ['Стоматолог', '🦷', 'savings_goal', 0, 100000]);
            db.run('INSERT INTO goals (name, icon, type, amount_saved, target_amount) VALUES ($1, $2, $3, $4, $5)', ['Новая вещь', '👕', 'wishlist', 0, 5000]);
        }
    });
});

module.exports = db;
