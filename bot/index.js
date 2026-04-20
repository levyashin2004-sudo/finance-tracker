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



const createTransactionWizard = (sceneId, typeName) => {
    return new Scenes.WizardScene(
        sceneId,
        async (ctx) => {
            db.get('SELECT family_id FROM users WHERE telegram_id = ?', [ctx.from.id], (err, row) => {
                const familyId = row ? row.family_id : ctx.from.id;
                ctx.wizard.state.familyId = familyId;
                
                db.all(`SELECT * FROM categories WHERE type = ? AND family_id = ?`, [typeName, familyId], async (err, rows) => {
                    if (err || !rows) {
                        ctx.reply('Произошла ошибка при загрузке категорий.');
                        return ctx.scene.leave();
                    }
                    if (rows.length === 0) {
                        ctx.reply(`У вас пока нет категорий типа "${typeName}". Добавьте их через Дашборд!`);
                        return ctx.scene.leave();
                    }
                    try {
                        const buttons = rows.map(r => Markup.button.callback(`${r.icon||'📁'} ${r.name}`, `cat_${r.id}`));
                        const keyboard = [];
                        for(let i=0; i<buttons.length; i+=2) keyboard.push(buttons.slice(i, i+2));
                        
                        await ctx.reply(`Выберите категорию:`, Markup.inlineKeyboard(keyboard));
                        ctx.wizard.next(); 
                    } catch(e) {
                        console.error('Wizard render error:', e);
                        ctx.reply('Не удалось отобразить категории. Пожалуйста, проверьте настройки категорий в Дашборде.');
                        ctx.scene.leave();
                    }
                });
            });
        },
        async (ctx) => {
            if (ctx.callbackQuery) {
                await ctx.answerCbQuery().catch(() => {});
                const action = ctx.callbackQuery.data;
                if (action.startsWith('cat_')) {
                    ctx.wizard.state.catId = action.split('_')[1];
                    
                    db.all(`SELECT * FROM wallets WHERE family_id = ?`, [ctx.wizard.state.familyId], async (err, wallets) => {
                        if (err || !wallets || wallets.length === 0) {
                            ctx.reply('У вас нет кошельков. Сначала создайте их через Дашборд!');
                            return ctx.scene.leave();
                        }
                        try {
                            const buttons = wallets.map(w => Markup.button.callback(`${w.icon||'💳'} ${w.name}`, `wal_${w.id}`));
                            const keyboard = [];
                            for(let i=0; i<buttons.length; i+=2) keyboard.push(buttons.slice(i, i+2));
                            await ctx.reply(`Откуда ${typeName === 'expense' ? 'списано' : 'зачислено'}? Выберите кошелек:`, Markup.inlineKeyboard(keyboard));
                            ctx.wizard.next();
                        } catch(e) {
                            console.error('Wizard wallet render err:', e);
                            ctx.reply('Ошибка загрузки кошельков.');
                            ctx.scene.leave();
                        }
                    });
                }
            } else {
                ctx.reply('Пожалуйста, выберите категорию из кнопок выше.');
            }
        },
        async (ctx) => {
            if (ctx.callbackQuery) {
                await ctx.answerCbQuery().catch(() => {});
                const action = ctx.callbackQuery.data;
                if (action.startsWith('wal_')) {
                    ctx.wizard.state.walletId = action.split('_')[1];
                    ctx.reply('Введите сумму и валюту (например: 500, 10 USD, 15 EUR):');
                    return ctx.wizard.next();
                }
            } else {
                ctx.reply('Пожалуйста, выберите кошелек из кнопок выше.');
            }
        },
        async (ctx) => {
            const text = (ctx.message.text || '').trim().toUpperCase();
            // Parse amount and currency
            const match = text.match(/^([\d.,]+)\s*(USD|EUR|RUB)?$/);
            if (!match) {
                ctx.reply('Неверный формат. Пожалуйста, введите сумму и валюту (например: 500, 10 USD):');
                return;
            }
            let amount = parseFloat(match[1].replace(',', '.'));
            let currency = match[2] || 'RUB';

            if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
                ctx.reply('Пожалуйста, введите корректное число больше нуля.');
                return;
            }

            const rates = await getRates();
            let finalRub = amount;
            if (currency === 'USD') finalRub = amount * rates.USD;
            if (currency === 'EUR') finalRub = amount * rates.EUR;

            const catId = ctx.wizard.state.catId;
            const walletId = ctx.wizard.state.walletId;
            const userId = ctx.from.id;
            const familyId = ctx.wizard.state.familyId;
            
            db.run('INSERT INTO transactions (amount, category_id, user_id, family_id, wallet_id) VALUES (?, ?, ?, ?, ?)', 
                [finalRub, catId, userId, familyId, walletId], function(err) {
                if (err) return console.error(err);
                
                // Update wallet balance directly
                const modifier = typeName === 'expense' ? '-' : '+';
                db.run(`UPDATE wallets SET amount = amount ${modifier} ? WHERE id = ? AND family_id = ?`, [finalRub, walletId, familyId]);
                
                ctx.reply(`✅ Сохранено! Итого: ${finalRub.toLocaleString('ru-RU', {maximumFractionDigits:0})} ₽`);
                ctx.scene.leave();
            });
        }
    );
};

