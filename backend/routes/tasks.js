const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readDb, writeDb } = require('../utils/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const ALLOWED_STATUSES = ['todo', 'in-progress', 'done'];
const ALLOWED_PRIORITIES = ['low', 'medium', 'high'];

router.use(authMiddleware);

function getIo(req) {
  return req.app.get('io');
}

// GET /api/tasks - list current user's tasks (supports ?status= & ?priority= filters)
router.get('/', (req, res) => {
  const db = readDb();
  const { status, priority, search } = req.query;

  let tasks = db.tasks.filter((t) => t.userId === req.user.id);

  if (status) tasks = tasks.filter((t) => t.status === status);
  if (priority) tasks = tasks.filter((t) => t.priority === priority);
  if (search) {
    const q = search.toLowerCase();
    tasks = tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
    );
  }

  tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ tasks });
});

// GET /api/tasks/:id
router.get('/:id', (req, res) => {
  const db = readDb();
  const task = db.tasks.find(
    (t) => t.id === req.params.id && t.userId === req.user.id
  );
  if (!task) return res.status(404).json({ message: 'Task not found.' });
  res.json({ task });
});

// POST /api/tasks - create a task
router.post('/', (req, res) => {
  const { title, description, status, priority, dueDate } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ message: 'Title is required.' });
  }
  if (status && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ message: `Status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
  }
  if (priority && !ALLOWED_PRIORITIES.includes(priority)) {
    return res.status(400).json({ message: `Priority must be one of: ${ALLOWED_PRIORITIES.join(', ')}` });
  }

  const db = readDb();
  const now = new Date().toISOString();
  const task = {
    id: uuidv4(),
    userId: req.user.id,
    title: title.trim(),
    description: description || '',
    status: status || 'todo',
    priority: priority || 'medium',
    dueDate: dueDate || null,
    createdAt: now,
    updatedAt: now,
  };

  db.tasks.push(task);
  writeDb(db);

  getIo(req)?.to(req.user.id).emit('task:created', task);
  res.status(201).json({ task });
});

// PUT /api/tasks/:id - update a task
router.put('/:id', (req, res) => {
  const { title, description, status, priority, dueDate } = req.body;

  if (status && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ message: `Status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
  }
  if (priority && !ALLOWED_PRIORITIES.includes(priority)) {
    return res.status(400).json({ message: `Priority must be one of: ${ALLOWED_PRIORITIES.join(', ')}` });
  }

  const db = readDb();
  const idx = db.tasks.findIndex(
    (t) => t.id === req.params.id && t.userId === req.user.id
  );
  if (idx === -1) return res.status(404).json({ message: 'Task not found.' });

  const existing = db.tasks[idx];
  const updated = {
    ...existing,
    title: title !== undefined ? title.trim() : existing.title,
    description: description !== undefined ? description : existing.description,
    status: status || existing.status,
    priority: priority || existing.priority,
    dueDate: dueDate !== undefined ? dueDate : existing.dueDate,
    updatedAt: new Date().toISOString(),
  };

  db.tasks[idx] = updated;
  writeDb(db);

  getIo(req)?.to(req.user.id).emit('task:updated', updated);
  res.json({ task: updated });
});

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
  const db = readDb();
  const idx = db.tasks.findIndex(
    (t) => t.id === req.params.id && t.userId === req.user.id
  );
  if (idx === -1) return res.status(404).json({ message: 'Task not found.' });

  const [removed] = db.tasks.splice(idx, 1);
  writeDb(db);

  getIo(req)?.to(req.user.id).emit('task:deleted', { id: removed.id });
  res.json({ message: 'Task deleted.', id: removed.id });
});

module.exports = router;
