const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// Add Middleware
if (!code.includes('familyId = row')) {
    code = code.replace('app.use(express.json());', `app.use(express.json());

// Multi-tenant auth middleware
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        const tgId = req.headers['x-telegram-id'];
        if (!tgId) return res.status(401).json({error: 'No Telegram ID'});
        db.get('SELECT family_id FROM users WHERE telegram_id = ?', [tgId], (err, row) => {
            req.familyId = row ? row.family_id : tgId;
            next();
        });
    } else {
        next();
    }
});
`);
}

// Replace GET lists
code = code.replace(/db\.all\('SELECT \* FROM (\w+)', \[\]/g, "db.all('SELECT * FROM $1 WHERE family_id = ?', [req.familyId]");

// transactions GET
code = code.replace(/LEFT JOIN users u ON t\.user_id = u\.telegram_id\n\s*ORDER BY t\.date DESC/g, "LEFT JOIN users u ON t.user_id = u.telegram_id\n        WHERE t.family_id = ?\n        ORDER BY t.date DESC");
code = code.replace(/db\.all\(query, \[\], /g, "db.all(query, [req.familyId], ");

// UPDATE
code = code.replace(/db\.run\('UPDATE (.*?) WHERE id = \?'\s*,\s*\[(.*?)\]/g, "db.run('UPDATE $1 WHERE id = ? AND family_id = ?', [...[$2], req.familyId].flat()");

// DELETE
code = code.replace(/db\.run\('DELETE FROM (.*?) WHERE id = \?'\s*,\s*\[(.*?)\]/g, "db.run('DELETE FROM $1 WHERE id = ? AND family_id = ?', [...[$2], req.familyId].flat()");

// INSERT ... VALUES (?, ?, ?)
code = code.replace(/db\.run\('INSERT INTO (\w+) \((.*?)\) VALUES \((.*?)\)'\s*,\s*\[(.*?)\]/g, "db.run('INSERT INTO $1 ($2, family_id) VALUES ($3, ?)', [...[$4], req.familyId].flat()");

// Recurring logic in Cron
code = code.replace(/db\.prepare\('INSERT INTO transactions \((.*?)\) VALUES \((.*?)\)'\)/g, "db.prepare('INSERT INTO transactions ($1, family_id) VALUES ($2, ?)')");
code = code.replace(/stmt\.run\((.*?)\)/g, (match, p1) => {
    if (p1.includes('payment.amount')) {
        return `stmt.run(${p1}, payment.family_id)`; 
    }
    return match;
});

fs.writeFileSync('server.js', code);
