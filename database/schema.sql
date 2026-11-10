PRAGMA foreign_keys = ON;


DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS borrowers;


CREATE TABLE borrowers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    contact TEXT NOT NULL
);


CREATE TABLE books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT UNIQUE,
    status TEXT NOT NULL CHECK(status IN ('available', 'issued', 'reserved')) DEFAULT 'available',
    due_date TEXT DEFAULT NULL, -- Формат ISO: YYYY-MM-DD
    borrower_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (borrower_id) REFERENCES borrowers(id) ON DELETE SET NULL
);


CREATE INDEX idx_books_status ON books(status);
CREATE INDEX idx_books_search ON books(title, author);


INSERT INTO borrowers (full_name, contact) VALUES
('Иван Иванов', '+7 (999) 111-22-33'),
('Анна Смирнова', 'anna.smirnova@example.com'),
('Алексей Кузнецов', '+7 (900) 555-44-33');

INSERT INTO books (title, author, isbn, status, due_date, borrower_id) VALUES
('Чистый код', 'Роберт Мартин', '978-5-4461-0960-9', 'available', NULL, NULL),
('Паттерны объектно-ориентированного проектирования', 'Эрих Гамма, Ричард Хелм', '978-5-4461-0118-4', 'available', NULL, NULL),
('Изучаем Node.js', 'Марио Каскиаро', '978-5-4461-1205-0', 'issued', '2026-11-15', 1),
('Грокаем алгоритмы', 'Адитья Бхаргава', '978-5-4461-0923-4', 'issued', '2026-09-01', 2),
('Совершенный код', 'Стив Макконнелл', '978-5-7502-0064-1', 'reserved', NULL, NULL);