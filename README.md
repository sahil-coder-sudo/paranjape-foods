# Paranjape Foods — Local Dev & Deploy

This workspace contains a Next.js frontend and an Express + MongoDB backend for Paranjape Foods.

## Quick Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` in the project root (or set env vars):
```text
MONGODB_URI=mongodb://127.0.0.1:27017/paranjape-foods
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

## API Highlights
- `GET /api/health` — basic health check
- `GET /api/menu` — returns menu items from MongoDB
- `POST /api/customer` — register or retrieve customer details
- `POST /api/orders` — place an order
- `POST /api/contact` — save contact request

## Deployment Notes
- Build Next.js frontend (`npm run build --workspace=frontend`) and serve it.
- Run Express backend on Heroku or Node container (`npm run backend`).
