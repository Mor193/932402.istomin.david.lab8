const API_BASE = '/api';


async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.error || data.message || `Ошибка сервера (${response.status})`;
    throw new Error(errorMsg);
  }
  return data;
}

export const api = {
  async getBooks(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.search) query.append('search', params.search);

    const url = `${API_BASE}/books${query.toString() ? '?' + query.toString() : ''}`;
    const res = await fetch(url);
    return handleResponse(res);
  },

  
  async getBorrowers() {
    const res = await fetch(`${API_BASE}/borrowers`);
    return handleResponse(res);
  },

  
  async createBook(bookData) {
    const res = await fetch(`${API_BASE}/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookData)
    });
    return handleResponse(res);
  },

  
  async updateBook(id, bookData) {
    const res = await fetch(`${API_BASE}/books/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookData)
    });
    return handleResponse(res);
  },

  
  async deleteBook(id) {
    const res = await fetch(`${API_BASE}/books/${id}`, {
      method: 'DELETE'
    });
    return handleResponse(res);
  },

  
  async issueBook(id, issueData) {
    const res = await fetch(`${API_BASE}/books/${id}/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(issueData)
    });
    return handleResponse(res);
  },

  
  async returnBook(id) {
    const res = await fetch(`${API_BASE}/books/${id}/return`, {
      method: 'POST'
    });
    return handleResponse(res);
  }
};