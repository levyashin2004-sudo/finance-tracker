const express = require('express');
const cors = require('cors');
const db = require('./db.js');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// Generate a 6-char invite code
function generateInviteCode() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Multi-tenant auth middleware
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        const tgId = req.headers['x-telegram-id'];
        if (!tgId) return res.status(401).json({error: 'No Telegram ID header provided'});
        
        db.get('SELECT family_id FROM users WHERE telegram_id = ?', [tgId], (err, row) => {
            if (row) {
                req.familyId = row.family_id;
                req.telegramId = parseInt(tgId);
                next();
            } else {
                // Auto-register dynamically — create a personal group
                const safeTgId = parseInt(tgId);
                req.telegramId = safeTgId;
                if (!isNaN(safeTgId) && safeTgId > 0) {
                    const code = generateInviteCode();
                    db.run('INSERT INTO families (name, invite_code, created_by) VALUES (?, ?, ?)', 
                        [`Группа ${safeTgId}`, code, safeTgId], function(err) {
                            const familyId = this.lastID || safeTgId;
                            req.familyId = familyId;
                            db.run('INSERT INTO users (telegram_id, first_name, username, family_id) VALUES (?, ?, ?, ?)', 
                                [safeTgId, 'AppUser', '', familyId], () => {
                                    db.seedFamily(familyId);
                                });
                            next();
                        });
                } else {
                    req.familyId = parseInt(tgId);
                    next();
                }
            }
        });
    } else {
        next();
    }
});

const path = require('path');

// Hashed assets (JS/CSS) can cache forever, but HTML must never cache
app.use(express.static(path.join(__dirname, '../webapp/dist'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// Fallback for SPA routing — also no-cache
app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, '../webapp/dist/index.html'));
});

// =======================
// CRON JOBS — handled in index.js (processRecurringPayments)
// =======================

// =======================
// GROUPS (FAMILIES) — New Group-centric API
// =======================

// Get current user's group info + members
app.get('/api/group', (req, res) => {
    db.get('SELECT f.* FROM families f JOIN users u ON u.family_id = f.id WHERE u.telegram_id = ?', [req.telegramId], (err, group) => {
        if (!group) {
            // Auto-create family record for legacy users who don't have one
            const code = generateInviteCode();
            db.run('INSERT INTO families (name, invite_code, created_by) VALUES (?, ?, ?)',
                ['Моя группа', code, req.telegramId], function(createErr) {
                    if (createErr) {
                        // If insert fails, return fallback
                        db.all('SELECT telegram_id, first_name, username FROM users WHERE family_id = ?', [req.familyId], (e, members) => {
                            return res.json({ id: req.familyId, name: 'Моя группа', invite_code: '—', members: members || [] });
                        });
                        return;
                    }
                    const newFamilyId = this.lastID;
                    // Update all users in this old family to point to the new families row
                    db.run('UPDATE users SET family_id = ? WHERE family_id = ?', [newFamilyId, req.familyId], () => {
                        db.all('SELECT telegram_id, first_name, username FROM users WHERE family_id = ?', [newFamilyId], (e, members) => {
                            res.json({ id: newFamilyId, name: 'Моя группа', invite_code: code, created_by: req.telegramId, members: members || [] });
                        });
                    });
                });
            return;
        }
        db.all('SELECT telegram_id, first_name, username FROM users WHERE family_id = ?', [group.id], (err, members) => {
            res.json({ ...group, members: members || [] });
        });
    });
});

// Create a new group (and move current user to it)
app.post('/api/group', (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Название группы обязательно' });
    const code = generateInviteCode();
    db.run('INSERT INTO families (name, invite_code, created_by) VALUES (?, ?, ?)', [name.trim(), code, req.telegramId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const newFamilyId = this.lastID;
        // Move the user to the new group
        db.run('UPDATE users SET family_id = ? WHERE telegram_id = ?', [newFamilyId, req.telegramId], () => {
            db.seedFamily(newFamilyId);
            res.json({ id: newFamilyId, name: name.trim(), invite_code: code, success: true });
        });
    });
});

