const db = require('./db.js');

db.serialize(() => {
    // Insert a dummy user
    db.run('INSERT OR IGNORE INTO users (telegram_id, first_name) VALUES (111111, "Lev")');
    db.run('INSERT OR IGNORE INTO users (telegram_id, first_name) VALUES (222222, "Wife")');

    // Insert dummy transactions
    const txStmt = db.prepare('INSERT INTO transactions (amount, category_id, user_id, date) VALUES (?, ?, ?, ?)');
    txStmt.run(55000, 1, 111111, new Date().toISOString()); // Аренда (mandatory)
    txStmt.run(1500, 3, 222222, new Date().toISOString());  // Еда (mandatory)
    txStmt.run(300, 4, 111111, new Date().toISOString());   // Транспорт (mandatory)
    txStmt.run(4500, 5, 222222, new Date().toISOString());  // Кафе
    
    txStmt.run(150000, 8, 111111, new Date().toISOString()); // Зарплата (income)
    txStmt.finalize();

    // Insert dummy savings
    const saveStmt = db.prepare('INSERT INTO savings (user_id, name, currency, amount) VALUES (?, ?, ?, ?)');
    saveStmt.run(111111, 'Наличные', 'USD', 2500);
    saveStmt.run(222222, 'Вклад', 'RUB', 150000);
    saveStmt.finalize();

    console.log("Mock data injected!");
});
