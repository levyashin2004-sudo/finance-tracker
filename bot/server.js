const express = require('express');
const cors = require('cors');
const db = require('./db.js');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json());

const path = require('path');
app.use(express.static(path.join(__dirname, '../webapp/dist')));

// Fallback for SPA routing
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/dist/index.html'));
});

// =======================
// CRON JOBS
// =======================
cron.schedule('0 9 * * *', () => {
    const todayNum = new Date().getDate();
    db.all('SELECT * FROM recurring_payments WHERE day_of_month = ?', [todayNum], (err, rows) => {
        if (err) return;
        rows.forEach(payment => {
            const stmt = db.prepare('INSERT INTO transactions (amount, category_id, user_id, description, date) VALUES (?, ?, ?, ?, ?)');
            stmt.run(payment.amount, payment.category_id, payment.user_id, `Авто: ${payment.name}`, new Date().toISOString());
            stmt.finalize();
        });
    });
});

// =======================
// TRANSACTIONS & SMART ALLOCATION
// =======================
app.get('/api/transactions', (req, res) => {
    const query = `
        SELECT t.id, t.amount, t.date, t.description, c.name as category_name, c.icon as category_icon, 
               c.type as category_type, c.is_mandatory, u.first_name as user_name
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        LEFT JOIN users u ON t.user_id = u.telegram_id
        ORDER BY t.date DESC
    `;
    db.all(query, [], (err, rows) => res.json(rows || []));
});

app.post('/api/transactions', (req, res) => {
    const { amount, category_id, user_id, description, date, wallet_id } = req.body;
    const txDate = date ? new Date(date).toISOString() : new Date().toISOString();
    
    db.run('INSERT INTO transactions (amount, category_id, user_id, description, date) VALUES (?, ?, ?, ?, ?)', 
        [amount, category_id, user_id, description, txDate], function(err) {
        if (err) return res.status(500).json({error: err.message});
        
        if (wallet_id) {
            db.get(`SELECT type FROM categories WHERE id = ?`, [category_id], (err, cat) => {
                if (cat) {
                    if (cat.type === 'income') {
                        // SMART PERCENTAGE ALLOCATION LOGIC
                        db.all('SELECT * FROM allocation_rules', [], (err, rules) => {
                            if (!err && rules && rules.length > 0) {
                                let totalDeducted = 0;
                                rules.forEach(rule => {
                                    const sliceAmount = amount * (rule.percentage / 100);
                                    totalDeducted += sliceAmount;
                                    db.run(`UPDATE goals SET amount_saved = amount_saved + ? WHERE id = ?`, [sliceAmount, rule.target_goal_id]);
                                });
                                // Remaining goes to Wallet
                                const remainder = amount - totalDeducted;
                                db.run(`UPDATE wallets SET amount = amount + ? WHERE id = ?`, [remainder, wallet_id]);
                            } else {
                                // No rules, full amount goes to Wallet
                                db.run(`UPDATE wallets SET amount = amount + ? WHERE id = ?`, [amount, wallet_id]);
                            }
                        });
                    } else {
                        // Expense, subtract from memory
                        db.run(`UPDATE wallets SET amount = amount - ? WHERE id = ?`, [amount, wallet_id]);
                    }
                }
            });
        }
        res.json({ id: this.lastID, success: true });
    });
});

app.delete('/api/transactions/:id', (req, res) => {
    db.run('DELETE FROM transactions WHERE id = ?', [req.params.id], () => res.json({ success: true }));
});

// =======================
// GOALS & WISHLISTS
// =======================
app.get('/api/goals', (req, res) => {
    db.all('SELECT * FROM goals', [], (err, rows) => res.json(rows || []));
});
app.post('/api/goals', (req, res) => {
    const { name, icon, type, target_amount } = req.body;
    db.run('INSERT INTO goals (name, icon, type, amount_saved, target_amount) VALUES (?, ?, ?, 0, ?)', 
        [name, icon, type, target_amount], function() { res.json({ id: this.lastID, success: true }); });
});
app.put('/api/goals/:id', (req, res) => {
    // Allows manual adjustments to amount_saved
    const { amount_saved } = req.body;
    db.run('UPDATE goals SET amount_saved = ? WHERE id = ?', [amount_saved, req.params.id], () => res.json({ success: true }));
});
app.delete('/api/goals/:id', (req, res) => {
    db.run('DELETE FROM goals WHERE id = ?', [req.params.id], () => res.json({ success: true }));
});