// Update group name
app.put('/api/group', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    db.run('UPDATE families SET name = ? WHERE id = ?', [name.trim(), req.familyId], () => res.json({ success: true }));
});

// Search groups by name or invite code
app.get('/api/groups/search', (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) return res.json([]);
    // Search by name (partial) or exact invite code
    db.all(`SELECT f.id, f.name, f.invite_code, 
            (SELECT COUNT(*) FROM users WHERE family_id = f.id) as member_count
            FROM families f 
            WHERE LOWER(f.name) LIKE LOWER(?) OR UPPER(f.invite_code) = UPPER(?)
            LIMIT 20`, 
        [`%${q}%`, q], (err, rows) => {
            res.json(rows || []);
        });
});

// Join a group by invite code
app.post('/api/group/join', (req, res) => {
    const { invite_code } = req.body;
    if (!invite_code) return res.status(400).json({ error: 'Нужен код приглашения' });
    
    const code = invite_code.trim().toUpperCase();
    db.get('SELECT id, name FROM families WHERE UPPER(invite_code) = ?', [code], (err, group) => {
        if (!group) return res.status(404).json({ error: 'Группа не найдена. Проверьте код.' });
        db.run('UPDATE users SET family_id = ? WHERE telegram_id = ?', [group.id, req.telegramId], () => {
            res.json({ success: true, family_id: group.id, group_name: group.name });
        });
    });
});

// Leave group (create a new personal group)
app.post('/api/group/leave', (req, res) => {
    const code = generateInviteCode();
    db.run('INSERT INTO families (name, invite_code, created_by) VALUES (?, ?, ?)', 
        ['Личная группа', code, req.telegramId], function(err) {
            const newId = this.lastID;
            db.run('UPDATE users SET family_id = ? WHERE telegram_id = ?', [newId, req.telegramId], () => {
                db.seedFamily(newId);
                res.json({ success: true, new_family_id: newId });
            });
        });
});

// Remove a member from the group (admin-only: creator)
app.post('/api/group/kick', (req, res) => {
    const { member_id } = req.body;
    if (parseInt(member_id) === req.telegramId) return res.status(400).json({ error: 'Нельзя удалить себя' });
    // Only group creator can kick
    db.get('SELECT created_by FROM families WHERE id = ?', [req.familyId], (err, group) => {
        if (!group || group.created_by !== req.telegramId) {
            return res.status(403).json({ error: 'Только создатель группы может удалять участников' });
        }
        const code = generateInviteCode();
        db.run('INSERT INTO families (name, invite_code, created_by) VALUES (?, ?, ?)', 
            ['Личная группа', code, member_id], function() {
                db.run('UPDATE users SET family_id = ? WHERE telegram_id = ?', [this.lastID, member_id], () => {
                    res.json({ success: true });
                });
            });
    });
});

// Legacy join endpoint (keep for backward-compat)
app.post('/api/family/join', (req, res) => {
    let { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ success: false, error: 'No invite code' });
    
    const telegramId = req.headers['x-telegram-id'];
    if (!telegramId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    inviteCode = inviteCode.trim().replace(/^@/, '');

    const applyJoin = (targetFamilyId) => {
        db.run('UPDATE users SET family_id = ? WHERE telegram_id = ?', [targetFamilyId, telegramId], () => {
            res.json({ success: true, family_id: targetFamilyId });
        });
    };

    // Try invite code first
    db.get('SELECT id FROM families WHERE UPPER(invite_code) = UPPER(?)', [inviteCode], (err, fam) => {
        if (fam) return applyJoin(fam.id);
        
        // Extract digits — if input contains numbers, use them as family_id directly
        const digits = inviteCode.replace(/\D/g, '');
        if (digits.length >= 5) {
            return applyJoin(parseInt(digits));
        }

        // Otherwise try username lookup in our DB
        db.get('SELECT family_id FROM users WHERE LOWER(username) = LOWER(?)', [inviteCode], (err, row) => {
            if (err || !row) {
                return res.status(404).json({ success: false, error: 'Не найден. Убедитесь, что человек хотя бы раз открывал бота.' });
            }
            applyJoin(row.family_id);
        });
    });
});

