import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import booksRouter from './routes/books.js';
import borrowersRouter from './routes/borrowers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;


app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));


app.use('/api/books', booksRouter);
app.use('/api/borrowers', borrowersRouter);


app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Запрашиваемый API-эндпоинт не найден' });
});


app.use((err, req, res, next) => {
  console.error('Необработанная ошибка сервера:', err);
  res.status(500).json({ 
    error: 'Внутренняя ошибка сервера',
    message: err.message 
  });
});

app.listen(PORT, () => {
  console.log(`Сервер библиотеки запущен: http://localhost:${PORT}`);
});