// =======================
// ALLOCATION RULES
// =======================
app.get('/api/allocation_rules', (req, res) => {
    db.all('SELECT * FROM allocation_rules', [], (err, rows) => res.json(rows || []));
});
app.post('/api/allocation_rules', (req, res) => {
    const { target_goal_id, percentage } = req.body;
    db.run('INSERT INTO allocation_rules (target_goal_id, percentage) VALUES (?, ?)', 
        [target_goal_id, percentage], function() { res.json({ id: this.lastID, success: true }); });
});
app.delete('/api/allocation_rules/:id', (req, res) => {
    db.run('DELETE FROM allocation_rules WHERE id = ?', [req.params.id], () => res.json({ success: true }));
});


// =======================
// OTHER CRUD ENDPOINTS
// =======================
app.get('/api/categories', (req, res) => db.all('SELECT * FROM categories', [], (err, rows) => res.json(rows||[])));
app.post('/api/categories', (req, res) => db.run('INSERT INTO categories (name, type, icon, is_mandatory, planned_amount) VALUES (?, ?, ?, ?, ?)', [req.body.name, req.body.type, req.body.icon, req.body.is_mandatory, req.body.planned_amount || 0], function() { res.json({ id: this.lastID, success: true }); }));
app.delete('/api/categories/:id', (req, res) => db.run('DELETE FROM categories WHERE id = ?', [req.params.id], () => res.json({ success: true })));

app.get('/api/wallets', (req, res) => db.all('SELECT * FROM wallets', [], (err, rows) => res.json(rows||[])));
app.post('/api/wallets', (req, res) => db.run('INSERT INTO wallets (name, icon, amount) VALUES (?, ?, ?)', [req.body.name, req.body.icon, req.body.amount], function() { res.json({ id: this.lastID, success: true })}));
app.put('/api/wallets/:id', (req, res) => db.run('UPDATE wallets SET amount = ? WHERE id = ?', [req.body.amount, req.params.id], () => res.json({ success: true })));
app.delete('/api/wallets/:id', (req, res) => db.run('DELETE FROM wallets WHERE id = ?', [req.params.id], () => res.json({ success: true })));

app.get('/api/budgets', (req, res) => db.all('SELECT * FROM budgets', [], (err, rows) => res.json(rows||[])));
app.post('/api/budgets', (req, res) => db.run('INSERT INTO budgets (name, icon, type, planned_amount) VALUES (?, ?, ?, ?)', [req.body.name, req.body.icon, req.body.type, req.body.planned_amount], function() { res.json({ id: this.lastID, success: true })}));
app.put('/api/budgets/:id', (req, res) => db.run('UPDATE budgets SET planned_amount = ? WHERE id = ?', [req.body.planned_amount, req.params.id], () => res.json({ success: true })));
app.delete('/api/budgets/:id', (req, res) => db.run('DELETE FROM budgets WHERE id = ?', [req.params.id], () => res.json({ success: true })));

app.get('/api/savings', (req, res) => db.all('SELECT * FROM savings', [], (err, rows) => res.json(rows||[])));
app.get('/api/investments', (req, res) => db.all('SELECT * FROM investments', [], (err, rows) => res.json(rows||[])));
app.get('/api/debts', (req, res) => db.all('SELECT * FROM debts', [], (err, rows) => res.json(rows||[])));

app.put('/api/categories/:id', (req, res) => {
    const { name, planned_amount } = req.body;
    db.run('UPDATE categories SET name = ?, planned_amount = ? WHERE id = ?', [name, planned_amount, req.params.id], () => res.json({ success: true }));
});

app.get('/api/recurring', (req, res) => db.all('SELECT * FROM recurring_payments', [], (err, rows) => res.json(rows||[])));
app.post('/api/recurring', (req, res) => {
    const { name, amount, day_of_month, type } = req.body;
    db.run('INSERT INTO recurring_payments (name, amount, day_of_month, type) VALUES (?, ?, ?, ?)', [name, amount, day_of_month, type], function() { res.json({ id: this.lastID, success: true }); });
});
app.put('/api/recurring/:id', (req, res) => {
    const { name, amount, day_of_month } = req.body;
    db.run('UPDATE recurring_payments SET name = ?, amount = ?, day_of_month = ? WHERE id = ?', [name, amount, day_of_month, req.params.id], () => res.json({ success: true }));
});
app.delete('/api/recurring/:id', (req, res) => {
    db.run('DELETE FROM recurring_payments WHERE id = ?', [req.params.id], () => res.json({ success: true }));
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API Server with Smart Goals running on ${PORT}`);
    // Start Telegram Bot alongside the API Server
    try {
        require('./index.js');
    } catch (e) {
        console.error("Failed to start Telegram Bot:", e);
    }
});