// =======================
// TRANSACTIONS & SMART ALLOCATION
// =======================
app.get('/api/transactions', (req, res) => {
    const query = `
        SELECT t.id, t.amount, t.date, t.description, t.wallet_id, c.name as category_name, c.icon as category_icon, 
               c.type as category_type, c.is_mandatory, u.first_name as user_name, w.name as wallet_name
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        LEFT JOIN users u ON t.user_id = u.telegram_id
        LEFT JOIN wallets w ON t.wallet_id = w.id
        WHERE t.family_id = ?
        ORDER BY t.date DESC
    `;
    db.all(query, [req.familyId], (err, rows) => res.json(rows || []));
});

app.post('/api/transactions', (req, res) => {
    const { amount, category_id, user_id, description, date, wallet_id } = req.body;
    const txDate = date ? new Date(date).toISOString() : new Date().toISOString();
    
    db.run('INSERT INTO transactions (amount, category_id, user_id, description, date, family_id, wallet_id) VALUES (?, ?, ?, ?, ?, ?, ?)', 
        [amount, category_id, user_id, description, txDate, req.familyId, wallet_id || null], function(err) {
        if (err) return res.status(500).json({error: err.message});
        
        if (wallet_id) {
            db.get(`SELECT type FROM categories WHERE id = ?`, [category_id], (err, cat) => {
                if (cat) {
                    if (cat.type === 'income') {
                        // SMART PERCENTAGE ALLOCATION LOGIC
                        db.all('SELECT * FROM allocation_rules a JOIN goals g ON a.target_goal_id = g.id WHERE g.family_id = ?', [req.familyId], (err, rules) => {
                            if (!err && rules && rules.length > 0) {
                                let totalDeducted = 0;
                                rules.forEach(rule => {
                                    const sliceAmount = amount * (rule.percentage / 100);
                                    totalDeducted += sliceAmount;
                                    db.run(`UPDATE goals SET amount_saved = amount_saved + ? WHERE id = ? AND family_id = ?`, [sliceAmount, rule.target_goal_id, req.familyId]);
                                });
                                // Remaining goes to Wallet
                                const remainder = amount - totalDeducted;
                                db.run(`UPDATE wallets SET amount = amount + ? WHERE id = ? AND family_id = ?`, [remainder, wallet_id, req.familyId]);
                            } else {
                                // No rules, full amount goes to Wallet
                                db.run(`UPDATE wallets SET amount = amount + ? WHERE id = ? AND family_id = ?`, [amount, wallet_id, req.familyId]);
                            }
                        });
                    } else {
                        // Expense, subtract from memory
                        db.run(`UPDATE wallets SET amount = amount - ? WHERE id = ? AND family_id = ?`, [amount, wallet_id, req.familyId]);
                    }
                }
            });
        }
        res.json({ id: this.lastID, success: true });
    });
});

app.delete('/api/transactions/:id', (req, res) => {
    // REVERSAL LOGIC: Restore money to the wallet when a transaction is deleted!
    db.get('SELECT t.amount, t.wallet_id, c.type FROM transactions t JOIN categories c ON t.category_id = c.id WHERE t.id = ? AND t.family_id = ?', [req.params.id, req.familyId], (err, tx) => {
        if (!err && tx && tx.wallet_id) {
            const modifier = tx.type === 'expense' ? '+' : '-'; // Inverse of creation
            db.run(`UPDATE wallets SET amount = amount ${modifier} ? WHERE id = ? AND family_id = ?`, [tx.amount, tx.wallet_id, req.familyId]);
        }
        db.run('DELETE FROM transactions WHERE id = ? AND family_id = ?', [req.params.id, req.familyId], () => res.json({ success: true }));
    });
});

