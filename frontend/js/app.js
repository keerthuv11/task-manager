const SOCKET_URL = 'https://task-manager-backend-ashy.vercel.app';

// ----- State -----
let tasks = [];
let socket = null;
let editingTaskId = null;

// ----- DOM references -----
const authScreen = document.getElementById('auth-screen');
const dashboard = document.getElementById('dashboard');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');

const tabBtns = document.querySelectorAll('.tab-btn');

const userNameEl = document.getElementById('user-name');
const connectionDot = document.getElementById('connection-dot');
const logoutBtn = document.getElementById('logout-btn');

const searchInput = document.getElementById('search-input');
const statusFilter = document.getElementById('status-filter');
const priorityFilter = document.getElementById('priority-filter');
const tasksError = document.getElementById('tasks-error');

const newTaskBtn = document.getElementById('new-task-btn');
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const modalTitle = document.getElementById('modal-title');
const modalError = document.getElementById('modal-error');
const cancelModalBtn = document.getElementById('cancel-modal-btn');
const deleteTaskBtn = document.getElementById('delete-task-btn');

const columns = {
  todo: document.getElementById('list-todo'),
  'in-progress': document.getElementById('list-in-progress'),
  done: document.getElementById('list-done'),
};
const counts = {
  todo: document.getElementById('count-todo'),
  'in-progress': document.getElementById('count-in-progress'),
  done: document.getElementById('count-done'),
};

// ----- Auth tab switching -----
tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    loginForm.classList.toggle('hidden', tab !== 'login');
    registerForm.classList.toggle('hidden', tab !== 'register');
    loginError.textContent = '';
    registerError.textContent = '';
  });
});

// ----- Login -----
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const formData = new FormData(loginForm);
  try {
    const { token, user } = await Api.login(formData.get('email'), formData.get('password'));
    Storage.setToken(token);
    Storage.setUser(user);
    enterDashboard();
  } catch (err) {
    loginError.textContent = err.message;
  }
});

// ----- Register -----
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  registerError.textContent = '';
  const formData = new FormData(registerForm);
  try {
    const { token, user } = await Api.register(
      formData.get('name'),
      formData.get('email'),
      formData.get('password')
    );
    Storage.setToken(token);
    Storage.setUser(user);
    enterDashboard();
  } catch (err) {
    registerError.textContent = err.message;
  }
});

// ----- Logout -----
logoutBtn.addEventListener('click', () => {
  Storage.clearToken();
  Storage.clearUser();
  if (socket) socket.disconnect();
  tasks = [];
  dashboard.classList.add('hidden');
  authScreen.classList.remove('hidden');
});

// ----- Dashboard entry -----
async function enterDashboard() {
  const user = Storage.getUser();
  userNameEl.textContent = user ? `Hi, ${user.name}` : '';
  authScreen.classList.add('hidden');
  dashboard.classList.remove('hidden');
  connectSocket();
  await refreshTasks();
}

// ----- Real-time socket -----
function connectSocket() {
  const token = Storage.getToken();
  if (socket) socket.disconnect();

  socket = io(SOCKET_URL, { auth: { token } });

  socket.on('connect', () => {
    connectionDot.classList.add('online');
    connectionDot.classList.remove('offline');
  });
  socket.on('disconnect', () => {
    connectionDot.classList.remove('online');
    connectionDot.classList.add('offline');
  });
  socket.on('connect_error', () => {
    connectionDot.classList.remove('online');
    connectionDot.classList.add('offline');
  });

  socket.on('task:created', (task) => {
    if (!tasks.find((t) => t.id === task.id)) tasks.push(task);
    renderBoard();
  });
  socket.on('task:updated', (task) => {
    const idx = tasks.findIndex((t) => t.id === task.id);
    if (idx !== -1) tasks[idx] = task;
    else tasks.push(task);
    renderBoard();
  });
  socket.on('task:deleted', ({ id }) => {
    tasks = tasks.filter((t) => t.id !== id);
    renderBoard();
  });
}

