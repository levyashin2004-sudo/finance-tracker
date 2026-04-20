require('dotenv').config();
const { Telegraf, Markup, session, Scenes } = require('telegraf');
const db = require('./db.js');

let token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
token = token.replace(/[\'\"\s]/g, ''); // Strip accidental quotes and spaces from Render ENV!
const bot = new Telegraf(token);

// Enable session tracking for multi-step scenarios
bot.use(session());

const fetch = require('node-fetch'); // we'll use global fetch if available, but let's assume global fetch exists in Node 22

const getRates = async () => {
    try {
        const r = await fetch('https://www.cbr-xml-daily.ru/daily_json.js');
        const data = await r.json();
        return { USD: data.Valute.USD.Value, EUR: data.Valute.EUR.Value, RUB: 1 };
    } catch(e) {
        return { USD: 76.05, EUR: 85.00, RUB: 1 };
    }
};

const cancelHandler = (ctx) => {
    if (ctx.message && ctx.message.text && /(Дашборд|Добавить расход|Добавить доход|Пригласить в семью)/i.test(ctx.message.text)) {
        ctx.scene.leave();
        return true; 
    }
    return false;
};

const createTransactionWizard = (sceneId, typeName) => {
    return new Scenes.WizardScene(
        sceneId,
        async (ctx) => {
            if (cancelHandler(ctx)) return;
            // Fetch categories dynamically
            db.get('SELECT family_id FROM users WHERE telegram_id = ?', [ctx.from.id], (err, row) => {
                const familyId = row ? row.family_id : ctx.from.id;
                ctx.wizard.state.familyId = familyId;
                
                db.all(`SELECT * FROM categories WHERE type = ? AND family_id = ?`, [typeName, familyId], (err, rows) => {
                    if (err || !rows) return console.error(err);
                    if (rows.length === 0) {
                        ctx.reply(`У вас пока нет категорий типа "${typeName}". Добавьте их через Дашборд!`);
                        return ctx.scene.leave();
                    }
                    const buttons = rows.map(r => Markup.button.callback(`${r.icon} ${r.name}`, `cat_${r.id}`));
                    const keyboard = [];
                    for(let i=0; i<buttons.length; i+=2) {
                        keyboard.push(buttons.slice(i, i+2));
                    }
                    ctx.reply(`Выберите категорию:`, Markup.inlineKeyboard(keyboard));
                });
            });
            return ctx.wizard.next();
        },
        async (ctx) => {
            if (ctx.callbackQuery) {
                const action = ctx.callbackQuery.data;
                if (action.startsWith('cat_')) {
                    ctx.wizard.state.catId = action.split('_')[1];
                    ctx.reply('Введите сумму и валюту (например: 500, 10 USD, 15 EUR):');
                    ctx.answerCbQuery();
                    return ctx.wizard.next();
                }
            } else if (cancelHandler(ctx)) return;
            else {
                ctx.reply('Пожалуйста, выберите категорию из кнопок выше.');
            }
        },
        async (ctx) => {
            if (cancelHandler(ctx)) return;
            const text = (ctx.message.text || '').trim().toUpperCase();
            // Parse amount and currency
            const match = text.match(/^([\d.,]+)\s*(USD|EUR|RUB)?$/);
            if (!match) {
                ctx.reply('Неверный формат. Пожалуйста, введите сумму и валюту (например: 500, 10 USD):');
                return;
            }
            let amount = parseFloat(match[1].replace(',', '.'));
            let currency = match[2] || 'RUB';

            if (isNaN(amount) || amount <= 0) {
                ctx.reply('Пожалуйста, введите корректное число больше нуля.');
                return;
            }

            const rates = await getRates();
            let finalRub = amount;
            if (currency === 'USD') finalRub = amount * rates.USD;
            if (currency === 'EUR') finalRub = amount * rates.EUR;

            const catId = ctx.wizard.state.catId;
            const userId = ctx.from.id;
            const familyId = ctx.wizard.state.familyId;
            
            db.run('INSERT INTO transactions (amount, category_id, user_id, family_id) VALUES (?, ?, ?, ?)', [finalRub, catId, userId, familyId], function(err) {
                if (err) return console.error(err);
                ctx.reply(`✅ Сохранено! Итого: ${finalRub.toLocaleString('ru-RU', {maximumFractionDigits:0})} ₽`);
                ctx.scene.leave();
            });
        }
    );
};

const expenseWizard = createTransactionWizard('EXPENSE_WIZARD', 'expense');
const incomeWizard = createTransactionWizard('INCOME_WIZARD', 'income');

const stage = new Scenes.Stage([expenseWizard, incomeWizard]);
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

bot.hears(/Пригласить в семью/i, (ctx) => {
    db.get('SELECT family_id FROM users WHERE telegram_id = ?', [ctx.from.id], (err, row) => {
        const fId = row ? row.family_id : ctx.from.id;
        const link = `https://t.me/${ctx.botInfo.username}?start=join_${fId}`;
        ctx.reply(`Отправьте эту ссылку членам семьи, чтобы у вас был **ОБЩИЙ** бюджет:\n\n${link}\n\n*Друзья, зашедшие просто по названию бота (без ссылки), получат отдельный пустой бюджет.*`, {parse_mode: 'Markdown'});
    });
});

bot.hears(/Добавить расход/i, (ctx) => {
    ctx.scene.enter('EXPENSE_WIZARD');
});

bot.hears(/Добавить доход/i, (ctx) => {
    ctx.scene.enter('INCOME_WIZARD');
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
