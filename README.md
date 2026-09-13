# TaskFlow — Task Management Web Application

A full-stack task management app: create, update, track and organize tasks on a
Kanban-style board (To Do / In Progress / Done), with account login, live
multi-tab/multi-device sync over WebSockets, and a responsive layout for
desktop and mobile.

## Tech Stack

- **Backend:** Node.js, Express, JSON-file storage (no external database
  needed), JWT authentication, bcrypt password hashing, Socket.IO for
  real-time updates.
- **Frontend:** Plain HTML/CSS/JavaScript (no build step required),
  Socket.IO client, Fetch API.

## Project Structure

```
task-manager/
├── backend/
│   ├── data/db.json          # auto-created JSON "database"
│   ├── middleware/auth.js    # JWT verification middleware
│   ├── routes/auth.js        # register / login / me
│   ├── routes/tasks.js       # task CRUD (protected)
│   ├── utils/db.js           # read/write helpers for db.json
│   ├── server.js             # Express app + Socket.IO server
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── css/style.css
    ├── js/api.js              # fetch wrapper + auth token storage
    ├── js/app.js              # UI logic, rendering, socket handling
    └── index.html
```

## 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# edit .env and set a real JWT_SECRET (any long random string)
npm start
```

The API runs at `http://localhost:5000` by default. Health check:
`GET http://localhost:5000/api/health`.

### API Endpoints

| Method | Endpoint              | Auth | Description                     |
|--------|-----------------------|------|----------------------------------|
| POST   | /api/auth/register    | No   | Create an account                |
| POST   | /api/auth/login       | No   | Log in, returns a JWT            |
| GET    | /api/auth/me          | Yes  | Get current user from token      |
| GET    | /api/tasks            | Yes  | List tasks (filters: status, priority, search) |
| GET    | /api/tasks/:id        | Yes  | Get one task                     |
| POST   | /api/tasks            | Yes  | Create a task                    |
| PUT    | /api/tasks/:id        | Yes  | Update a task                    |
| DELETE | /api/tasks/:id        | Yes  | Delete a task                    |

Real-time: the server emits `task:created`, `task:updated`, and
`task:deleted` over Socket.IO to the room named after the user's ID, so all of
that user's open tabs/devices stay in sync instantly.

## 2. Frontend Setup

The frontend is static, so any static server works. Simplest option — open
`frontend/index.html` directly in a browser, or serve it:

```bash
cd frontend
npx serve .
# or: python3 -m http.server 5500
```

If you change the backend port or origin, update `API_BASE_URL` in
`frontend/js/api.js` and `SOCKET_URL` in `frontend/js/app.js`, and update
`CLIENT_ORIGIN` in `backend/.env` to match wherever the frontend is served
from (needed for CORS).

## 3. Using the App

1. Open the frontend in your browser.
2. Sign up for an account (name, email, password ≥ 6 characters).
3. Create tasks with the **+ New Task** button — set a title, description,
   status, priority, and optional due date.
4. Click any task card to edit or delete it.
5. Use the search box and status/priority dropdowns to filter the board.
6. Open the app in a second browser tab (or another device) while logged in
   to see real-time updates land instantly via WebSockets.

## Notes & Next Steps

- Data is stored in `backend/data/db.json` for simplicity — swap `utils/db.js`
  for a real database (MongoDB, PostgreSQL, etc.) without touching the routes'
  logic much, since it's isolated behind `readDb()`/`writeDb()`.
- Passwords are hashed with bcrypt; never stored in plaintext.
- JWTs expire after 7 days by default (`JWT_EXPIRES_IN` in `.env`).
- This is a learning-oriented reference implementation — for production, add
  rate limiting, input sanitization, HTTPS, refresh tokens, and a proper
  database with concurrent-write safety.