// =======================
// GOALS & WISHLISTS
// =======================
app.get('/api/goals', (req, res) => {
    db.all('SELECT * FROM goals WHERE family_id = ?', [req.familyId], (err, rows) => res.json(rows || []));
});
app.post('/api/goals', (req, res) => {
    const { name, icon, type, target_amount } = req.body;
    db.run('INSERT INTO goals (name, icon, type, amount_saved, target_amount, family_id) VALUES (?, ?, ?, 0, ?, ?)', 
        [name, icon, type, target_amount, req.familyId], function() { res.json({ id: this.lastID, success: true }); });
});
app.put('/api/goals/:id', (req, res) => {
    const { amount_saved } = req.body;
    db.run('UPDATE goals SET amount_saved = ? WHERE id = ? AND family_id = ?', [amount_saved, req.params.id, req.familyId], () => res.json({ success: true }));
});
app.delete('/api/goals/:id', (req, res) => {
    db.run('DELETE FROM goals WHERE id = ? AND family_id = ?', [req.params.id, req.familyId], () => res.json({ success: true }));
});

// =======================
// ALLOCATION RULES
// =======================
app.get('/api/allocation_rules', (req, res) => {
    // Allocation rules do not have family_id natively but target goals which have family_id
    db.all('SELECT a.* FROM allocation_rules a JOIN goals g ON a.target_goal_id = g.id WHERE g.family_id = ?', [req.familyId], (err, rows) => res.json(rows || []));
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

app.get('/api/family', (req, res) => {
    db.all('SELECT first_name, username, telegram_id, family_id FROM users WHERE family_id = ?', [req.familyId], (err, rows) => {
        res.json(rows || []);
    });
});

// Auto-seed helper logic for empty families
const autoSeedIfEmpty = (familyId, cb) => {
    db.all('SELECT count(*) as count FROM categories WHERE family_id = ?', [familyId], (err, rows) => {
        if (!err && rows && rows[0] && rows[0].count == 0) {
            db.seedFamily(familyId, cb);
        } else {
            cb();
        }
    });
};

app.get('/api/categories', (req, res) => {
    autoSeedIfEmpty(req.familyId, () => {
        db.all('SELECT * FROM categories WHERE family_id = ?', [req.familyId], (err, rows) => res.json(rows||[]));
    });
});
app.post('/api/categories', (req, res) => db.run('INSERT INTO categories (name, type, icon, is_mandatory, planned_amount, family_id) VALUES (?, ?, ?, ?, ?, ?)', [req.body.name, req.body.type, req.body.icon, req.body.is_mandatory, req.body.planned_amount || 0, req.familyId], function() { res.json({ id: this.lastID, success: true }); }));
app.delete('/api/categories/:id', (req, res) => db.run('DELETE FROM categories WHERE id = ? AND family_id = ?', [req.params.id, req.familyId], () => res.json({ success: true })));
app.put('/api/categories/:id', (req, res) => {
    const { name, planned_amount } = req.body;
    db.run('UPDATE categories SET name = ?, planned_amount = ? WHERE id = ? AND family_id = ?', [name, planned_amount, req.params.id, req.familyId], () => res.json({ success: true }));
});

app.get('/api/wallets', (req, res) => {
    autoSeedIfEmpty(req.familyId, () => {
        db.all('SELECT * FROM wallets WHERE family_id = ?', [req.familyId], (err, rows) => res.json(rows||[]));
    });
});
app.post('/api/wallets', (req, res) => db.run('INSERT INTO wallets (name, icon, amount, family_id) VALUES (?, ?, ?, ?)', [req.body.name, req.body.icon, req.body.amount, req.familyId], function() { res.json({ id: this.lastID, success: true })}));
app.put('/api/wallets/:id', (req, res) => db.run('UPDATE wallets SET amount = ? WHERE id = ? AND family_id = ?', [req.body.amount, req.params.id, req.familyId], () => res.json({ success: true })));
app.delete('/api/wallets/:id', (req, res) => db.run('DELETE FROM wallets WHERE id = ? AND family_id = ?', [req.params.id, req.familyId], () => res.json({ success: true })));

app.get('/api/budgets', (req, res) => db.all('SELECT * FROM budgets WHERE family_id = ?', [req.familyId], (err, rows) => res.json(rows||[])));
app.post('/api/budgets', (req, res) => db.run('INSERT INTO budgets (name, icon, type, planned_amount, family_id) VALUES (?, ?, ?, ?, ?)', [req.body.name, req.body.icon, req.body.type, req.body.planned_amount, req.familyId], function() { res.json({ id: this.lastID, success: true })}));
app.put('/api/budgets/:id', (req, res) => db.run('UPDATE budgets SET planned_amount = ? WHERE id = ? AND family_id = ?', [req.body.planned_amount, req.params.id, req.familyId], () => res.json({ success: true })));
app.delete('/api/budgets/:id', (req, res) => db.run('DELETE FROM budgets WHERE id = ? AND family_id = ?', [req.params.id, req.familyId], () => res.json({ success: true })));

app.get('/api/savings', (req, res) => db.all('SELECT * FROM savings WHERE family_id = ?', [req.familyId], (err, rows) => res.json(rows||[])));
app.post('/api/savings', (req, res) => db.run('INSERT INTO savings (name, currency, amount, family_id) VALUES (?, ?, ?, ?)', [req.body.name, req.body.currency, req.body.amount, req.familyId], function() { res.json({ id: this.lastID, success: true }); }));
app.delete('/api/savings/:id', (req, res) => db.run('DELETE FROM savings WHERE id = ? AND family_id = ?', [req.params.id, req.familyId], () => res.json({ success: true })));

app.get('/api/investments', (req, res) => db.all('SELECT * FROM investments WHERE family_id = ?', [req.familyId], (err, rows) => res.json(rows||[])));
app.post('/api/investments', (req, res) => db.run('INSERT INTO investments (name, icon, amount, family_id) VALUES (?, ?, ?, ?)', [req.body.name, req.body.icon, req.body.amount, req.familyId], function() { res.json({ id: this.lastID, success: true }); }));
app.delete('/api/investments/:id', (req, res) => db.run('DELETE FROM investments WHERE id = ? AND family_id = ?', [req.params.id, req.familyId], () => res.json({ success: true })));

app.get('/api/debts', (req, res) => db.all('SELECT * FROM debts WHERE family_id = ?', [req.familyId], (err, rows) => res.json(rows||[])));
app.post('/api/debts', (req, res) => db.run('INSERT INTO debts (name, amount, family_id) VALUES (?, ?, ?)', [req.body.name, req.body.amount, req.familyId], function() { res.json({ id: this.lastID, success: true }); }));
app.delete('/api/debts/:id', (req, res) => db.run('DELETE FROM debts WHERE id = ? AND family_id = ?', [req.params.id, req.familyId], () => res.json({ success: true })));

// Global Currency endpoint
app.get('/api/currency', async (req, res) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch('https://www.cbr-xml-daily.ru/daily_json.js', { signal: controller.signal });
        clearTimeout(timeoutId);
        const data = await response.json();
        res.json({ 
            usdRate: data.Valute.USD.Value,
            eurRate: data.Valute.EUR.Value 
        });
    } catch (e) {
        res.json({ usdRate: 76.05, eurRate: 85.00 }); // Fallback actual rate
    }
});


