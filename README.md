<<<<<<< HEAD
# Sunrise Bistro — Local Dev & Deploy

This workspace contains a Next.js frontend and a small Express + MongoDB backend.

Quick setup

1. Install dependencies

```bash
npm install
```

2. Create a `.env` in the project root (or set env vars):

```text
MONGODB_URI=mongodb://127.0.0.1:27017/sunrise-bistro
PORT=4000
```

3. Seed the database (optional):

```bash
node scripts/seed.js
```

4. Start backend (dev with auto-reload):

```bash
npm run dev:backend
# or
npm run backend
```

5. Start frontend:

```bash
npm run dev
```

API

- `GET /api/health` — basic health check
- `GET /api/menu` — returns menu items from MongoDB
- `POST /api/contact` — save contact request
- `GET /api/contact` — list contact requests

Deploy notes

- For production, build the Next.js app (`npm run build`) and serve with `npm start` from a Node process.
- Run the Express backend as a separate process (e.g., PM2, systemd) or merge into Next.js custom server if desired.

If you want, I can add Dockerfiles and a docker-compose setup for easy hosting."
=======
# paranjape-foods
Paranjape Foods Website code
>>>>>>> dda0e9ca584cbae44d428b56aa74f7e8d35c4a5c
