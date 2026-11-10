import { api } from './api.js';

const booksTableBody = document.getElementById('booksTableBody');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const toastContainer = document.getElementById('toastContainer');

const bookDialog = document.getElementById('bookDialog');
const bookDialogTitle = document.getElementById('bookDialogTitle');
const bookForm = document.getElementById('bookForm');
const bookIdInput = document.getElementById('bookId');
const bookTitleInput = document.getElementById('bookTitle');
const bookAuthorInput = document.getElementById('bookAuthor');
const bookIsbnInput = document.getElementById('bookIsbn');
const openAddBookBtn = document.getElementById('openAddBookBtn');
const closeBookDialogBtn = document.getElementById('closeBookDialogBtn');
const cancelBookBtn = document.getElementById('cancelBookBtn');

const issueDialog = document.getElementById('issueDialog');
const issueForm = document.getElementById('issueForm');
const issueBookIdInput = document.getElementById('issueBookId');
const issueBookTitleEl = document.getElementById('issueBookTitle');
const borrowerSelect = document.getElementById('borrowerSelect');
const dueDateInput = document.getElementById('dueDateInput');
const closeIssueDialogBtn = document.getElementById('closeIssueDialogBtn');
const cancelIssueBtn = document.getElementById('cancelIssueBtn');

let booksState = [];
let borrowersCache = [];

document.addEventListener('DOMContentLoaded', async () => {
  setupDialogBackdropClose();
  initEventListeners();
  await Promise.all([loadBooks(), loadBorrowers()]);
});

async function loadBorrowers() {
  try {
    borrowersCache = await api.getBorrowers();
    borrowerSelect.innerHTML = '<option value="">Выберите зарегистрированного читателя</option>';
    borrowersCache.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.full_name} (${b.contact})`;
      borrowerSelect.appendChild(opt);
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadBooks() {
  try {
    const search = searchInput.value.trim();
    const status = statusFilter.value;

    booksState = await api.getBooks({ search, status });
    renderTable(booksState);
  } catch (err) {
    booksTableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: var(--danger)">Ошибка загрузки: ${escapeHtml(err.message)}</td></tr>`;
    showToast(err.message, 'error');
  }
}

function renderTable(books) {
  if (books.length === 0) {
    booksTableBody.innerHTML = `<tr><td colspan="8" class="text-center">Книги не найдены</td></tr>`;
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];

  booksTableBody.innerHTML = books.map(book => {
    const isOverdue = book.status === 'issued' && book.due_date && book.due_date < todayStr;
    const rowClass = isOverdue ? 'class="overdue"' : '';

    const statusBadges = {
      available: '<span class="badge badge-available">В наличии</span>',
      issued: '<span class="badge badge-issued">На руках</span>',
      reserved: '<span class="badge badge-reserved">В резерве</span>'
    };

    const statusBadge = statusBadges[book.status] || book.status;
    const dueDateDisplay = book.due_date ? `${escapeHtml(book.due_date)} ${isOverdue ? '<span class="overdue-tag">ПРОСРОЧЕНО</span>' : ''}` : '—';
    const borrowerDisplay = book.borrower_name ? `${escapeHtml(book.borrower_name)}` : '—';

    let actionButtons = '';
    if (book.status === 'available') {
      actionButtons += `<button class="btn btn-sm btn-accent" data-action="issue" data-id="${book.id}">Выдать</button>`;
    } else if (book.status === 'issued') {
      actionButtons += `<button class="btn btn-sm btn-secondary" data-action="return" data-id="${book.id}">Вернуть</button>`;
    }

    actionButtons += `
      <button class="btn btn-sm btn-secondary" data-action="edit" data-id="${book.id}">Ред.</button>
      <button class="btn btn-sm btn-danger" data-action="delete" data-id="${book.id}" ${book.status === 'issued' ? 'disabled title="Нельзя удалить выданную книгу"' : ''}>Удалить</button>
    `;

    return `
      <tr ${rowClass}>
        <td>${book.id}</td>
        <td><strong>${escapeHtml(book.title)}</strong></td>
        <td>${escapeHtml(book.author)}</td>
        <td><code>${escapeHtml(book.isbn || '—')}</code></td>
        <td>${statusBadge}</td>
        <td>${borrowerDisplay}</td>
        <td>${dueDateDisplay}</td>
        <td><div class="actions-cell">${actionButtons}</div></td>
      </tr>
    `;
  }).join('');
}

