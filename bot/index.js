require('dotenv').config();
const { Telegraf, Markup, session, Scenes } = require('telegraf');
const db = require('./db.js');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN);

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
        db.all('SELECT * FROM categories WHERE type = "expense"', [], (err, rows) => {
            if (err) return console.error(err);
            const buttons = rows.map(r => Markup.button.callback(`${r.icon} ${r.name}`, `cat_${r.id}`));
            // Keyboard layout (rows of 2 buttons)
            const keyboard = [];
            for(let i=0; i<buttons.length; i+=2) {
                keyboard.push(buttons.slice(i, i+2));
            }
            ctx.reply(`Сумма: ${amount} ₽\nВыберите категорию:`, Markup.inlineKeyboard(keyboard));
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
                
                db.run('INSERT INTO transactions (amount, category_id, user_id) VALUES (?, ?, ?)', [amount, catId, userId], function(err) {
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
    // Сохраняем пользователя в базу для семейного доступа
    db.run(
        'INSERT OR IGNORE INTO users (telegram_id, first_name, username) VALUES (?, ?, ?)', 
        [ctx.from.id, ctx.from.first_name, ctx.from.username]
    );

    ctx.reply('Привет! Я ваш финансовый трекер. Что вам нужно?', Markup.keyboard([
        ['📉 Добавить расход', '📈 Добавить доход'],
        ['📊 Дашборд']
    ]).resize());
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
