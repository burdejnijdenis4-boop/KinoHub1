JavaScript
const cors = require('cors');
app.use(cors({
  origin: 'https://kino-hub-seven.vercel.app', // Твоя адреса на Vercel
  methods: ['GET', 'POST'],
  credentials: true
}));

require('dotenv').config();
const OpenAI = require('openai');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// Ініціалізація клієнта Groq
const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ключі від хмари жсонбініІ
const JSONBIN_ID = '6a24577af5f4af5e29c32cf6';
const JSONBIN_KEY = '$2a$10$2XqOLrSsXthcKg925l/Sk.6PqMKbqGF/XzRytUJtSw29fDlVNGouq';

const DATA_FILE = path.join(__dirname, 'users.json');
const MARKET_FILE = path.join(__dirname, 'market.json');

// --- БАЗИ ДАНИХ КОРИСТУВАЧІВ ТА РИНКУ ---
function readDatabase() {
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function saveDatabase(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function readMarket() {
    if (!fs.existsSync(MARKET_FILE)) { fs.writeFileSync(MARKET_FILE, JSON.stringify([])); }
    return JSON.parse(fs.readFileSync(MARKET_FILE, 'utf8'));
}
function saveMarket(data) { fs.writeFileSync(MARKET_FILE, JSON.stringify(data, null, 2)); }

// API АДМІН-ПАНЕЛІ

app.get('/api/admin/movies', async (req, res) => {
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_ID}/latest`, {
            headers: { 'X-Master-Key': JSONBIN_KEY }
        });
        const data = await response.json();
        res.json(data.record || []);
    } catch (error) {
        res.status(500).json({ error: "Помилка завантаження з хмари" });
    }
});

app.post('/api/admin/update', async (req, res) => {
    try {
        await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_ID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_KEY },
            body: JSON.stringify(req.body)
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: "Помилка запису в хмару" });
    }
});

// --- ДОДАТИ ЦЕЙ МАРШРУТ У server.js ---
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    
    // Перевірка, чи передані дані
    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Заповніть усі поля!" });
    }

    const db = readDatabase(); // Використовуємо твою функцію читання

    // Перевірка, чи існує вже такий користувач
    if (db[username]) {
        return res.status(400).json({ success: false, message: "Такий користувач вже існує!" });
    }

    // Створюємо нового користувача
    db[username] = { 
        password: password, 
        balance: 10, 
        inventory: [] 
    };

    saveDatabase(db); // Зберігаємо в JSON файл
    
    console.log(`[РЕЄСТРАЦІЯ] Новий користувач: ${username}`);
    res.json({ success: true, message: "Реєстрація успішна!" });
});

// ==========================================
// ГОЛОВНА МАГІЯ: API ЧАТ-БОТА
// ==========================================
app.post('/api/chat', async (req, res) => {
    try {
        const { message, useFilter } = req.body;
        console.log(`[ЧАТ] Повідомлення: "${message}" | Режим фільтрації: ${useFilter ? 'УВІМКНЕНО' : 'ВИМКНЕНО'}`);
        
        if (useFilter) {
            // 1. Беремо найсвіжіші фільми з хмари
            const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_ID}/latest`, {
                headers: { 'X-Master-Key': JSONBIN_KEY }
            });
            const data = await response.json();
            const moviesData = JSON.stringify(data.record || []);

            // 2. Жорстка інструкція для ШІ
            const systemInstruction = `
                Ти — розумний фільтр-асистент сайту KinoHub.
                Ось єдина база фільмів, яка існує на сайті: ${moviesData}.
                
                Користувач просить: "${message}".
                
                Твої дії:
                1. Знайди у базі фільми, які підходять (якщо просить бойовик - шукай жанр Бойовик, якщо легке - Комедія і т.д.).
                2. Відповідай СУВОРО у форматі JSON і ніяк інакше.
                
                Формат відповіді:
                {
                  "reply": "Твій дружній текст для користувача (наприклад: 'Ось знайшов круті бойовики!')",
                  "movieIds": [сюди впиши ID знайдених фільмів у вигляді чисел]
                }
            `;

            const completion = await client.chat.completions.create({
                messages: [{ role: 'system', content: systemInstruction }],
                model: 'llama-3.3-70b-versatile',
                response_format: { type: "json_object" }, // Змушуємо віддати JSON
                temperature: 0.2 // Знижуємо креативність, щоб не збивався
            });
            
            const aiResponse = JSON.parse(completion.choices[0].message.content);
            console.log("[ШІ ВІДПОВІВ]:", aiResponse); // Виводимо в термінал для перевірки
            
            return res.json({ 
                reply: aiResponse.reply, 
                action: 'filter', 
                movieIds: aiResponse.movieIds || [] 
            });

        } else {
            // ЗВИЧАЙНИЙ РЕЖИМ (Без фільтрації)
            const completion = await client.chat.completions.create({
                messages: [
                    { role: 'system', content: "Ти — мій найкращий кінодруг. Бази фільмів зараз у тебе немає, просто приємно спілкуйся." },
                    { role: 'user', content: message }
                ],
                model: 'llama-3.3-70b-versatile',
            });
            return res.json({ reply: completion.choices[0].message.content, action: 'chat' });
        }
    } catch (error) {
        console.error("Помилка AI:", error);
        res.status(500).json({ reply: "Бро, щось сервер трохи підвисає, спробуй ще раз." });
    }
});


// --- Інші API ---
app.post('/api/login', (req, res) => { res.json({ success: true, username: req.body.username }); });
app.get('/api/profile', (req, res) => { res.json({ success: true, profile: {} }); });
app.get('/api/market/items', (req, res) => { res.json(readMarket()); });

app.listen(PORT, () => {
    console.log(`🚀 Сервер працює: http://localhost:${PORT}`);
});