app.get('/api/recurring', (req, res) => db.all('SELECT * FROM recurring_payments WHERE family_id = ?', [req.familyId], (err, rows) => res.json(rows||[])));
app.post('/api/recurring', (req, res) => {
    const { name, amount, day_of_month, type, category_id, wallet_id, user_id } = req.body;
    const tgId = req.headers['x-telegram-id'];
    const finalUserId = user_id || parseInt(tgId) || null;
    db.run('INSERT INTO recurring_payments (name, amount, day_of_month, type, category_id, wallet_id, user_id, family_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
        [name, amount, day_of_month, type, category_id || null, wallet_id || null, finalUserId, req.familyId], 
        function() { res.json({ id: this.lastID, success: true }); });
});
app.put('/api/recurring/:id', (req, res) => {
    const { name, amount, day_of_month } = req.body;
    db.run('UPDATE recurring_payments SET name = ?, amount = ?, day_of_month = ? WHERE id = ? AND family_id = ?', [name, amount, day_of_month, req.params.id, req.familyId], () => res.json({ success: true }));
});
app.delete('/api/recurring/:id', (req, res) => {
    db.run('DELETE FROM recurring_payments WHERE id = ? AND family_id = ?', [req.params.id, req.familyId], () => res.json({ success: true }));
});

