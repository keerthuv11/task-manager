// Base URL of the backend API. Change this if you deploy the backend elsewhere.
const API_BASE_URL = 'http://localhost:5000/api';

const Storage = {
  getToken: () => localStorage.getItem('tf_token'),
  setToken: (token) => localStorage.setItem('tf_token', token),
  clearToken: () => localStorage.removeItem('tf_token'),
  getUser: () => JSON.parse(localStorage.getItem('tf_user') || 'null'),
  setUser: (user) => localStorage.setItem('tf_user', JSON.stringify(user)),
  clearUser: () => localStorage.removeItem('tf_user'),
};

async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = Storage.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    // no JSON body
  }

  if (!res.ok) {
    const message = (data && data.message) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

const Api = {
  register: (name, email, password) =>
    apiRequest('/auth/register', { method: 'POST', body: { name, email, password }, auth: false }),
  login: (email, password) =>
    apiRequest('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  listTasks: (params = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v)));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest(`/tasks${suffix}`);
  },
  createTask: (task) => apiRequest('/tasks', { method: 'POST', body: task }),
  updateTask: (id, task) => apiRequest(`/tasks/${id}`, { method: 'PUT', body: task }),
  deleteTask: (id) => apiRequest(`/tasks/${id}`, { method: 'DELETE' }),
};