function initEventListeners() {
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadBooks, 250);
  });

  statusFilter.addEventListener('change', loadBooks);

  resetFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    statusFilter.value = '';
    loadBooks();
  });

  openAddBookBtn.addEventListener('click', () => {
    bookForm.reset();
    bookIdInput.value = '';
    bookDialogTitle.textContent = 'Добавление книги';
    bookDialog.showModal();
  });

  closeBookDialogBtn.addEventListener('click', () => bookDialog.close());
  cancelBookBtn.addEventListener('click', () => bookDialog.close());
  closeIssueDialogBtn.addEventListener('click', () => issueDialog.close());
  cancelIssueBtn.addEventListener('click', () => issueDialog.close());

  booksTableBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = Number(btn.dataset.id);
    const book = booksState.find(b => b.id === id);

    if (action === 'edit' && book) {
      openEditModal(book);
    } else if (action === 'delete' && book) {
      await handleDeleteBook(book);
    } else if (action === 'issue' && book) {
      openIssueModal(book);
    } else if (action === 'return' && book) {
      await handleReturnBook(book);
    }
  });

  bookForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = bookIdInput.value;

    const bookData = {
      title: bookTitleInput.value.trim(),
      author: bookAuthorInput.value.trim(),
      isbn: bookIsbnInput.value.trim() || null
    };

    if (!bookData.title || !bookData.author) {
      showToast('Заполните обязательные поля: название и автор', 'error');
      return;
    }

    if (bookData.isbn) {
      const cleanIsbn = bookData.isbn.replace(/[-\s]/g, '');
      const isValid = /^\d{9}[\dX]$/i.test(cleanIsbn) || /^(978|979)\d{10}$/.test(cleanIsbn);
      if (!isValid) {
        showToast('Укажите корректный ISBN (10 или 13 цифр, например 978-5-4461-0960-9)', 'error');
        return;
      }
    }

    try {
      if (id) {
        await api.updateBook(id, bookData);
        showToast('Данные книги успешно обновлены');
      } else {
        await api.createBook(bookData);
        showToast('Книга добавлена в каталог');
      }
      bookDialog.close();
      await loadBooks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  issueForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = issueBookIdInput.value;
    const borrower_id = Number(borrowerSelect.value);
    const due_date = dueDateInput.value;

    if (!borrower_id || !due_date) {
      showToast('Выберите читателя и укажите дату возврата', 'error');
      return;
    }

    try {
      await api.issueBook(id, { borrower_id, due_date });
      showToast('Книга успешно выдана читателю');
      issueDialog.close();
      await loadBooks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function openEditModal(book) {
  bookIdInput.value = book.id;
  bookTitleInput.value = book.title;
  bookAuthorInput.value = book.author;
  bookIsbnInput.value = book.isbn || '';
  bookDialogTitle.textContent = 'Редактирование книги';
  bookDialog.showModal();
}

function openIssueModal(book) {
  issueBookIdInput.value = book.id;
  issueBookTitleEl.textContent = `«${book.title}» (${book.author})`;
  issueForm.reset();

  const todayStr = new Date().toISOString().split('T')[0];
  dueDateInput.min = todayStr;

  const defaultDue = new Date();
  defaultDue.setDate(defaultDue.getDate() + 14);
  dueDateInput.value = defaultDue.toISOString().split('T')[0];

  issueDialog.showModal();
}

async function handleReturnBook(book) {
  if (!confirm(`Подтверждаете возврат книги «${book.title}» в библиотеку?`)) return;

  try {
    await api.returnBook(book.id);
    showToast('Книга возвращена в библиотеку');
    await loadBooks();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeleteBook(book) {
  if (!confirm(`Удалить книгу «${book.title}» из каталога?`)) return;

  try {
    await api.deleteBook(book.id);
    showToast('Книга удалена');
    await loadBooks();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function setupDialogBackdropClose() {
  [bookDialog, issueDialog].forEach(dialog => {
    dialog.addEventListener('click', (e) => {
      const rect = dialog.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.width + rect.left
      );
      if (!isInDialog) dialog.close();
    });
  });
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}