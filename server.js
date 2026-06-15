require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json());

const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
});

app.post('/api/chat', async (req, res) => {
    console.log("ЗАПИТ ОТРИМАНО!"); // Якщо це з'явиться в логах - ми перемогли
    try {
        const { message } = req.body;
        const completion = await client.chat.completions.create({
            messages: [{ role: 'user', content: message }],
            model: 'llama-3.3-70b-versatile',
        });
        res.json({ reply: completion.choices[0].message.content });
    } catch (error) {
        console.error("Помилка:", error);
        res.status(500).json({ reply: "Помилка" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер працює на порту ${PORT}`);
});
