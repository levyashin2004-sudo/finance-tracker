require('dotenv').config();
const { Telegraf, Markup, session, Scenes } = require('telegraf');
const db = require('./db.js');

let token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
token = token.replace(/[\'\"\s]/g, ''); // Strip accidental quotes and spaces from Render ENV!
const bot = new Telegraf(token);

// Enable session tracking for multi-step scenarios
bot.use(session());

const EXPENSE_WIZARD = 'EXPENSE_WIZARD';
const expenseWizard = new Scenes.WizardScene(
    EXPENSE_WIZARD,
    (ctx) => {
        ctx.reply('Введите сумму расхода (например, 500):');
        return ctx.wizard.next();
    },
    (ctx) => {
        const amount = parseInt(ctx.message.text);
        if (isNaN(amount) || amount <= 0) {
            ctx.reply('Пожалуйста, введите корректное число больше нуля.');
            return;
        }
        ctx.wizard.state.amount = amount;
        
        // Fetch categories dynamically
        db.get('SELECT family_id FROM users WHERE telegram_id = ?', [ctx.from.id], (err, row) => {
            const familyId = row ? row.family_id : ctx.from.id;
            ctx.wizard.state.familyId = familyId;
            
            db.all('SELECT * FROM categories WHERE type = "expense" AND family_id = ?', [familyId], (err, rows) => {
                if (err || !rows) return console.error(err);
                if (rows.length === 0) {
                    ctx.reply('У вас пока нет категорий расходов. Добавьте их через Дашборд!');
                    return ctx.scene.leave();
                }
                const buttons = rows.map(r => Markup.button.callback(`${r.icon} ${r.name}`, `cat_${r.id}`));
                const keyboard = [];
                for(let i=0; i<buttons.length; i+=2) {
                    keyboard.push(buttons.slice(i, i+2));
                }
                ctx.reply(`Сумма: ${amount} ₽\nВыберите категорию:`, Markup.inlineKeyboard(keyboard));
            });
        });
        return ctx.wizard.next();
    },
    (ctx) => {
        if (ctx.callbackQuery) {
            const action = ctx.callbackQuery.data;
            if (action.startsWith('cat_')) {
                const catId = action.split('_')[1];
                const amount = ctx.wizard.state.amount;
                const userId = ctx.from.id;
                const familyId = ctx.wizard.state.familyId;
                
                db.run('INSERT INTO transactions (amount, category_id, user_id, family_id) VALUES (?, ?, ?, ?)', [amount, catId, userId, familyId], function(err) {
                    if (err) return console.error(err);
                    ctx.reply('✅ Трата успешно сохранена!');
                    ctx.answerCbQuery();
                    ctx.scene.leave();
                });
            }
        }
    }
);

const stage = new Scenes.Stage([expenseWizard]);
bot.use(stage.middleware());

bot.start((ctx) => {
    const text = (ctx.message && ctx.message.text) || '';
    const payload = text.split(' ')[1]; // "/start join_123"
    let familyId = ctx.from.id; // Default to isolated personal budget
    
    if (payload && payload.startsWith('join_')) {
        const parsed = parseInt(payload.split('_')[1]);
        if (!isNaN(parsed)) familyId = parsed;
    }

    // Register user and handle family scoping
    db.get('SELECT * FROM users WHERE telegram_id = ?', [ctx.from.id], (err, row) => {
        if (!row) {
            db.run(
                'INSERT INTO users (telegram_id, first_name, username, family_id) VALUES (?, ?, ?, ?)', 
                [ctx.from.id, ctx.from.first_name, ctx.from.username, familyId],
                () => {
                    if (familyId === ctx.from.id) {
                        // Seed defaults ONLY for a brand new isolated family
                        db.seedFamily(familyId);
                    } else {
                        ctx.reply('👨‍👩‍👧 Вы успешно присоединились к семейному бюджету!');
                    }
                }
            );
        } else if (payload && payload.startsWith('join_')) {
             // Move existing user to new family
             db.run('UPDATE users SET family_id = ? WHERE telegram_id = ?', [familyId, ctx.from.id], () => {
                 ctx.reply('👨‍👩‍👧 Вы переключились на новый семейный бюджет!');
             });
        }
    });

    ctx.reply('Привет! Я ваш изолированный финансовый трекер. Что вам нужно?', Markup.keyboard([
        ['📉 Добавить расход', '📈 Добавить доход'],
        ['📊 Дашборд', '🔗 Пригласить в семью']
    ]).resize());
});

bot.hears('🔗 Пригласить в семью', (ctx) => {
    db.get('SELECT family_id FROM users WHERE telegram_id = ?', [ctx.from.id], (err, row) => {
        const fId = row ? row.family_id : ctx.from.id;
        const link = `https://t.me/${ctx.botInfo.username}?start=join_${fId}`;
        ctx.reply(`Отправьте эту ссылку членам семьи, чтобы у вас был **ОБЩИЙ** бюджет:\n\n${link}\n\n*Друзья, зашедшие просто по названию бота (без ссылки), получат отдельный пустой бюджет.*`, {parse_mode: 'Markdown'});
    });
});

bot.hears('📉 Добавить расход', (ctx) => {
    ctx.scene.enter(EXPENSE_WIZARD);
});

const localtunnel = require('localtunnel');
let dynamicWebAppUrl = process.env.WEBAPP_URL || 'https://google.com';

if (process.env.RENDER_EXTERNAL_URL) {
    // ☁️ We are running in the cloud (Render.com)
    dynamicWebAppUrl = process.env.RENDER_EXTERNAL_URL;
    console.log(`[INFO] Operating in Cloud Mode! Web App URL: ${dynamicWebAppUrl}`);
} else {
    // 💻 We are running locally on the PC
    (async () => {
        try {
            const tunnel = await localtunnel({ port: 5173 });
            dynamicWebAppUrl = tunnel.url;
            console.log(`[INFO] Telegram Web App HTTPS URL secured: ${dynamicWebAppUrl}`);
            
            tunnel.on('close', () => {
                console.log('[INFO] Tunnel closed');
            });
        } catch (err) {
            console.error('[ERROR] Localtunnel failed:', err);
        }
    })();
}

// We need a webapp url for our Mini App dashboard
bot.hears('📊 Дашборд', (ctx) => {
    ctx.reply('Ваша финансовая аналитика:', Markup.inlineKeyboard([
        Markup.button.webApp('Открыть Дашборд', dynamicWebAppUrl)
    ]));
});

const startBot = async () => {
    try {
        await bot.launch();
        console.log('[INFO] Telegram Bot is successfully running...');
    } catch (err) {
        console.error('[ERROR] Failed to start Telegram Bot. Retrying in 10s...', err.message);
        setTimeout(startBot, 10000);
    }
};

startBot();

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
