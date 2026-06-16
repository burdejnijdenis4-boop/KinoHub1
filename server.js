require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// НАЛАШТУВАННЯ CORS (Вимкнення блокування)
// ==========================================
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Ініціалізація клієнта Groq (Твій чат-бот)
const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ключі від бази даних JSONBin
const JSONBIN_ID = '6a30d6c1da38895dfec7a3be';
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

// ==========================================
// API АДМІН-ПАНЕЛІ (Відновлено!)
// ==========================================
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

// ==========================================
// МАРШРУТИ КОРИСТУВАЧІВ ТА МАГАЗИНУ
// ==========================================
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: "Заповніть усі поля!" });
    const db = readDatabase();
    if (db[username]) return res.status(400).json({ success: false, message: "Такий користувач вже існує!" });
    db[username] = { password: password, balance: 10, inventory: [] };
    saveDatabase(db);
    res.json({ success: true, message: "Реєстрація успішна!" });
});

app.post('/api/login', (req, res) => { res.json({ success: true, username: req.body.username }); });
app.get('/api/profile', (req, res) => { res.json({ success: true, profile: {} }); });
app.get('/api/market/items', (req, res) => { res.json(readMarket()); });

// ==========================================
// ГОЛОВНА МАГІЯ: API ЧАТ-БОТА
// ==========================================
app.post('/api/chat', async (req, res) => {
    try {
        const { message, useFilter } = req.body;
        console.log(`[ЧАТ] Повідомлення: "${message}" | Режим фільтрації: ${useFilter ? 'УВІМКНЕНО' : 'ВИМКНЕНО'}`);
        
        if (useFilter) {
            const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_ID}/latest`, {
                headers: { 'X-Master-Key': JSONBIN_KEY }
            });
            const data = await response.json();
            const moviesData = JSON.stringify(data.record || []);

            const systemInstruction = `Ти — розумний фільтр-асистент сайту KinoHub. База: ${moviesData}. Користувач просить: "${message}". Відповідай строго у форматі JSON: { "reply": "текст", "movieIds": [id1, id2] }`;

            const completion = await client.chat.completions.create({
                messages: [{ role: 'system', content: systemInstruction }],
                model: 'llama-3.3-70b-versatile',
                response_format: { type: "json_object" },
                temperature: 0.2
            });
            
            const aiResponse = JSON.parse(completion.choices[0].message.content);
            return res.json({ reply: aiResponse.reply, action: 'filter', movieIds: aiResponse.movieIds || [] });
        } else {
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

app.listen(PORT, () => {
    console.log(`🚀 Сервер працює на порту ${PORT}`);
});