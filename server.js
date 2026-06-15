require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// ДОЗВОЛЯЄМО ВСІМ
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json());

app.post('/api/chat', (req, res) => {
    console.log("ЗАПИТ ПРИЙШОВ!"); // Якщо це в логах - ми перемогли
    res.json({ reply: "Сервер працює нормально!" });
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер працює на порту ${PORT}`);
});