const expenseWizard = createTransactionWizard('EXPENSE_WIZARD', 'expense');
const incomeWizard = createTransactionWizard('INCOME_WIZARD', 'income');

const stage = new Scenes.Stage([expenseWizard, incomeWizard]);

// GLOBAL INTERCEPTOR: If a user clicks ANY main keyboard button, immediately abort active scenes and restart flow
bot.hears(/(Дашборд|Добавить расход|Добавить доход|Пригласить в семью)/i, async (ctx, next) => {
    if (ctx.scene && ctx.scene.current) {
        await ctx.scene.leave();
    }
    return next();
});

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
        ctx.reply(`Отправьте эту ссылку членам семьи, чтобы у вас был <b>ОБЩИЙ</b> бюджет:\n\n${link}\n\n<i>Друзья, зашедшие просто по названию бота (без ссылки), получат отдельный пустой бюджет.</i>`, {parse_mode: 'HTML'});
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
bot.hears(/Дашборд/i, (ctx) => {
    ctx.reply('Ваша финансовая аналитика:', Markup.inlineKeyboard([
        Markup.button.webApp('Открыть Дашборд', dynamicWebAppUrl)
    ]));
});

// GLOBAL ERROR CATCHER FOR TELEGRAM
bot.catch((err, ctx) => {
    console.error(`[TELEGRAM CRITICAL ERROR] for ${ctx.updateType}:`, err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL UNHANDLED REJECTION]', reason);
});
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL UNCAUGHT EXCEPTION]', err);
});

const startBot = async () => {
    try {
        await bot.launch();
        console.log('[INFO] Telegram Bot is successfully running...');
        processRecurringPayments(); // process missed crons on boot
    } catch (err) {
        console.error('[ERROR] Failed to start Telegram Bot. Retrying in 10s...', err.message);
        setTimeout(startBot, 10000);
    }
};

const cron = require('node-cron');
const processRecurringPayments = () => {
    const today = new Date();
    const currentDay = today.getDate();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    db.all('SELECT * FROM recurring_payments', [], (err, rows) => {
        if (err || !rows) return;
        rows.forEach(p => {
            if (p.day_of_month === currentDay && p.last_processed_date !== todayStr) {
                // Execute payment
                const modifier = p.type === 'expense' ? '-' : '+';
                db.run('INSERT INTO transactions (amount, category_id, user_id, date, description, family_id, wallet_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [p.amount, p.category_id, p.user_id, new Date().toISOString(), `[АВТО] ${p.name}`, p.family_id, p.wallet_id], (err) => {
                    if (!err) {
                        if (p.wallet_id) {
                            db.run(`UPDATE wallets SET amount = amount ${modifier} ? WHERE id = ? AND family_id = ?`, [p.amount, p.wallet_id, p.family_id]);
                        }
                        db.run('UPDATE recurring_payments SET last_processed_date = ? WHERE id = ?', [todayStr, p.id]);
                        bot.telegram.sendMessage(p.user_id, `🔄 <b>Авто-платеж сработал:</b> ${p.name}\nСумма: ${p.amount.toLocaleString('ru-RU')} ₽\nТип: ${p.type === 'expense' ? 'Списание' : 'Пополнение'}`, {parse_mode: 'HTML'}).catch(()=>{});
                    }
                });
            }
        });
    });
};
// Schedule to run every day at Midnight
cron.schedule('0 0 * * *', processRecurringPayments);

startBot();

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