// ----- Fetch + render tasks -----
async function refreshTasks() {
  tasksError.textContent = '';
  try {
    const params = {
      status: statusFilter.value,
      priority: priorityFilter.value,
      search: searchInput.value.trim(),
    };
    const data = await Api.listTasks(params);
    tasks = data.tasks;
    renderBoard();
  } catch (err) {
    tasksError.textContent = err.message;
  }
}

let searchDebounce;
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(refreshTasks, 300);
});
statusFilter.addEventListener('change', refreshTasks);
priorityFilter.addEventListener('change', refreshTasks);

function renderBoard() {
  Object.entries(columns).forEach(([status, el]) => {
    el.innerHTML = '';
    const group = tasks.filter((t) => t.status === status);
    counts[status].textContent = group.length;

    if (group.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No tasks here.';
      el.appendChild(empty);
      return;
    }

    group
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .forEach((task) => el.appendChild(renderTaskCard(task)));
  });
}

function renderTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.addEventListener('click', () => openEditModal(task));

  const title = document.createElement('h3');
  title.textContent = task.title;
  card.appendChild(title);

  if (task.description) {
    const desc = document.createElement('p');
    desc.textContent = task.description;
    card.appendChild(desc);
  }

  const meta = document.createElement('div');
  meta.className = 'task-meta';

  const priorityBadge = document.createElement('span');
  priorityBadge.className = `badge badge-${task.priority}`;
  priorityBadge.textContent = task.priority;
  meta.appendChild(priorityBadge);

  if (task.dueDate) {
    const dueBadge = document.createElement('span');
    dueBadge.className = 'badge badge-due';
    dueBadge.textContent = `Due ${task.dueDate}`;
    meta.appendChild(dueBadge);
  }

  card.appendChild(meta);
  return card;
}

// ----- Task modal -----
function openCreateModal() {
  editingTaskId = null;
  modalTitle.textContent = 'New Task';
  taskForm.reset();
  taskForm.elements['id'].value = '';
  deleteTaskBtn.classList.add('hidden');
  modalError.textContent = '';
  taskModal.classList.remove('hidden');
}

function openEditModal(task) {
  editingTaskId = task.id;
  modalTitle.textContent = 'Edit Task';
  taskForm.elements['id'].value = task.id;
  taskForm.elements['title'].value = task.title;
  taskForm.elements['description'].value = task.description || '';
  taskForm.elements['status'].value = task.status;
  taskForm.elements['priority'].value = task.priority;
  taskForm.elements['dueDate'].value = task.dueDate || '';
  deleteTaskBtn.classList.remove('hidden');
  modalError.textContent = '';
  taskModal.classList.remove('hidden');
}

function closeModal() {
  taskModal.classList.add('hidden');
  editingTaskId = null;
}

newTaskBtn.addEventListener('click', openCreateModal);
cancelModalBtn.addEventListener('click', closeModal);
taskModal.addEventListener('click', (e) => {
  if (e.target === taskModal) closeModal();
});

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  modalError.textContent = '';
  const formData = new FormData(taskForm);
  const payload = {
    title: formData.get('title'),
    description: formData.get('description'),
    status: formData.get('status'),
    priority: formData.get('priority'),
    dueDate: formData.get('dueDate') || null,
  };

  try {
    if (editingTaskId) {
      const { task } = await Api.updateTask(editingTaskId, payload);
      const idx = tasks.findIndex((t) => t.id === task.id);
      if (idx !== -1) tasks[idx] = task; else tasks.push(task);
    } else {
      const { task } = await Api.createTask(payload);
      tasks.push(task);
    }
    renderBoard();
    closeModal();
  } catch (err) {
    modalError.textContent = err.message;
  }
});

deleteTaskBtn.addEventListener('click', async () => {
  if (!editingTaskId) return;
  if (!confirm('Delete this task? This cannot be undone.')) return;
  try {
    await Api.deleteTask(editingTaskId);
    tasks = tasks.filter((t) => t.id !== editingTaskId);
    renderBoard();
    closeModal();
  } catch (err) {
    modalError.textContent = err.message;
  }
});

// ----- Boot -----
(function boot() {
  const token = Storage.getToken();
  if (token) {
    enterDashboard();
  }
})();