// =======================
// TRANSFERS (WALLET TO WALLET)
// =======================
app.get('/api/transfers', (req, res) => {
    const query = `
        SELECT t.*, w1.name as from_wallet_name, w2.name as to_wallet_name
        FROM transfers t
        JOIN wallets w1 ON t.from_wallet_id = w1.id
        JOIN wallets w2 ON t.to_wallet_id = w2.id
        WHERE t.family_id = ?
        ORDER BY t.date DESC
    `;
    db.all(query, [req.familyId], (err, rows) => res.json(rows||[]));
});
app.post('/api/transfers', (req, res) => {
    const { amount, from_wallet_id, to_wallet_id } = req.body;
    db.run('INSERT INTO transfers (amount, from_wallet_id, to_wallet_id, family_id) VALUES (?, ?, ?, ?)', 
        [amount, from_wallet_id, to_wallet_id, req.familyId], function(err) {
        if (!err) {
            db.run(`UPDATE wallets SET amount = amount - ? WHERE id = ? AND family_id = ?`, [amount, from_wallet_id, req.familyId]);
            db.run(`UPDATE wallets SET amount = amount + ? WHERE id = ? AND family_id = ?`, [amount, to_wallet_id, req.familyId]);
        }
        res.json({ id: this.lastID, success: true });
    });
});
app.delete('/api/transfers/:id', (req, res) => {
    db.get('SELECT * FROM transfers WHERE id = ? AND family_id = ?', [req.params.id, req.familyId], (err, row) => {
        if (!err && row) {
            // Reversal logic
            db.run(`UPDATE wallets SET amount = amount + ? WHERE id = ? AND family_id = ?`, [row.amount, row.from_wallet_id, req.familyId]);
            db.run(`UPDATE wallets SET amount = amount - ? WHERE id = ? AND family_id = ?`, [row.amount, row.to_wallet_id, req.familyId]);
            db.run('DELETE FROM transfers WHERE id = ? AND family_id = ?', [req.params.id, req.familyId], () => res.json({ success: true }));
        } else {
            res.status(404).json({error: "Transfer not found"});
        }
    });
});

// =======================
// CSV EXPORT
// =======================
app.get('/api/export/csv', (req, res) => {
    const query = `
        SELECT t.amount, t.date, t.description, c.name as category, c.type, 
               u.first_name as user, w.name as wallet
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        LEFT JOIN users u ON t.user_id = u.telegram_id
        LEFT JOIN wallets w ON t.wallet_id = w.id
        WHERE t.family_id = ?
        ORDER BY t.date DESC
    `;
    db.all(query, [req.familyId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const header = 'Дата,Тип,Категория,Сумма,Кошелёк,Кто,Описание\n';
        const csv = (rows || []).map(r => {
            const date = new Date(r.date).toLocaleDateString('ru-RU');
            const type = r.type === 'income' ? 'Доход' : 'Расход';
            const desc = (r.description || '').replace(/,/g, ';');
            return `${date},${type},${r.category},${r.amount},${r.wallet || ''},${r.user || ''},${desc}`;
        }).join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
        res.send('\uFEFF' + header + csv); // BOM for Excel UTF-8
    });
});

// =======================
// GLOBAL SYSTEM ERROR HANDLER
// =======================
app.use((err, req, res, next) => {
    console.error('[API CRITICAL ERROR]', err.stack || err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
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
