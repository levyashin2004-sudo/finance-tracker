const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'finance.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (telegram_id INTEGER PRIMARY KEY, first_name TEXT, username TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, type TEXT, icon TEXT, is_mandatory BOOLEAN DEFAULT 0, planned_amount REAL DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, amount INTEGER, category_id INTEGER, user_id INTEGER, date DATETIME DEFAULT CURRENT_TIMESTAMP, description TEXT, FOREIGN KEY (category_id) REFERENCES categories (id), FOREIGN KEY (user_id) REFERENCES users (telegram_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS wallets (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, icon TEXT, amount REAL DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS savings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, currency TEXT, amount REAL, FOREIGN KEY (user_id) REFERENCES users (telegram_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS investments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, icon TEXT, amount REAL)`);
    db.run(`CREATE TABLE IF NOT EXISTS debts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, amount REAL)`);
    db.run(`CREATE TABLE IF NOT EXISTS recurring_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, amount INTEGER, category_id INTEGER, user_id INTEGER, day_of_month INTEGER, type TEXT, FOREIGN KEY (category_id) REFERENCES categories (id))`);
    db.run(`CREATE TABLE IF NOT EXISTS budgets (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, icon TEXT, type TEXT, planned_amount REAL DEFAULT 0)`);
    
    // NEW TABLES
    db.run(`CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        icon TEXT,
        type TEXT, -- 'wishlist' or 'savings_goal'
        amount_saved REAL DEFAULT 0,
        target_amount REAL DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS allocation_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_goal_id INTEGER,
        percentage REAL DEFAULT 0,
        FOREIGN KEY (target_goal_id) REFERENCES goals (id)
    )`);

    // SEEDS
    db.get('SELECT COUNT(*) as count FROM wallets', (err, row) => {
        if (row && row.count === 0) {
            db.run('INSERT INTO wallets (name, icon, amount) VALUES ("Банковская карта", "💳", 0)');
            db.run('INSERT INTO wallets (name, icon, amount) VALUES ("Наличка", "💵", 0)');
        }
    });

    db.get('SELECT COUNT(*) as count FROM budgets', (err, row) => {
        if (row && row.count === 0) {
            db.run('INSERT INTO budgets (name, icon, type, planned_amount) VALUES ("Психология (София)", "🧠", "income", 50000)');
            db.run('INSERT INTO budgets (name, icon, type, planned_amount) VALUES ("Радиолампы (Лев)", "📻", "income", 30000)');
        }
    });

    db.get('SELECT COUNT(*) as count FROM categories', (err, row) => {
        if (row && row.count === 0) {
            const defaults = [
                ['Проживание (Аренда)', 'expense', '🏠', 1], ['Коммуналка', 'expense', '💡', 1],
                ['Еда (Продукты)', 'expense', '🛒', 1], ['Транспорт', 'expense', '🚌', 1],
                ['Одежда', 'expense', '👕', 0], ['Зарплата', 'income', '💰', 0]
            ];
            const stmt = db.prepare('INSERT INTO categories (name, type, icon, is_mandatory) VALUES (?, ?, ?, ?)');
            defaults.forEach(c => stmt.run(c));
            stmt.finalize();
        }
    });

    db.get('SELECT COUNT(*) as count FROM goals', (err, row) => {
        if (row && row.count === 0) {
            // Seed a target
            db.run('INSERT INTO goals (name, icon, type, amount_saved, target_amount) VALUES ("Стоматолог", "🦷", "savings_goal", 0, 100000)');
            db.run('INSERT INTO goals (name, icon, type, amount_saved, target_amount) VALUES ("Новая майка", "👕", "wishlist", 0, 5000)');
        }
    });
});

module.exports = db;
