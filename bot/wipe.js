const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.resolve(__dirname, 'finance.db'));

db.serialize(() => {
    // Очищаем финансовые данные
    db.run("DELETE FROM transactions");
    db.run("DELETE FROM savings");
    db.run("DELETE FROM investments");
    db.run("DELETE FROM debts");
    db.run("DELETE FROM goals");
    db.run("DELETE FROM allocation_rules");
    db.run("DELETE FROM wallets");
    
    // Сбрасываем счетчики ID
    db.run("DELETE FROM sqlite_sequence WHERE name IN ('transactions', 'savings', 'investments', 'debts', 'goals', 'allocation_rules', 'wallets')");
});
console.log("База данных успешно очищена для старта. Сохранены только Настройки (Категории, Зарплаты, Аренда).");
