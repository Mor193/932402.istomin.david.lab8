import { Router } from 'express';
import db from '../database/db.js';

const router = Router();

function isValidISBN(isbn) {
  if (!isbn) return true;
  const clean = isbn.replace(/[-\s]/g, '');
  const isbn10Regex = /^\d{9}[\dX]$/i;
  const isbn13Regex = /^(978|979)\d{10}$/;
  return isbn10Regex.test(clean) || isbn13Regex.test(clean);
}

router.get('/', (req, res, next) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT 
        b.id, b.title, b.author, b.isbn, b.status, b.due_date, b.borrower_id, b.created_at,
        br.full_name AS borrower_name, br.contact AS borrower_contact
      FROM books b
      LEFT JOIN borrowers br ON b.borrower_id = br.id
      WHERE 1=1
    `;
    const params = [];

    if (status && ['available', 'issued', 'reserved'].includes(status)) {
      query += ` AND b.status = ?`;
      params.push(status);
    }

    if (search && search.trim() !== '') {
      query += ` AND (b.title LIKE ? OR b.author LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    query += ` ORDER BY b.id DESC`;

    const books = db.prepare(query).all(...params);
    res.json(books);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const book = db.prepare(`
      SELECT b.*, br.full_name AS borrower_name, br.contact AS borrower_contact
      FROM books b
      LEFT JOIN borrowers br ON b.borrower_id = br.id
      WHERE b.id = ?
    `).get(req.params.id);

    if (!book) {
      return res.status(404).json({ error: 'Книга не найдена' });
    }

    res.json(book);
  } catch (err) {
    next(err);
  }
});

router.post('/', (req, res, next) => {
  try {
    const { title, author, isbn } = req.body;

    if (!title || !author) {
      return res.status(400).json({ error: 'Поля "title" и "author" обязательны для заполнения' });
    }

    const trimmedIsbn = isbn ? isbn.trim() : null;
    if (trimmedIsbn && !isValidISBN(trimmedIsbn)) {
      return res.status(400).json({
        error: 'Некорректный формат ISBN. Ожидается ISBN-10 или ISBN-13 (например, 978-5-4461-0960-9)'
      });
    }

    const stmt = db.prepare(`
      INSERT INTO books (title, author, isbn, status)
      VALUES (?, ?, ?, 'available')
    `);

    const result = stmt.run(title.trim(), author.trim(), trimmedIsbn);
    const newBook = db.prepare('SELECT * FROM books WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(newBook);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed: books.isbn')) {
      return res.status(400).json({ error: 'Книга с таким ISBN уже существует в каталоге' });
    }
    next(err);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    const { title, author, isbn } = req.body;

    if (!title || !author) {
      return res.status(400).json({ error: 'Поля "title" и "author" обязательны для заполнения' });
    }

    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Книга не найдена' });
    }

    const trimmedIsbn = isbn ? isbn.trim() : null;
    if (trimmedIsbn && !isValidISBN(trimmedIsbn)) {
      return res.status(400).json({
        error: 'Некорректный формат ISBN. Ожидается ISBN-10 или ISBN-13 (например, 978-5-4461-0960-9)'
      });
    }

    db.prepare(`
      UPDATE books 
      SET title = ?, author = ?, isbn = ?
      WHERE id = ?
    `).run(title.trim(), author.trim(), trimmedIsbn, req.params.id);

    const updated = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed: books.isbn')) {
      return res.status(400).json({ error: 'Книга с таким ISBN уже существует' });
    }
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Книга не найдена' });
    }

    if (book.status === 'issued') {
      return res.status(400).json({ error: 'Нельзя удалить книгу, которая находится на руках у читателя' });
    }

    db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
    res.json({ message: 'Книга успешно удалена', id: Number(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/issue', (req, res, next) => {
  try {
    const { borrower_id, due_date } = req.body;
    const bookId = req.params.id;

    if (!borrower_id || !due_date) {
      return res.status(400).json({ error: 'Необходимо указать читателя и срок возврата' });
    }

    const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoDatePattern.test(due_date)) {
      return res.status(400).json({ error: 'Дата возврата должна быть в формате YYYY-MM-DD' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (due_date < todayStr) {
      return res.status(400).json({ error: 'Срок возврата не может быть раньше текущей даты' });
    }

    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
    if (!book) {
      return res.status(404).json({ error: 'Книга не найдена' });
    }

    if (book.status === 'issued') {
      return res.status(400).json({ error: 'Книга уже выдана другому читателю' });
    }

    const borrower = db.prepare('SELECT * FROM borrowers WHERE id = ?').get(borrower_id);
    if (!borrower) {
      return res.status(404).json({ error: 'Указанный читатель не найден в системе' });
    }

    db.prepare(`
      UPDATE books 
      SET status = 'issued', borrower_id = ?, due_date = ?
      WHERE id = ?
    `).run(borrower_id, due_date, bookId);

    const updatedBook = db.prepare(`
      SELECT b.*, br.full_name AS borrower_name 
      FROM books b 
      LEFT JOIN borrowers br ON b.borrower_id = br.id 
      WHERE b.id = ?
    `).get(bookId);

    res.json({ message: 'Книга успешно выдана', book: updatedBook });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/return', (req, res, next) => {
  try {
    const bookId = req.params.id;
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);

    if (!book) {
      return res.status(404).json({ error: 'Книга не найдена' });
    }

    if (book.status === 'available') {
      return res.status(400).json({ error: 'Книга уже находится в библиотеке (не выдана)' });
    }

    db.prepare(`
      UPDATE books 
      SET status = 'available', borrower_id = NULL, due_date = NULL
      WHERE id = ?
    `).run(bookId);

    res.json({ message: 'Книга успешно возвращена в библиотеку', id: Number(bookId) });
  } catch (err) {
    next(err);
  }
});

export default router;